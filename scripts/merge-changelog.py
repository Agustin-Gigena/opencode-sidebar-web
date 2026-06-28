#!/usr/bin/env python3
"""Merge new unreleased entries into a changelog file.

Usage: python3 merge-changelog.py <new_entries_file> <changelog_file>
"""
import re
import sys

new_entries_file = sys.argv[1]
changelog_file = sys.argv[2]

with open(new_entries_file) as f:
    content = f.read().strip()

lines = content.split("\n")
if lines and lines[0].startswith("## ["):
    lines = lines[1:]
if lines and lines[0].strip() == "":
    lines = lines[1:]
new_entries = "\n".join(lines).strip()

if not new_entries:
    print(f"No new entries to add to {changelog_file}")
    sys.exit(0)

with open(changelog_file) as f:
    content = f.read()

parts = content.split("##", 1)
header = parts[0]

if len(parts) > 1:
    rest = "##" + parts[1]
    rest = re.sub(
        r"^## \[Unreleased\].*?(?=^## |\Z)",
        "",
        rest,
        flags=re.MULTILINE | re.DOTALL,
    )
else:
    rest = ""

with open(changelog_file, "w") as f:
    f.write(header)
    f.write("## [Unreleased]\n\n")
    f.write(new_entries + "\n\n")
    f.write(rest)

print(f"{changelog_file} merged successfully")
