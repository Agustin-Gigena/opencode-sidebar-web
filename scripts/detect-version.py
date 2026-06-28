#!/usr/bin/env python3
import re
import subprocess
import sys
import os

changelog_file = sys.argv[1] if len(sys.argv) > 1 else "CHANGELOG.md"

with open(changelog_file) as f:
    content = f.read()

match = re.search(
    r"^##\s*\[Unreleased\].*?^##\s*\[(\d+\.\d+\.\d+)\]",
    content,
    re.MULTILINE | re.DOTALL,
)

if not match:
    print("No version found in CHANGELOG.md, using git tags")
    sys.exit(0)

version = match.group(1)
tag = f"v{version}"
print(f"Latest version from CHANGELOG.md: {tag}")

result = subprocess.run(["git", "tag", "-l", tag], capture_output=True, text=True)
tag_exists = bool(result.stdout.strip())

if not tag_exists:
    print(f"Tag {tag} not found, creating temporary tag")
    result = subprocess.run(
        ["git", "log", "--format=%H", "--diff-filter=M", "--", changelog_file],
        capture_output=True, text=True,
    )
    commits = result.stdout.strip().split("\n")
    commit = commits[0] if commits and commits[0] else "HEAD"
    subprocess.run(["git", "tag", tag, commit])
    print(f"Temporary tag {tag} created at {commit}")

    env_file = os.environ.get("GITHUB_ENV")
    if env_file:
        with open(env_file, "a") as f:
            f.write(f"CREATED_TAG=true\nTAG_VERSION={tag}\n")
else:
    print(f"Tag {tag} already exists")
