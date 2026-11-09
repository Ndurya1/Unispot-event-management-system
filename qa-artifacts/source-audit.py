"""Redacted source/history scan. Outputs locations only, never matched values."""
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
files = subprocess.check_output(["git", "ls-files"], cwd=root, text=True).splitlines()
patterns = {
    "private_key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "aws_access_key": r"AKIA[A-Z0-9]{16}",
    "github_token": r"gh[pousr]_[A-Za-z0-9_]{30,}",
    "provider_key": r"\bsk-[A-Za-z0-9_-]{32,}",
}
matches = []
for filename in files:
    if Path(filename).suffix.lower() in (".jpg", ".png", ".jpeg", ".webp"):
        continue
    content = (root / filename).read_text(encoding="utf-8", errors="replace")
    for name, pattern in patterns.items():
        for match in re.finditer(pattern, content):
            matches.append({"path": filename, "line": content.count("\n", 0, match.start()) + 1, "pattern": name})
history = subprocess.check_output(["git", "log", "--all", "--format=", "-p", "--", ".", ":(exclude)*lock*"], cwd=root, text=True, encoding="utf-8", errors="replace")
result = {
    "tracked_files": len(files), "current_tree_matches": matches,
    "history_pattern_counts": {name: len(re.findall(pattern, history)) for name, pattern in patterns.items()},
    "tracked_environment_files": [f for f in files if Path(f).name.startswith(".env")],
    "limitations": "Pattern-only scan; excludes lockfiles from history; does not prove absence of secrets. Local .env contents not exported.",
}
(root / "qa-artifacts/source-audit.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
