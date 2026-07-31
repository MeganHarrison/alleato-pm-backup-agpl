---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git push:*), Bash(git commit:*), Bash(git diff:*), Bash(git log:*)
description: Git add, commit, and push all changes to the current branch
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`

## Your task

Based on the above changes:
1. Stage all changed files with `git add` (use specific files, not `-A` or `.`)
2. Create a single commit with a clear, descriptive message in imperative mood
3. Push to origin on the current branch
4. Show the result with `git log --oneline -n 1`
5. You MUST do all of the above in a single message. Do not use any other tools or do anything else.

## Important:
- **NEVER add co-author information or Claude attribution**
- Do not include any "Generated with Claude" messages
- Do not add "Co-Authored-By" lines
- Write commit messages as if the user wrote them
- If on `main`, warn the user and ask before proceeding
