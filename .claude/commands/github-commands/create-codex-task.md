# Create Codex Task

**Command:** `/codex-task`

**Description:** Create a GitHub issue that automatically triggers Codex execution in the cloud.

**Usage:**
```
/codex-task
```

**What This Does:**
1. Prompts you for task details (interactive)
2. Creates a GitHub issue with proper formatting
3. Auto-labels the issue with 'codex' (triggers workflow)
4. Returns the issue URL

**Behind the Scenes:**
- Uses GitHub CLI (`gh`) to create the issue
- Applies appropriate template based on task type
- Auto-triggers `.github/workflows/codex-issue-handler.yml`
- Codex executes in GitHub Actions cloud (no local resources)

**Prerequisites:**
- GitHub CLI installed: `brew install gh` (macOS) or [gh installation](https://cli.github.com/)
- Authenticated: `gh auth login`

**Flow:**
```
You run: /codex-task
  ↓
Interactive prompts collect task details
  ↓
GitHub issue created with 'codex' label
  ↓
Workflow auto-triggers in cloud
  ↓
Codex implements task → Creates PR
  ↓
Codex PR Review validates changes
  ↓
You review and merge
```

**Example Session:**
```
$ /codex-task

🤖 Create Codex Task

Task type:
  1. Feature
  2. Bug
  3. Refactor
  4. Tests
  5. Migration
  6. Documentation

Choose (1-6): 1

Title: Add user profile page

Target path: frontend/src/app/[projectId]/profile/

Description:
> Create user profile page with:
> - Display user info (name, email, role)
> - Edit profile form
> - Avatar upload
> - Audit log of user actions
>
> Follow existing page patterns in [projectId]/
> (Press Enter twice to finish)

Creating issue... ✓

Issue created: https://github.com/user/repo/issues/123
Codex will start automatically (watch for comments on issue)

Branch will be: codex/issue-123-feature
```

**Advanced: Batch Tasks**

Create multiple issues at once:
```bash
# From scripts/create-codex-task.sh
./scripts/create-codex-task.sh --batch tasks.json
```

**Monitoring:**
- Watch issue comments for status updates
- Codex comments when starting, on completion, or on failure
- PR link will be posted to issue when ready

**Troubleshooting:**

Issue not auto-triggering?
- Check issue has 'codex' label
- Check GitHub Actions tab for workflow runs
- Verify `OPENAI_API_KEY` secret is set

Workflow failing?
- Check Actions logs: https://github.com/USER/REPO/actions
- Common issues documented in `.github/CODEX-CLOUD-TASKS-GUIDE.md`

**See Also:**
- `.github/CODEX-QUICK-START.md` - Quick reference
- `.github/CODEX-CLOUD-TASKS-GUIDE.md` - Comprehensive guide
- `scripts/create-codex-task.sh` - Direct script usage
