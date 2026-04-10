#!/bin/bash
# CLAUDEMAX Skill Creator — scaffold a new skill
NAME="${1:?Usage: init_skill.sh <skill-name>}"
DIR="$HOME/claudemax/skills/$NAME"
mkdir -p "$DIR"
cat > "$DIR/SKILL.md" << EOF
---
name: $NAME
description: |
  Custom CLAUDEMAX skill for $NAME
---
# $NAME

## Usage
Describe how this skill works.

## Steps
1. Step one
2. Step two
EOF
echo "Skill created at $DIR/SKILL.md"
