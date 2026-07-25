import re
import json
import os
import fnmatch
import requests
from urllib.parse import urlparse
from services.logger import logger

try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

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
    (r'(?i)(?:private[_-]?key|-----BEGIN\s*(?:RSA\s*)?PRIVATE KEY-----)', "Private Key"),
    (r'(?i)(?:jdbc|mongodb|postgresql|mysql)://[^"\'\s]+:[^"\'\s]+@', "Database Connection String"),
]

SENSITIVE_FILENAMES = [
    ".env", ".env.local", ".env.production", ".env.development",
    ".env.staging", ".env.test", ".env.example",
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

LARGE_FILE_THRESHOLD = 500 * 1024

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
    url = f"https://raw.githubusercontent.com/{owner}/{repo}/master/{path}"
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 404:
            url = f"https://raw.githubusercontent.com/{owner}/{repo}/main/{path}"
            resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            return resp.text
        return None
    except Exception as e:
        logger.error(f"Failed to fetch file {path}: {e}")
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
    "your-password", "your_password_here", "password123", "admin123", "test123"}

def is_false_positive(match: str, label: str) -> bool:
    match_lower = match.lower().strip()

    if COMMENT_RE.match(match_lower):
        return True

    if re.match(r'\b(password|passwd|pwd|token|bearer)\s*:\s*(?:str|string|bytes|int|bool|float)', match_lower):
        return True

    if "=" in match_lower:
        value = match_lower.split("=", 1)[1].strip()
        if value.startswith(("'", '"', "`")):
            clean_value = value.strip("\"'`")
            if clean_value.lower() in PLACEHOLDER_VALUES:
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
    for pattern, label in SENSITIVE_PATTERNS:
        for match_obj in re.finditer(pattern, content):
            match = match_obj.group()
            if is_false_positive(match[:40], label):
                continue
            line_num = content[:match_obj.start()].count("\n") + 1
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

def ai_analyze_file(filename: str, content: str):
    if not OLLAMA_AVAILABLE or not content or len(content) > 10000:
        return []
    prompt = f"""Analyze this file for security issues. File: {filename}
Content:
{content[:2000]}

List any exposed API keys, secrets, tokens, passwords, or sensitive data.
Return ONLY a JSON array of objects with keys: type, severity (critical/high/medium/low), match (first 20 chars masked).
If nothing found, return empty array [].
"""
    try:
        response = ollama.chat(
            model='llama3',
            messages=[{'role': 'user', 'content': prompt}],
            format='json'
        )
        result = json.loads(response['message']['content'])
        if isinstance(result, list):
            for item in result:
                item.setdefault("line", None)
            return result
        return []
    except Exception as e:
        logger.error(f"AI analysis failed for {filename}: {e}")
        return []

def scan_github_repo(github_url: str, use_ollama: bool = False):
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
            "error": "Could not fetch repository. Make sure it exists and is public.",
            "files": [],
            "summary": {}
        }

    scanned_files = []
    issues_found = 0
    total_size = repo_size_bytes if repo_size_bytes else 0
    use_repo_total = repo_size_bytes is not None
    sensitive_files = []
    large_files = []

    TEXT_EXTENSIONS = {'.py','.js','.ts','.jsx','.tsx','.json','.yaml','.yml','.env','.cfg','.conf','.ini','.xml','.toml','.sh','.bash','.zsh','.ps1','.bat','.cmd','.sql','.rb','.php','.go','.rs','.java','.kt','.swift','.c','.cpp','.h','.hpp','.cs','.fs','.lua','.pl','.pm','.r','.scala','.clj','.coffee','.tf','.tfvars','.dockerfile','.dockerignore','.gitignore','.gitconfig','.npmrc','.netrc','.htaccess','.htpasswd','.env.example','.env.local','.env.production','.env.development','.sops.yaml','.age.key','Makefile','Dockerfile','gradle','properties','pem','key','cert','p12','pfx','config','md','rst','txt','html','css','scss','less','svg','vue','svelte','astro'}
    content_fetched = 0
    MAX_CONTENT_FETCH = 200

    for file in files:
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

        ext = os.path.splitext(path)[1].lower()
        base = os.path.basename(path)
        should_fetch = (
            ext in TEXT_EXTENSIONS
            or base in TEXT_EXTENSIONS
            or check_sensitive_filename(path)
            or size < LARGE_FILE_THRESHOLD
        ) and content_fetched < MAX_CONTENT_FETCH

        if should_fetch and size < 5 * 1024 * 1024:
            content = fetch_file_content(owner, repo, path)
            content_fetched += 1
            if content:
                secret_findings = check_content_for_secrets(content, path)
                file_info["issues"].extend(secret_findings)
                if secret_findings:
                    sensitive_files.append(path)

                if use_ollama:
                    ai_findings = ai_analyze_file(path, content)
                    for af in ai_findings:
                        if not any(f["type"] == af["type"] and f["match"] == af["match"] for f in file_info["issues"]):
                            file_info["issues"].append(af)
                            sensitive_files.append(path)

        file_info["issue_count"] = len(file_info["issues"])
        issues_found += file_info["issue_count"]
        scanned_files.append(file_info)

    score = calculate_security_score(issues_found, len(scanned_files), sensitive_files)

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

    return {
        "status": "completed",
        "summary": summary,
        "files": scanned_files,
        "sensitive_files": list(set(sensitive_files)),
        "large_files": large_files,
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
