#!/usr/bin/env python3
"""Reject outbound mail providers and SMTP relay settings in the API contract repository."""
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SELF = "scripts/guard-native-mail-ownership.py"
POLICY = "docs/architecture/native-mail-ownership.md"
HISTORICAL_LOCK = "docs/integration/locked-seven-repository-acceptance.md"
PROVIDER = re.compile(r"mail[\s._-]*jet|api[.]mailjet[.]com", re.IGNORECASE)
RETIRED = re.compile(
    r"\b(?:MAILJET_API_KEY|MAILJET_SECRET_KEY|SMTP_HOST|SMTP_USERNAME|SMTP_PASSWORD|"
    r"CLOUDFLARE_EMAIL_ACCOUNT_ID|CLOUDFLARE_EMAIL_API_TOKEN|AUTH_FROM_EMAIL)\b"
)

def main():
    files = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True).stdout.split(b"\0")
    violations = []
    for item in files:
        if not item:
            continue
        relative = item.decode()
        if relative in {SELF, POLICY, HISTORICAL_LOCK}:
            continue
        try:
            content = (ROOT / relative).read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if PROVIDER.search(content) or RETIRED.search(content):
            violations.append(relative)
    if violations:
        print("Forbidden mail provider/relay reference:", file=sys.stderr)
        for item in violations:
            print(f" - {item}", file=sys.stderr)
        return 1
    print("API contract repository respects Backend-owned native mail.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
