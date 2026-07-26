import re
import json
import os
import fnmatch
import requests
import concurrent.futures
from urllib.parse import urlparse
from services.logger import logger

try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

MAX_CONTENT_FETCH = 10000
MAX_FILES_TO_SCAN = 10000
MAX_WORKERS = 25
SCAN_TIMEOUT = 180

SENSITIVE_PATTERNS = [
    (r'(?i)\b(?:api[_-]?key|apikey)\s*[=:]\s*["\']?[\w\-]{16,}', "API Key"),
    (r'(?i)\b(?:secret[_-]?key)\s*[=:]\s*["\']?[\w\-]{16,}', "Secret Key"),
    (r'(?i)\b(?:password|passwd|pwd)\s*[=:]\s*["\'][^"\']{6,}["\']', "Password"),
    (r'(?i)\b(?:token|auth[_-]?token)\s*[=:]\s*["\'][A-Za-z0-9_\-\.\/]{16,}["\']', "Auth Token"),
    (r'(?i)\bbearer\s*[=:]\s*["\'][A-Za-z0-9_\-\.]{16,}["\']', "Auth Token"),
    (r'(?i)\b(?:access[_-]?key[_-]?id|aws_access_key_id)\s*[=:]\s*["\']?AKIA[0-9A-Z]{16}["\']?', "AWS Access Key"),
    (r'(?i)\b(?:secret[_-]?access[_-]?key|aws_secret_access_key)\s*[=:]\s*["\']?[A-Za-z0-9\/+]{40}["\']?', "AWS Secret Key"),
    (r'ghp_[A-Za-z0-9_]{36,}', "GitHub Token"),
    (r'gho_[A-Za-z0-9_]{36,}', "GitHub OAuth Token"),
    (r'gsk_[A-Za-z0-9_]{36,}', "Groq API Key"),
    (r'sk-[A-Za-z0-9_]{32,}', "OpenAI API Key"),
    (r'vcp_[A-Za-z0-9_]{30,}', "Vercel Token"),
    (r'(?i)(?:sk|pk)_(?:test|live)_[A-Za-z0-9]{24,}', "Stripe Key"),
    (r'xox[bpsa]-[A-Za-z0-9\-]{24,}', "Slack Token"),
    (r'(?i)(?:-----BEGIN\s*(?:RSA\s*)?PRIVATE KEY-----)', "Private Key"),
    (r'(?i)(?:private[_-]?key)\s*[=:]\s*["\'][^"\']{6,}["\']', "Private Key"),
    (r'(?i)(?:jdbc|mongodb|postgresql|mysql)://[^"\'\s]+:[^"\'\s]+@', "Database Connection String"),
]

SENSITIVE_FILENAMES = [
    ".env", ".env.local", ".env.production", ".env.development",
    ".env.staging", ".env.test",
    "credentials", "credential", "secret", "secrets", "secret.json",
    "id_rsa", "id_rsa.pub", "id_ed25519", "id_ed25519.pub",
    ".npmrc", ".netrc", ".dockercfg", ".dockerconfigjson",
    "service-account.json", "service-account-key.json",
    "google-credentials.json", "aws-credentials.json",
    "kubeconfig", "kube-config", "admin.conf",
    "terraform.tfvars", "terraform.tfvars.json",
    ".sops.yaml", "age.key", "sops.key",
    "vault-password", "vault-key",
    "*.pem", "*.key", "*.cert", "*.p12", "*.pfx",
    "passwd", "shadow", "htpasswd",
    ".git-credentials", ".gitconfig",
]

SENSITIVE_DIRECTORIES = [
    ".git", ".svn", ".hg", ".env", "secrets", "credentials",
    ".aws", ".gcp", ".azure", ".config/sops",
]

LARGE_FILE_THRESHOLD = 2 * 1024 * 1024

REMEDIATION_MAP = {
    "API Key": "Move to environment variables or a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault). Add the key file to .gitignore and rotate the exposed key immediately.",
    "Secret Key": "Replace with a reference from a secrets manager. Revoke the exposed key and generate a new one. Use .env files with .gitignore.",
    "Password": "Remove hardcoded password. Use environment variables or a secrets manager. Rotate the password immediately if it's still valid.",
    "Auth Token": "Revoke the token immediately and generate a new one. Store tokens in environment variables or a secure vault. Never hardcode tokens.",
    "AWS Access Key": "Revoke immediately in AWS IAM Console. Generate new keys and store in AWS Secrets Manager or use IAM roles instead of hardcoded keys.",
    "AWS Secret Key": "Revoke immediately in AWS IAM Console. Use IAM roles for EC2/Lambda or store in AWS Secrets Manager.",
    "GitHub Token": "Revoke the token in GitHub Settings → Developer settings → Personal access tokens. Use GitHub Actions secrets for CI/CD.",
    "GitHub OAuth Token": "Revoke in GitHub OAuth Apps settings. Regenerate and use environment variables for storage.",
    "Groq API Key": "Revoke the key and generate a new one. Store in environment variables or a secrets manager.",
    "OpenAI API Key": "Revoke the key in OpenAI dashboard. Store in environment variables. Never commit to version control.",
    "Stripe Key": "Revoke immediately in Stripe Dashboard. Use Stripe's restricted keys for specific permissions. Store in environment variables.",
    "Slack Token": "Revoke the token in Slack API dashboard. Generate a new token with minimal required scopes.",
    "Private Key": "Revoke the key pair and generate new ones. Store private keys in a secrets manager. Never commit private keys to repos.",
    "Database Connection String": "Move connection strings to environment variables. Use IAM-based auth where possible. Rotate credentials immediately.",
    "Sensitive Filename": "Add the file to .gitignore immediately. If the file has been committed, use `git filter-branch` or `BFG Repo-Cleaner` to remove it from history.",
    "Large File": "Consider using Git LFS (Large File Storage) for large files. Remove large binaries from the repo and use external storage with links.",
}

def get_remediation(issue_type: str) -> str:
    return REMEDIATION_MAP.get(issue_type, "Review the exposed data and follow security best practices to secure it.")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")

def get_github_headers():
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return headers

def parse_github_url(url: str):
    parsed = urlparse(url)
    if "github.com" not in parsed.netloc:
        return None, None
    path_parts = parsed.path.strip("/").split("/")
    if len(path_parts) >= 2:
        return path_parts[0], path_parts[1]
    return None, None

def fetch_repo_info(owner: str, repo: str):
    url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = get_github_headers()
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            size_kb = data.get("size", 0)
            return size_kb * 1024
        return None
    except Exception as e:
        logger.error(f"Failed to fetch repo info: {e}")
        return None

def fetch_repo_tree(owner: str, repo: str):
    url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/master?recursive=1"
    headers = get_github_headers()
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code == 404:
            url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/main?recursive=1"
            resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            return [item for item in data.get("tree", []) if item["type"] == "blob"]
        return None
    except Exception as e:
        logger.error(f"Failed to fetch repo tree: {e}")
        return None

def fetch_file_content(owner: str, repo: str, path: str):
    urls = [
        f"https://raw.githubusercontent.com/{owner}/{repo}/master/{path}",
        f"https://raw.githubusercontent.com/{owner}/{repo}/main/{path}",
    ]
    for url in urls:
        try:
            resp = requests.get(url, timeout=8)
            if resp.status_code == 200:
                return resp.text
        except Exception:
            continue
    logger.error(f"Failed to fetch file {path} (both master/main)")
    return None

def check_sensitive_filename(filename: str):
    name_lower = filename.lower().replace("\\", "/")
    for pattern in SENSITIVE_FILENAMES:
        if pattern.startswith("*"):
            if fnmatch.fnmatch(name_lower, pattern):
                return True
        elif pattern == name_lower:
            return True
    for directory in SENSITIVE_DIRECTORIES:
        if name_lower.startswith(directory + "/") or name_lower.startswith(directory + "\\"):
            return True
    return False

EXCLUDED_FUNCTIONS = [
    "getpass", "get_password_hash", "verify_password",
    "create_access_token", "create_refresh_token",
    "localstorage", "sessionstorage",
    "getenv", "environ.get", "os.getenv", "os.environ",
    "process.env", "config(", "settings.",
    "socket.", "request.", "response.",
]

FUNCTION_CALL_RE = re.compile(r'^[a-z_][a-z0-9_]*\(')
IDENTIFIER_RE = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')
DIGIT_PATTERN_RE = re.compile(r'[0-9]')
COMMENT_RE = re.compile(r'^\s*(#|//|--|\*)')

PLACEHOLDER_VALUES = {"your_password", "your-api-key", "your-token", "your-secret", "your_key",
    "your_api_key", "your_token", "your_secret", "changeme", "change_me", "change-me",
    "todo", "tbd", "placeholder", "example", "sample", "test", "demo", "xxxxxx", "******",
    "your-password", "your_password_here", "password123", "admin123", "test123",
    "default", "password", "pass", "p@ssw0rd", "qwerty", "abc123", "letmein",
    "welcome", "monkey", "dragon", "master", "admin", "root", "guest", "user",
    "123456", "12345678", "1234", "12345", "123456789", "football", "iloveyou",
    "trustno1", "sunshine", "princess", "passwd", "pwd", "secret", "mypass",
    "none", "null", "nil", "true", "false", "yes", "no", "key", "passphrase",
    "PASSWORD", "TOKEN", "SECRET", "API_KEY", "ACCESS_KEY"}

COMMON_WEAK_PASSWORDS = {
    "password", "123456", "12345678", "qwerty", "abc123", "monkey", "123456789",
    "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
    "welcome", "shadow", "ashley", "football", "jesus", "michael", "ninja",
    "mustang", "password1", "admin", "root", "guest", "pass", "pwd", "user",
}

COMMON_ENV_VAR_NAMES = {
    "password", "passwd", "pwd", "token", "secret", "api_key", "api-key",
    "apikey", "access_key", "access-key", "accesskey", "secret_key", "secret-key",
    "secretkey", "auth_token", "auth-token", "authtoken", "db_password",
    "db-password", "dbpassword", "database_password", "database-password",
    "redis_password", "redis-password", "mysql_password", "postgres_password",
    "jwt_secret", "jwt-secret", "jwtsecret", "session_secret", "session-secret",
    "api_token", "api-token", "apitoken", "app_key", "app-key", "appkey",
    "consumer_key", "consumer_secret", "oauth_token", "oauth_secret",
    "private_key", "private-key", "privatekey", "public_key", "public-key",
    "ssh_key", "ssh-key", "sshkey", "slack_token", "slack-token",
    "discord_token", "discord-token", "telegram_token", "telegram-token",
    "db_host", "db-host", "dbhost", "db_user", "db-user", "dbuser",
    "database_url", "database-url", "databaseurl", "connection_string",
    "conn_string", "conn-str", "connstr",
}

DOC_EXTENSIONS = {".md", ".mdx", ".txt", ".rst", ".doc", ".docs", ".wiki", ".markdown"}
EXAMPLE_CONTEXT_KEYWORDS = [
    "example", "sample", "demo", "tutorial", "illustration",
    "for example", "for instance", "e.g.", "i.e.",
    "see also", "note:", "tip:", "info:", "warning:",
    "placeholder", "dummy", "mock", "fake",
    "configuration", "config", "setup", "setting up",
    "how to", "guide", "walkthrough", "quickstart",
    "understand", "learning", "teaching", "educational",
    "like this", "as shown", "below is", "above is",
    "schematic", "template", "template:", "sample code",
    "you can", "you need to", "you should",
    "replace with", "replace this", "change this",
    "your_", "your-", "<your", "[your",
]

VALIDATION_MSG_KEYWORDS = [
    "must be", "must contain", "is required", "are required",
    "does not match", "do not match", "at least", "no more than",
    "cannot be", "may not", "should be", "should contain",
    "enter your", "choose a", "create a", "pick a",
    "is invalid", "is not valid", "incorrect",
    "must have", "must include", "can't be", "cant be",
    "is taken", "already exists", "already taken",
]

def is_doc_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    base = os.path.basename(filename).lower()
    return ext in DOC_EXTENSIONS or base in DOC_EXTENSIONS

def get_surrounding_context(lines: list, line_idx: int, window: int = 3) -> str:
    start = max(0, line_idx - window)
    end = min(len(lines), line_idx + window + 1)
    return "\n".join(lines[start:end]).lower()

def has_example_context(context: str) -> bool:
    return any(kw in context for kw in EXAMPLE_CONTEXT_KEYWORDS)

def value_is_placeholder(value: str) -> bool:
    clean = value.strip("\"'`").lower()
    if clean in PLACEHOLDER_VALUES:
        return True
    if clean in COMMON_WEAK_PASSWORDS:
        return True
    if clean in COMMON_ENV_VAR_NAMES:
        return True
    if re.fullmatch(r'[a-z]+', clean) and len(clean) < 12:
        return True
    if re.fullmatch(r'[a-z]+\d{0,3}', clean) and len(clean) < 12:
        return True
    if len(clean) < 8 and not DIGIT_PATTERN_RE.search(clean):
        return True
    if " " in clean and len(clean) > 20:
        return True
    if any(kw in clean for kw in VALIDATION_MSG_KEYWORDS):
        return True
    if "password" in clean and " " in clean:
        return True
    return False

def is_false_positive(match: str, label: str, line: str = "", filename: str = "", surrounding_context: str = "") -> bool:
    match_lower = match.lower().strip()
    line_lower = line.lower().strip() if line else ""
    context = surrounding_context.lower() if surrounding_context else line_lower

    if COMMENT_RE.match(line_lower) or COMMENT_RE.match(line_lower.lstrip()):
        return True

    if COMMENT_RE.match(match_lower):
        return True

    if has_example_context(context):
        return True

    doc_file = is_doc_file(filename) if filename else False

    if doc_file and label in ("Password", "Auth Token", "Database Connection String"):
        return True

    if re.match(r'\b(password|passwd|pwd|token|bearer)\s*:\s*(?:str|string|bytes|int|bool|float)', match_lower):
        return True

    if "=" in match_lower:
        value = match_lower.split("=", 1)[1].strip()
        if value.startswith(("'", '"', "`")):
            if value_is_placeholder(value):
                return True
            clean_value = value.strip("\"'`")
            if len(clean_value) < 6:
                return True
            if label == "Password":
                alpha_ratio = sum(c.isalpha() for c in clean_value) / max(len(clean_value), 1)
                if alpha_ratio > 0.85 and clean_value.islower():
                    return True
                if DIGIT_PATTERN_RE.search(clean_value) and sum(c.isdigit() for c in clean_value) <= 3 and alpha_ratio > 0.8:
                    return True
            return False
        if any(kw in value.lower() for kw in EXCLUDED_FUNCTIONS):
            return True
        if FUNCTION_CALL_RE.match(value):
            return True
        if "." in value:
            before_dot = value.split(".")[0]
            if before_dot.isidentifier() and not DIGIT_PATTERN_RE.search(before_dot):
                return True
        if IDENTIFIER_RE.match(value) and not DIGIT_PATTERN_RE.search(value):
            return True

    if ":" in match_lower:
        after_colon = match_lower.split(":", 1)[1].strip().rstrip(",)")
        if after_colon in ("str", "string", "int", "bool", "float", "bytes"):
            return True

    if "bearer" in match_lower and not any(c in match_lower for c in ("'", '"', "`")):
        return True

    return False

def check_content_for_secrets(content: str, filename: str):
    findings = []
    if not content:
        return findings
    lines = content.split("\n")
    for pattern, label in SENSITIVE_PATTERNS:
        for match_obj in re.finditer(pattern, content):
            match = match_obj.group()
            line_num = content[:match_obj.start()].count("\n") + 1
            line_content = lines[line_num - 1] if 0 < line_num <= len(lines) else ""
            surrounding = get_surrounding_context(lines, line_num - 1, 2)
            if is_false_positive(match[:40], label, line_content, filename, surrounding):
                continue
            masked = match[:20] + "****" if len(match) > 24 else match
            findings.append({
                "type": label,
                "match": masked,
                "file": filename,
                "line": line_num,
                "severity": "critical" if "key" in label.lower() or "token" in label.lower() or "secret" in label.lower() or "private" in label.lower() else "high",
                "remediation": get_remediation(label),
            })
    return findings

def ai_read_and_analyze(content: str, filename: str) -> list:
    if not content or len(content.strip()) < 10:
        return []

    ext = os.path.splitext(filename)[1].lower()
    doc_exts = {".md", ".txt", ".rst", ".mdx", ".html"}
    if ext in doc_exts:
        return []

    max_chars = 4000
    truncated = content[:max_chars] if len(content) > max_chars else content

    prompt = f"""You are a security code reviewer. Read this file and find ALL potential secrets — do NOT skip anything.

File: {filename}
Content:
```
{truncated}
```

Analyze and find:
1. Hardcoded secrets (API keys, passwords, tokens, database credentials)
2. Sensitive files or data exposure
3. Security vulnerabilities

For each finding, classify it:
- **real**: An actual credential/secret that could cause damage if exposed
- **example**: Example code, tutorial, placeholder, validation message
- **template**: Config template where value is a variable reference like ${{var}}, process.env.VAR, os.getenv("VAR")

Return ALL findings regardless of classification. Do NOT skip anything.

Respond ONLY with JSON:
{{"findings": [{{"type": "Password", "match": "first 20 chars", "line": 42, "severity": "high", "verdict": "real"}}]}}
If nothing found, return {{"findings": []}}"""

    api_key = os.getenv("GROQ_API_KEY")
    if api_key and len(api_key) > 10 and "YOUR" not in api_key:
        try:
            import openai
            client = openai.OpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1",
                timeout=20.0,
                max_retries=1
            )
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            result = json.loads(response.choices[0].message.content)
            findings = result.get("findings", [])
            for f in findings:
                f.setdefault("file", filename)
                f.setdefault("remediation", get_remediation(f.get("type", "")))
                if "match" in f:
                    m = f["match"]
                    if len(m) > 24:
                        f["match"] = m[:20] + "****"
            return findings
        except Exception as e:
            logger.warning(f"Groq analysis failed for {filename}: {e}")

    try:
        import ollama
        if OLLAMA_AVAILABLE:
            response = ollama.chat(
                model='llama3',
                messages=[{'role': 'user', 'content': prompt}],
                format='json',
                options={"temperature": 0.1}
            )
            result = json.loads(response['message']['content'])
            findings = result.get("findings", [])
            for f in findings:
                f.setdefault("file", filename)
                f.setdefault("remediation", get_remediation(f.get("type", "")))
                if "match" in f:
                    m = f["match"]
                    if len(m) > 24:
                        f["match"] = m[:20] + "****"
            return findings
    except Exception as e:
        logger.warning(f"Ollama analysis failed for {filename}: {e}")

    return []

def ai_repo_holistic_review(all_findings: list, repo_file_tree: list) -> list:
    if not all_findings:
        return []

    key_files = [p for p in repo_file_tree if any(
        p.endswith(ext) for ext in [".py", ".js", ".ts", ".json", ".yaml", ".yml", ".env", ".md", ".txt"]
    )]
    tree_summary = "\n".join(key_files[:60])

    findings_summary = []
    for f in all_findings:
        finding_type = f.get("type", "Unknown")
        match_val = f.get("match", "")[:30]
        file_path = f.get("_file", f.get("file", "?"))
        line_num = f.get("line", "?")
        findings_summary.append(f"  - {finding_type}: {match_val} in {file_path}:{line_num}")
    findings_text = "\n".join(findings_summary[:50])

    prompt = f"""You are analyzing a GitHub repository for security issues. Look at the ENTIRE repo structure and all findings together to determine what's REAL vs FAKE/EXAMPLE.

REPO FILE TREE (shows what kind of project this is):
{tree_summary}

ALL FINDINGS FROM SCAN:
{findings_text}

Think holistically:
1. What kind of project is this? (tutorial, demo, example, template, production app, library, etc.)
2. If this is clearly a tutorial/demo/example project → MOST findings are likely EXAMPLE code
3. If the repo has README mentioning "example", "demo", "tutorial", "sample" → it's educational
4. Even in production repos, values that look like env var names (PASSWORD, TOKEN, SECRET) or obvious placeholders (your_password, changeme) are EXAMPLE
5. REAL secrets look like actual keys/tokens that were accidentally committed (high-entropy, known formats, actual service credentials)
6. KEY RULE: If a value looks like an environment variable reference (e.g., ${{ secrets.KEY }}, process.env.VAR, os.getenv("VAR")) it is NOT a real secret — it's a config template

Return ONLY JSON:
{{"verdicts": [
  {{"type": "Password", "match": "first 20 chars", "file": "path/to/file.py", "verdict": "example"}},
  ...
]}}

Set verdict to "real" ONLY if the value is:
- A high-entropy random string in a production config file
- A known API key format in a non-obvious-example context
- A database URL with real-looking credentials
- A private key in a production deployment config

Set verdict to "example" if:
- The project appears to be a tutorial, demo, template, or educational content
- The value is a common placeholder, env var name, or dictionary word
- The file is clearly example/documentation code
- "your_", "changeme", "test", "example" patterns present
- It's a variable reference like env_var, os.getenv, process.env"""

    api_key = os.getenv("GROQ_API_KEY")
    if api_key and len(api_key) > 10 and "YOUR" not in api_key:
        try:
            import openai
            client = openai.OpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1",
                timeout=20.0,
                max_retries=1
            )
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            result = json.loads(response.choices[0].message.content)
            verdicts = result.get("verdicts", [])
            real_ones = []
            for v in verdicts:
                if v.get("verdict") == "real":
                    v["_file"] = v.pop("file", v.get("_file", ""))
                    real_ones.append(v)
            if real_ones:
                return real_ones
            return []
        except Exception as e:
            logger.warning(f"Holistic review failed: {e}")

    try:
        import ollama
        if OLLAMA_AVAILABLE:
            response = ollama.chat(
                model='llama3',
                messages=[{'role': 'user', 'content': prompt}],
                format='json',
                options={"temperature": 0.1}
            )
            result = json.loads(response['message']['content'])
            verdicts = result.get("verdicts", [])
            real_ones = []
            for v in verdicts:
                if v.get("verdict") == "real":
                    v["_file"] = v.pop("file", v.get("_file", ""))
                    real_ones.append(v)
            if real_ones:
                return real_ones
            return []
    except Exception as e:
        logger.warning(f"Ollama holistic review failed: {e}")

    return []

def generate_ai_scan_report(scanned_files: list, summary: dict, file_tree: list) -> str:
    issues_text = ""
    issue_count = 0
    for sf in scanned_files:
        for iss in sf.get("issues", []):
            if issue_count < 15:
                issues_text += f"  - {iss['type']}: {iss['match'][:30]} in {sf['path']}:{iss.get('line', '?')}\n"
                issue_count += 1

    file_tree_text = "\n".join(file_tree[:30])
    score = summary.get("score", 0)
    secure = "SECURE" if score >= 80 else "ISSUES FOUND"
    total_files = summary.get("total_files", 0)
    issues_found = summary.get("issues_found", 0)

    prompt = f"""You analyzed a GitHub repository. Generate a brief 2-3 sentence summary in Hindi/English mix explaining what you found.

Scan Results:
- Status: {secure}
- Security Score: {score}/100
- Total Files: {total_files}
- Issues Found: {issues_found}
- Sensitive Files: {summary.get('sensitive_files_count', 0)}

Key Files in Repo:
{file_tree_text}

Top Issues:
{issues_text if issues_text else "  No real security issues found."}

Write a short report telling the user what this repo contains and whether there are real security issues. Use simple Hindi-English mix. 2-3 sentences max.
If no real issues: say repo looks safe.
If issues found: explain what type and how serious.
Do NOT mention scores or technical details. Just plain explanation."""

    api_key = os.getenv("GROQ_API_KEY")
    if api_key and len(api_key) > 10 and "YOUR" not in api_key:
        try:
            import openai
            client = openai.OpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1",
                timeout=15.0,
                max_retries=1
            )
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"AI report generation failed: {e}")

    try:
        import ollama
        if OLLAMA_AVAILABLE:
            response = ollama.chat(
                model='llama3',
                messages=[{'role': 'user', 'content': prompt}],
                options={"temperature": 0.3}
            )
            return response['message']['content'].strip()
    except Exception as e:
        logger.warning(f"Ollama report failed: {e}")

    return ""

def scan_github_repo(github_url: str):
    owner, repo = parse_github_url(github_url)
    if not owner or not repo:
        return {
            "status": "error",
            "error": "Only GitHub URLs (github.com) are supported. Please provide a valid GitHub repository URL.",
            "files": [],
            "summary": {}
        }

    repo_size_bytes = fetch_repo_info(owner, repo)
    files = fetch_repo_tree(owner, repo)
    if files is None:
        return {
            "status": "error",
            "error": "Could not fetch repository. Make sure it exists and is public. Check your GITHUB_TOKEN.",
            "files": [],
            "summary": {}
        }

    if not files:
        return {
            "status": "completed",
            "summary": {
                "total_files": 0,
                "total_size_bytes": 0,
                "total_size_hr": "0 B",
                "issues_found": 0,
                "sensitive_files_count": 0,
                "large_files_count": 0,
                "score": 100,
                "secure": True,
            },
            "files": [],
            "sensitive_files": [],
            "large_files": [],
            "ai_report": "Repository is empty — no files to scan.",
        }

    scanned_files = []
    issues_found = 0
    total_size = repo_size_bytes if repo_size_bytes else 0
    use_repo_total = repo_size_bytes is not None
    sensitive_files = []
    large_files = []

    content_fetched = 0
    files_to_process = files[:MAX_FILES_TO_SCAN]
    total_file_count = len(files_to_process)

    file_infos = []
    for file in files_to_process:
        path = file["path"]
        size = file.get("size", 0)
        if not use_repo_total:
            total_size += size
        file_info = {
            "path": path,
            "size": size,
            "size_hr": format_size(size),
            "issues": [],
            "sensitive_name": False,
            "is_large": size > LARGE_FILE_THRESHOLD,
        }

        if check_sensitive_filename(path):
            file_info["sensitive_name"] = True
            file_info["issues"].append({
                "type": "Sensitive Filename",
                "match": path,
                "severity": "high",
                "remediation": get_remediation("Sensitive Filename"),
            })
            sensitive_files.append(path)

        if size > LARGE_FILE_THRESHOLD:
            file_info["issues"].append({
                "type": "Large File",
                "match": f"{format_size(size)}",
                "severity": "medium",
                "remediation": get_remediation("Large File"),
            })
            large_files.append({"path": path, "size": size})

        file_infos.append(file_info)

    fetch_candidates = [
        (i, file) for i, file in enumerate(files_to_process)
        if content_fetched < MAX_CONTENT_FETCH
        and file.get("size", 0) < 10 * 1024 * 1024
    ]

    def fetch_and_analyze(idx, file_entry):
        path = file_entry["path"]
        content = fetch_file_content(owner, repo, path)
        if not content:
            return idx, []
        regex_findings = check_content_for_secrets(content, path)
        ai_findings = ai_read_and_analyze(content, path)
        for f in ai_findings:
            f["_ai"] = True
        all_findings = []
        seen_keys = set()
        combined = regex_findings + ai_findings
        combined.sort(key=lambda x: 0 if x.get("_ai") else 1)
        for f in combined:
            key = (f.get("type", ""), f.get("match", ""), f.get("line"))
            if key not in seen_keys:
                seen_keys.add(key)
                all_findings.append(f)
        return idx, all_findings

    batch_size = 50
    for batch_start in range(0, len(fetch_candidates), batch_size):
        batch = fetch_candidates[batch_start:batch_start + batch_size]
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_map = {
                executor.submit(fetch_and_analyze, idx, fe): idx
                for idx, fe in batch
            }
            for future in concurrent.futures.as_completed(future_map, timeout=SCAN_TIMEOUT):
                try:
                    idx, findings = future.result()
                    if findings:
                        file_infos[idx]["issues"].extend(findings)
                        sensitive_files.append(file_infos[idx]["path"])
                except Exception as e:
                    logger.warning(f"Fetch/analyze failed: {e}")

    for fi in file_infos:
        fi["issue_count"] = len(fi["issues"])
        issues_found += fi["issue_count"]
    scanned_files = file_infos

    issues_found = sum(len(sf["issues"]) for sf in scanned_files)
    sensitive_files = [sf["path"] for sf in scanned_files if sf["issues"]]

    score = calculate_security_score(issues_found, len(scanned_files), sensitive_files)

    ai_report = generate_ai_scan_report(scanned_files, {
        "total_files": len(scanned_files),
        "total_size_hr": format_size(total_size),
        "issues_found": issues_found,
        "sensitive_files_count": len(set(sensitive_files)),
        "score": score,
    }, [f["path"] for f in scanned_files[:50]])

    summary = {
        "total_files": len(scanned_files),
        "total_size_bytes": total_size,
        "total_size_hr": format_size(total_size),
        "issues_found": issues_found,
        "sensitive_files_count": len(set(sensitive_files)),
        "large_files_count": len(large_files),
        "score": score,
        "secure": score >= 80,
    }

    if total_file_count > MAX_FILES_TO_SCAN:
        summary["note"] = f"Repo has {total_file_count} files; scanned first {MAX_FILES_TO_SCAN}"
    if len(files) > MAX_FILES_TO_SCAN:
        summary["note"] = summary.get("note", "") + f" (total repo files: {len(files)})"

    return {
        "status": "completed",
        "summary": summary,
        "files": scanned_files,
        "sensitive_files": list(set(sensitive_files)),
        "large_files": large_files,
        "ai_report": ai_report,
    }

def calculate_security_score(issues: int, total_files: int, sensitive_files: list):
    if total_files == 0:
        return 100
    base = 100
    base -= issues * 5
    base -= len(set(sensitive_files)) * 3
    return max(0, min(100, base))

def format_size(bytes_val: int):
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes_val < 1024:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f} TB"
