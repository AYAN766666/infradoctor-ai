import re
import json
import os
import fnmatch
import time
import requests
import concurrent.futures
from urllib.parse import urlparse
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from services.logger import logger

try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

MAX_CONTENT_FETCH = 10000
MAX_FILES_TO_SCAN = 10000
MAX_WORKERS = 30
SCAN_TIMEOUT = 300

_session = None

def get_session():
    global _session
    if _session is None:
        _session = requests.Session()
        retry = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
        adapter = HTTPAdapter(max_retries=retry, pool_connections=50, pool_maxsize=50)
        _session.mount("https://", adapter)
        _session.mount("http://", adapter)
    return _session

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
    branches = ["master", "main"]
    headers = get_github_headers()
    session = get_session()

    for branch in branches:
        tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        for attempt in range(3):
            try:
                resp = session.get(tree_url, headers=headers, timeout=120)
                if resp.status_code == 200:
                    data = resp.json()
                    truncated = data.get("truncated", False)
                    items = [item for item in data.get("tree", []) if item["type"] == "blob"]
                    if truncated:
                        logger.warning(f"Tree truncated for {owner}/{repo} (too many files). Scanning {len(items)} files.")
                    return items
                if resp.status_code == 404:
                    break
                if resp.status_code in (429, 403):
                    wait = 2 ** attempt * 2
                    logger.warning(f"Rate limited fetching tree (attempt {attempt+1}), waiting {wait}s")
                    time.sleep(wait)
                    continue
            except requests.Timeout:
                logger.warning(f"Timeout fetching tree for {owner}/{repo} (attempt {attempt+1})")
                if attempt < 2:
                    time.sleep(2 ** attempt * 2)
            except Exception as e:
                logger.error(f"Failed to fetch repo tree: {e}")
                break

    logger.error(f"Could not fetch tree via GitHub API. Trying Contents API fallback for {owner}/{repo}")
    try:
        return fetch_repo_tree_contents_api(owner, repo)
    except Exception as e:
        logger.error(f"Contents API fallback also failed: {e}")
        return None

def fetch_repo_tree_contents_api(owner: str, repo: str):
    session = get_session()
    headers = get_github_headers()
    default_branch = "master"

    try:
        repo_resp = session.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers=headers, timeout=15
        )
        if repo_resp.status_code == 200:
            default_branch = repo_resp.json().get("default_branch", "master")
    except Exception:
        pass

    all_files = []
    queue = [""]
    max_items = MAX_FILES_TO_SCAN * 2
    request_count = 0

    while queue and len(all_files) < max_items:
        current_path = queue.pop(0)
        for attempt in range(3):
            try:
                api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{current_path}"
                if current_path == "":
                    api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/"
                resp = session.get(api_url, headers=headers, timeout=30)
                request_count += 1
                if resp.status_code == 200:
                    items = resp.json()
                    if not isinstance(items, list):
                        break
                    for item in items:
                        if item["type"] == "file":
                            all_files.append({
                                "path": item["path"],
                                "size": item.get("size", 0),
                            })
                        elif item["type"] == "dir":
                            queue.append(item["path"])
                    break
                elif resp.status_code in (429, 403):
                    wait = 2 ** attempt * 3
                    logger.warning(f"Rate limited on Contents API, waiting {wait}s")
                    time.sleep(wait)
                else:
                    break
            except Exception as e:
                logger.warning(f"Contents API error at {current_path} (attempt {attempt+1}): {e}")
                if attempt < 2:
                    time.sleep(2 ** attempt)

    logger.info(f"Contents API fallback found {len(all_files)} files for {owner}/{repo} ({request_count} requests)")
    return all_files[:MAX_FILES_TO_SCAN]

def fetch_file_content(owner: str, repo: str, path: str):
    session = get_session()
    branches = ["master", "main"]
    for branch in branches:
        url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
        for attempt in range(3):
            try:
                resp = session.get(url, timeout=30)
                if resp.status_code == 200:
                    return resp.text
                if resp.status_code == 404:
                    break
                if resp.status_code in (429, 403):
                    time.sleep(2 ** attempt * 2)
            except (requests.Timeout, requests.ConnectionError) as e:
                logger.warning(f"Failed to fetch {path} from {branch} (attempt {attempt+1}): {e}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
            except Exception:
                break
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

IMPORT_RE = re.compile(r'^\s*(import|from|require|include|export)\s')
ENV_READ_RE = re.compile(r'(?:os\.environ|os\.getenv|process\.env|import\.meta\.env|Deno\.env)')
TYPE_ANN_RE = re.compile(r':\s*(str|string|int|bool|float|bytes|SecretStr|SecretBytes)\s*(?:=|,|\)|$)'

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
    "PASSWORD", "TOKEN", "SECRET", "API_KEY", "ACCESS_KEY",
    "***", "xxx", "your_token_here", "your_key_here", "your_secret_here",
    "put_your", "enter_your", "insert_your", "replace_with"}

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
    if "your_" in clean or "your-" in clean:
        return True
    if clean.startswith("ghp_") and "your_new" in clean:
        return True
    if clean.startswith("AKIA") and "example" in clean.lower():
        return True
    if "example" in clean and len(clean) < 25:
        return True
    if any(kw in clean for kw in ["getenv", "process.env", "environ[", "import.meta"]):
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

    if IMPORT_RE.match(line_lower):
        return True

    if ENV_READ_RE.search(line_lower):
        return True

    if TYPE_ANN_RE.search(match_lower):
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
            return value_is_placeholder(value.strip("\"'`"))
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
    ext = os.path.splitext(filename)[1].lower()
    for pattern, label in SENSITIVE_PATTERNS:
        for match_obj in re.finditer(pattern, content):
            match = match_obj.group()
            line_num = content[:match_obj.start()].count("\n") + 1
            line_content = lines[line_num - 1] if 0 < line_num <= len(lines) else ""
            surrounding = get_surrounding_context(lines, line_num - 1, 2)
            if is_false_positive(match[:40], label, line_content, filename, surrounding):
                continue

            full_value = match.split("=", 1)[-1].strip("\"' ") if "=" in match else match
            is_placeholder = value_is_placeholder(full_value) or is_demo_value(full_value)

            verdict = "example" if is_placeholder else "unknown"
            severity = "low" if is_placeholder else (
                "critical" if any(k in label.lower() for k in ["key", "token", "secret", "private"])
                else "high"
            )

            masked = match[:20] + "****" if len(match) > 24 else match
            findings.append({
                "type": label,
                "match": masked,
                "file": filename,
                "line": line_num,
                "severity": severity,
                "verdict": verdict,
                "remediation": get_remediation(label),
                "_source": "regex",
            })
    return findings

_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    api_key = os.getenv("GROQ_API_KEY")
    if api_key and len(api_key) > 10 and "YOUR" not in api_key:
        try:
            from groq import Groq
            _groq_client = Groq(api_key=api_key, timeout=30.0)
            return _groq_client
        except ImportError:
            try:
                import openai
                _groq_client = openai.OpenAI(
                    api_key=api_key,
                    base_url="https://api.groq.com/openai/v1",
                    timeout=30.0,
                    max_retries=2
                )
                return _groq_client
            except ImportError:
                pass
    return None

def groq_chat(messages: list, response_format: str = None, model: str = "llama3-70b-8192", temperature: float = 0.1):
    client = get_groq_client()
    if client is None:
        return None

    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "timeout": 30,
    }

    client_type = type(client).__name__
    if client_type == "Groq":
        try:
            if response_format == "json":
                kwargs["response_format"] = {"type": "json_object"}
            elif response_format == "text":
                pass
            response = client.chat.completions.create(**kwargs)
            return response.choices[0].message.content
        except Exception as e:
            logger.warning(f"Groq SDK failed: {e}")
            try:
                import openai
                alt_client = openai.OpenAI(
                    api_key=os.getenv("GROQ_API_KEY"),
                    base_url="https://api.groq.com/openai/v1",
                    timeout=30.0,
                    max_retries=2
                )
                alt_kwargs = {**kwargs}
                if response_format == "json":
                    alt_kwargs["response_format"] = {"type": "json_object"}
                alt_resp = alt_client.chat.completions.create(**alt_kwargs)
                return alt_resp.choices[0].message.content
            except Exception as e2:
                logger.warning(f"OpenAI fallback also failed: {e2}")
                return None
    else:
        try:
            if response_format == "json":
                kwargs["response_format"] = {"type": "json_object"}
            response = client.chat.completions.create(**kwargs)
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"OpenAI/Groq call failed: {e}")
            return None

DEMO_PATTERNS = [
    "your_", "your-", "changeme", "change_me", "change-me",
    "placeholder", "put_your", "enter_your",
    "example", "sample", "demo", "test_", "tutorial",
    "xxxx", "****", "___",
    "your_password", "your_api_key", "your_token", "your_secret",
    "your_key_here", "your_password_here", "your_token_here",
    "your_secret_here", "your_api_key_here",
    "YOUR_", "YOUR-",
    "ghp_YOUR", "gsk_YOUR", "sk-YOUR",
]

def is_demo_value(value: str) -> bool:
    clean = value.strip("\"' ").lower()
    for p in DEMO_PATTERNS:
        if p.lower() in clean:
            return True
    if len(clean) < 6:
        return True
    return False


def ai_read_and_analyze(content: str, filename: str) -> list:
    return []

def ai_repo_holistic_review(all_findings: list, repo_file_tree: list) -> list:
    if not all_findings:
        return []

    key_files = [p for p in repo_file_tree if any(
        p.endswith(ext) for ext in [".py", ".js", ".ts", ".json", ".yaml", ".yml", ".env", ".md", ".txt"]
    )]
    tree_summary = "\n".join(key_files[:80])

    findings_summary = []
    for f in all_findings:
        finding_type = f.get("type", "Unknown")
        match_val = f.get("match", "")[:30]
        file_path = f.get("_file", f.get("file", "?"))
        findings_summary.append(f"  - {finding_type}: {match_val} in {file_path}:{f.get('line', '?')}")
    findings_text = "\n".join(findings_summary[:60])

    prompt = f"""You are an expert security reviewer. Review these findings from a GitHub repo scan. Decide if each is a REAL credential leak or just demo/example/config code.

Context — the repo's file structure:
{tree_summary}

Findings found in the repo:
{findings_text}

Rules for "example" (NOT real):
- Value contains "your_", "example", "sample", "demo", "test", "changeme", "xxxxx"
- Value is a type annotation like "str", "string", "int" (TypeScript/Python type hints)
- Value is an environment variable read like os.getenv, process.env, os.environ
- Line is an import/require/include statement
- File is .env.example, .env.sample, or in a docs/example folder
- Value looks like a config key name, not an actual secret value
- Value is shorter than 8 chars or all lowercase letters with no digits

Rules for "real" (actual credential):
- Value looks like a real API key format (e.g., sk-... with real chars, ghp_ with real hash)
- The file is an actual .env or config file with seemingly real credentials
- Multiple lines of actual secrets in a row (not just one isolated match)
- Value is complex with mixed case, digits, special chars (not a simple word)

Return JSON:
{{"verdicts": [{{"type": "GitHub Token", "match": "ghp_xxx", "file": "path/to/file", "verdict": "example"}}]}}"""

    result = groq_chat(
        messages=[{"role": "user", "content": prompt}],
        response_format="json",
        temperature=0.1
    )

    if OLLAMA_AVAILABLE and result is None:
        try:
            import ollama
            from json import loads as jloads
            response = ollama.chat(
                model='llama3',
                messages=[{'role': 'user', 'content': prompt}],
                format='json',
                options={"temperature": 0.1}
            )
            data = jloads(response['message']['content'])
            verdicts = data.get("verdicts", [])
        except Exception:
            verdicts = []
    elif result:
        try:
            data = json.loads(result)
            verdicts = data.get("verdicts", [])
        except json.JSONDecodeError:
            verdicts = []
    else:
        verdicts = []

    result_list = []
    for v in verdicts:
        file_path = v.pop("file", v.get("_file", ""))
        v["_file"] = file_path
        result_list.append(v)
    return result_list

def generate_ai_scan_report(scanned_files: list, summary: dict, file_tree: list) -> str:
    real_issues_list = []
    example_issues_list = []
    for sf in scanned_files:
        for iss in sf.get("issues", []):
            v = iss.get("verdict", "")
            tag = "EXAMPLE" if v in ("example", "demo") else "REAL"
            target = example_issues_list if v in ("example", "demo") else real_issues_list
            if len(target) < 15:
                target.append(f"  [{tag}] {iss['type']}: {iss['match'][:30]} in {sf['path']}:{iss.get('line', '?')} ({iss.get('severity','?')})")

    file_tree_text = "\n".join(file_tree[:30])
    total_files = summary.get("total_files", 0)
    issues_found = summary.get("issues_found", 0)
    real_count = summary.get("real_issues", 0)

    prompt = f"""GitHub repo scan complete. Summarize the results in 2-4 sentences in Hinglish (Hindi+English mixed).

Total files: {total_files}
Total issues: {issues_found}
Real issues: {real_count}

Key files: {file_tree_text[:200]}

{"REAL ISSUES:" if real_issues_list else ""}
{chr(10).join(real_issues_list) if real_issues_list else ""}

{"OTHER FINDINGS:" if example_issues_list else ""}
{chr(10).join(example_issues_list) if example_issues_list else ""}

Explain what kind of repo this is and whether there are any real security concerns. Be honest and natural."""

    result = groq_chat(
        messages=[{"role": "user", "content": prompt}],
        response_format="text",
        model="llama3-70b-8192",
        temperature=0.3
    )
    if result:
        return result.strip()

    total = summary.get("total_files", 0)
    real = summary.get("real_issues", 0)
    found = summary.get("issues_found", 0)
    if real > 0:
        return f"Is repo mein {total} files scan hui. {real} real security issues mili hain aur {found - real} sirf example/demo values hain. Real issues ko immediately fix karo!"
    if found == 0:
        return f"Is repo mein {total} files scan hui. Koi bhi security issue nahi mila. Repo completely safe hai."
    return f"Is repo mein {total} files scan hui. Sirf {found} example/demo placeholder values mili hain, koi real secret nahi. Repo safe hai."

def scan_github_repo(github_url: str):
    owner, repo = parse_github_url(github_url)
    if not owner or not repo:
        return {
            "status": "error",
            "error": "Only GitHub URLs (github.com) are supported. Please provide a valid GitHub repository URL.",
            "files": [],
            "summary": {}
        }

    logger.info(f"Starting scan for {owner}/{repo}")
    repo_size_bytes = fetch_repo_info(owner, repo)

    logger.info(f"Fetching file tree for {owner}/{repo}")
    try:
        files = fetch_repo_tree(owner, repo)
    except Exception as e:
        logger.error(f"Tree fetch exception for {owner}/{repo}: {e}")
        files = None

    if files is None:
        return {
            "status": "error",
            "error": "Could not fetch repository tree. Make sure it exists, is public, and has a manageable size. Check your GITHUB_TOKEN.",
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
    total_file_count = len(files)
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
        if file.get("size", 0) < 10 * 1024 * 1024
    ]

    def fetch_and_analyze(idx, file_entry):
        path = file_entry["path"]
        try:
            content = fetch_file_content(owner, repo, path)
        except Exception as e:
            logger.warning(f"Failed to fetch content for {path}: {e}")
            return idx, []
        if not content:
            return idx, []
        try:
            regex_findings = check_content_for_secrets(content, path)
        except Exception as e:
            logger.warning(f"Analysis failed for {path}: {e}")
            return idx, []

        for f in regex_findings:
            match_val = f.get("match", "")
            full_value = match_val.replace("****", "")
            if f.get("verdict") == "example":
                pass
            elif is_demo_value(full_value) or value_is_placeholder(full_value):
                f["verdict"] = "example"
                f["severity"] = "low"
            else:
                f["verdict"] = "unknown"
        return idx, regex_findings

    processed = 0
    skipped_errors = 0
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS)

    batch_size = min(100, max(10, len(fetch_candidates) // 10 + 1))
    logger.info(f"Scanning {len(fetch_candidates)} files in batches of {batch_size} for {owner}/{repo}")

    for batch_start in range(0, len(fetch_candidates), batch_size):
        batch = fetch_candidates[batch_start:batch_start + batch_size]
        future_map = {
            executor.submit(fetch_and_analyze, idx, fe): idx
            for idx, fe in batch
        }
        done, _ = concurrent.futures.wait(future_map, timeout=SCAN_TIMEOUT)
        for future in done:
            try:
                idx, findings = future.result(timeout=5)
                if findings:
                    file_infos[idx]["issues"].extend(findings)
                    sensitive_files.append(file_infos[idx]["path"])
            except Exception as e:
                skipped_errors += 1
                logger.warning(f"File scan failed: {e}")
        processed += len(batch)
        if processed % 200 == 0:
            logger.info(f"Progress: {processed}/{len(fetch_candidates)} files scanned for {owner}/{repo}")

    executor.shutdown(wait=False)

    for fi in file_infos:
        fi["issue_count"] = len(fi["issues"])
    scanned_files = file_infos

    issues_found = sum(len(sf["issues"]) for sf in scanned_files)
    sensitive_files = [sf["path"] for sf in scanned_files if sf["issues"]]

    all_findings = []
    for sf in scanned_files:
        for iss in sf.get("issues", []):
            all_findings.append(iss)

    ai_verdicts = ai_repo_holistic_review(all_findings, [f["path"] for f in scanned_files])

    if ai_verdicts:
        ai_overrides = {}
        for v in ai_verdicts:
            key = (v.get("type", ""), v.get("match", ""), v.get("_file", ""))
            ai_overrides[key] = v.get("verdict", "")

        for sf in scanned_files:
            for iss in sf.get("issues", []):
                key = (iss.get("type", ""), iss.get("match", ""), sf["path"])
                if key in ai_overrides:
                    iss["verdict"] = ai_overrides[key]
                    if ai_overrides[key] == "example":
                        iss["severity"] = "low"
                    elif ai_overrides[key] == "real":
                        iss["severity"] = "critical" if "key" in iss.get("type","").lower() or "token" in iss.get("type","").lower() else "high"

    real_issues = sum(
        1 for sf in scanned_files for iss in sf.get("issues", [])
        if iss.get("verdict") not in ("example", "demo")
    )
    issues_found = real_issues
    sensitive_files = list(set(
        sf["path"] for sf in scanned_files
        for iss in sf.get("issues", [])
        if iss.get("verdict") not in ("example", "demo")
    ))
    score = calculate_security_score(real_issues, len(scanned_files), sensitive_files)

    ai_report = generate_ai_scan_report(scanned_files, {
        "total_files": len(scanned_files),
        "total_size_hr": format_size(total_size),
        "issues_found": real_issues,
        "real_issues": real_issues,
        "sensitive_files_count": len(sensitive_files),
        "score": score,
    }, [f["path"] for f in scanned_files[:50]])

    notes = []
    if total_file_count > MAX_FILES_TO_SCAN:
        notes.append(f"Repo has {total_file_count} files; scanned first {MAX_FILES_TO_SCAN}")
    elif total_file_count > 5000:
        notes.append(f"Large repo: {total_file_count} files scanned")
    if skipped_errors > 0:
        notes.append(f"{skipped_errors} files could not be fetched due to errors")

    summary = {
        "total_files": len(scanned_files),
        "total_size_bytes": total_size,
        "total_size_hr": format_size(total_size),
        "issues_found": issues_found,
        "real_issues": real_issues,
        "sensitive_files_count": len(set(sensitive_files)),
        "large_files_count": len(large_files),
        "score": score,
        "secure": score >= 80 if real_issues == 0 else real_issues < 5,
    }
    if notes:
        summary["note"] = "; ".join(notes)

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
    base -= issues * 8
    base -= len(set(sensitive_files)) * 5
    return max(0, min(100, base))

def format_size(bytes_val: int):
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes_val < 1024:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f} TB"
