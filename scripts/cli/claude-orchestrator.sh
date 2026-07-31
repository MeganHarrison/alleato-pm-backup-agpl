#!/bin/bash

# Claude Code Multi-Project Orchestrator
# PURPOSE: Track and coordinate multiple Claude Code sessions across terminals
# MODE: User-facing tool - YOU run Claude Code manually, this tracks state
#
# This script does NOT spawn Claude sessions. It:
# - Tracks which project each terminal is working on
# - Prevents conflicts (two terminals on same project)
# - Manages task state for worker/verifier handoffs
# - Provides a dashboard of all activity

set -euo pipefail
IFS=$'\n\t'

# Configuration
CLAUDE_DIR=".claude"
PROJECTS_DIR="$CLAUDE_DIR/projects"
ACTIVE_SESSIONS_FILE="$CLAUDE_DIR/active-sessions.md"
DOCS_DIR="playwright-procore-crawl/procore-crawls"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Valid projects (must match folder names)
VALID_PROJECTS=("change-events" "change-orders" "direct-costs" "directory" "forms")

# ============================================
# PLATFORM DETECTION & UTILITIES
# ============================================

# Cross-platform sed in-place
sed_inplace() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# Generate unique IDs without openssl dependency
generate_session_id() {
    local random_part
    if command -v uuidgen &>/dev/null; then
        random_part=$(uuidgen | cut -d- -f1 | tr '[:upper:]' '[:lower:]')
    else
        random_part=$(od -An -N4 -tx /dev/urandom 2>/dev/null | tr -d ' ' || echo "$$")
    fi
    echo "session-$(date +%Y%m%d-%H%M%S)-$random_part"
}

generate_task_id() {
    local random_part
    if command -v uuidgen &>/dev/null; then
        random_part=$(uuidgen | cut -d- -f1 | tr '[:upper:]' '[:lower:]')
    else
        random_part=$(od -An -N4 -tx /dev/urandom 2>/dev/null | tr -d ' ' || echo "$$")
    fi
    echo "task-$(date +%Y%m%d-%H%M%S)-$random_part"
}

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1" >&2; }

validate_project() {
    local project="$1"
    for valid in "${VALID_PROJECTS[@]}"; do
        if [[ "$valid" == "$project" ]]; then
            return 0
        fi
    done
    log_error "Invalid project: $project"
    echo "Valid projects: ${VALID_PROJECTS[*]}"
    return 1
}

# Check if project is locked by another process
check_project_locked() {
    local project="$1"
    local session_file="$PROJECTS_DIR/$project/current-session.md"

    if [[ -f "$session_file" ]]; then
        local session_pid
        session_pid=$(grep "PID:" "$session_file" 2>/dev/null | cut -d: -f2 | tr -d ' ' || echo "")
        if [[ -n "$session_pid" ]] && ps -p "$session_pid" > /dev/null 2>&1; then
            return 0  # Project is locked by active process
        fi
        # PID no longer exists - stale session
        return 1
    fi
    return 1  # No session file - project is available
}

# ============================================
# INITIALIZATION
# ============================================

init() {
    log_info "Initializing Claude Code multi-project orchestrator..."

    # Create main directories
    mkdir -p "$PROJECTS_DIR"

    # Create project folders if they don't exist
    for project in "${VALID_PROJECTS[@]}"; do
        mkdir -p "$PROJECTS_DIR/$project"/{tasks,sessions,results}
    done

    # Create active sessions file
    update_active_sessions

    log_success "Orchestrator initialized"
    log_info "Project folders created in $PROJECTS_DIR"
    echo ""
    echo "Next steps:"
    echo "  1. Open a terminal for each project you want to work on"
    echo "  2. In each terminal, run: $0 start --project <name>"
    echo "  3. Then start Claude Code manually: claude"
    echo "  4. When done, run: $0 end --project <name>"
}

# ============================================
# SESSION MANAGEMENT
# ============================================

start_session() {
    local project="${1:-}"

    if [[ -z "$project" ]]; then
        log_error "Project name required"
        echo "Usage: $0 start --project <project-name>"
        echo "Available: ${VALID_PROJECTS[*]}"
        return 1
    fi

    validate_project "$project" || return 1

    # Check if project is already locked
    if check_project_locked "$project"; then
        log_error "Project '$project' already has an active session!"
        echo ""
        cat "$PROJECTS_DIR/$project/current-session.md"
        echo ""
        log_warning "Wait for the other session to end, or use 'force-release' if it's stale"
        return 1
    fi

    # Clean up stale session file if exists
    if [[ -f "$PROJECTS_DIR/$project/current-session.md" ]]; then
        mv "$PROJECTS_DIR/$project/current-session.md" \
           "$PROJECTS_DIR/$project/sessions/stale-$(date +%Y%m%d-%H%M%S).md" 2>/dev/null || true
    fi

    local session_id
    session_id=$(generate_session_id)
    local timestamp
    timestamp=$(date -Iseconds)
    local terminal_id="${TERM_SESSION_ID:-$$}"

    # Create current session file
    cat > "$PROJECTS_DIR/$project/current-session.md" << EOF
# Active Session: $project

**Session ID:** $session_id
**Started:** $timestamp
**Terminal:** $terminal_id
**PID:** $$

## Instructions

1. Start Claude Code in this terminal: \`claude\`
2. Read the project's task file:
   - \`playwright-procore-crawl/procore-crawls/$project/TASKS*.md\`
3. Work on the next uncompleted task
4. Run quality checks after every change:
   \`\`\`bash
   npm run quality --prefix frontend
   \`\`\`
5. When done, end the session:
   \`\`\`bash
   ./scripts/claude-orchestrator.sh end --project $project
   \`\`\`

## Progress Log
- **$timestamp** - Session started

## Notes
(Add notes as you work)
EOF

    # Update active sessions dashboard
    update_active_sessions

    log_success "Session registered for project: $project"
    log_info "Session ID: $session_id"
    echo ""
    echo -e "${BOLD}Now start Claude Code:${NC}"
    echo "  claude"
    echo ""
    echo -e "${BOLD}Project files:${NC}"
    echo "  Config:  $PROJECTS_DIR/$project/project.md"
    echo "  Tasks:   $DOCS_DIR/$project/"
    echo "  Session: $PROJECTS_DIR/$project/current-session.md"
    echo ""
    echo -e "${BOLD}When finished:${NC}"
    echo "  $0 end --project $project"
}

end_session() {
    local project="${1:-}"

    if [[ -z "$project" ]]; then
        log_error "Project name required"
        return 1
    fi

    validate_project "$project" || return 1

    local session_file="$PROJECTS_DIR/$project/current-session.md"

    if [[ ! -f "$session_file" ]]; then
        log_warning "No active session found for project: $project"
        return 0
    fi

    local timestamp
    timestamp=$(date -Iseconds)
    local session_id
    session_id=$(grep "Session ID:" "$session_file" 2>/dev/null | cut -d: -f2 | tr -d ' *' | head -1 || echo "unknown")

    # Add end timestamp to session
    echo "" >> "$session_file"
    echo "## Session Ended" >> "$session_file"
    echo "- **Ended:** $timestamp" >> "$session_file"

    # Archive to sessions folder
    cp "$session_file" "$PROJECTS_DIR/$project/sessions/$session_id.md" 2>/dev/null || true

    # Remove current session
    rm -f "$session_file"

    # Update active sessions
    update_active_sessions

    log_success "Session ended for project: $project"
    log_info "Session archived: $PROJECTS_DIR/$project/sessions/$session_id.md"
}

force_release() {
    local project="${1:-}"

    if [[ -z "$project" ]]; then
        log_error "Project name required"
        return 1
    fi

    validate_project "$project" || return 1

    local session_file="$PROJECTS_DIR/$project/current-session.md"

    if [[ -f "$session_file" ]]; then
        local timestamp
        timestamp=$(date -Iseconds)
        echo "" >> "$session_file"
        echo "## FORCE RELEASED" >> "$session_file"
        echo "- **Released:** $timestamp" >> "$session_file"
        echo "- **Reason:** Manual force release" >> "$session_file"

        mv "$session_file" "$PROJECTS_DIR/$project/sessions/force-released-$(date +%Y%m%d-%H%M%S).md"

        update_active_sessions
        log_success "Project '$project' force released"
    else
        log_info "No active session to release for: $project"
    fi
}

update_active_sessions() {
    local timestamp
    timestamp=$(date -Iseconds)

    cat > "$ACTIVE_SESSIONS_FILE" << EOF
# Active Claude Code Sessions

**Last Updated:** $timestamp

## Current Sessions

| Project | Session ID | Started | PID |
|---------|------------|---------|-----|
EOF

    local has_sessions=false

    for project in "${VALID_PROJECTS[@]}"; do
        local session_file="$PROJECTS_DIR/$project/current-session.md"
        if [[ -f "$session_file" ]]; then
            has_sessions=true
            local session_id started pid
            session_id=$(grep "Session ID:" "$session_file" 2>/dev/null | cut -d: -f2 | tr -d ' *' | head -1 || echo "-")
            started=$(grep "Started:" "$session_file" 2>/dev/null | head -1 | cut -d: -f2- | tr -d ' *' || echo "-")
            pid=$(grep "PID:" "$session_file" 2>/dev/null | cut -d: -f2 | tr -d ' ' || echo "-")
            echo "| **$project** | $session_id | $started | $pid |" >> "$ACTIVE_SESSIONS_FILE"
        fi
    done

    if [[ "$has_sessions" == "false" ]]; then
        echo "| - | No active sessions | - | - |" >> "$ACTIVE_SESSIONS_FILE"
    fi

    cat >> "$ACTIVE_SESSIONS_FILE" << EOF

## Project Availability

| Project | Status | Task File |
|---------|--------|-----------|
EOF

    for project in "${VALID_PROJECTS[@]}"; do
        local status="Available"
        if [[ -f "$PROJECTS_DIR/$project/current-session.md" ]]; then
            status="**In Use**"
        fi
        echo "| $project | $status | $DOCS_DIR/$project/ |" >> "$ACTIVE_SESSIONS_FILE"
    done
}

# ============================================
# TASK MANAGEMENT (for worker/verifier handoffs)
# ============================================

create_task() {
    local project="${1:-}"
    local description="${2:-}"
    local test_command="${3:-npm run quality --prefix frontend}"

    if [[ -z "$project" ]] || [[ -z "$description" ]]; then
        log_error "Project and description required"
        echo "Usage: $0 create-task --project <project> --desc \"Task description\" [--test \"test command\"]"
        return 1
    fi

    validate_project "$project" || return 1

    local task_id
    task_id=$(generate_task_id)
    local timestamp
    timestamp=$(date -Iseconds)

    # Escape description for safe inclusion (prevent shell injection)
    local safe_description
    safe_description=$(printf '%s' "$description" | sed 's/[`$]/\\&/g')

    cat > "$PROJECTS_DIR/$project/tasks/$task_id.md" << EOF
# Task: $task_id

**Project:** $project
**Created:** $timestamp
**Status:** Pending

## Description
$safe_description

## Test Command
\`\`\`bash
$test_command
\`\`\`

## Acceptance Criteria
- [ ] Implementation complete
- [ ] Quality gate passes: \`npm run quality --prefix frontend\`
- [ ] Feature tests pass: \`npx playwright test --grep "$project"\`
- [ ] Verified by independent session

## Worker Instructions
When you complete this task, create a file:
\`$PROJECTS_DIR/$project/worker-done-$task_id.md\`

With contents:
- Files modified
- Summary of changes
- Quality check output (paste actual output)
- Ready for verification: YES/NO

## Verifier Instructions
1. Do NOT trust the worker's claims
2. Actually run: \`npm run quality --prefix frontend\`
3. Actually run: \`npx playwright test --grep "$project"\`
4. Check each acceptance criterion with evidence
5. Create: \`$PROJECTS_DIR/$project/results/verified-$task_id.md\`

## Progress Log
- **$timestamp** - Task created
EOF

    log_success "Task created: $task_id"
    echo "Task file: $PROJECTS_DIR/$project/tasks/$task_id.md"
}

mark_worker_done() {
    local project="${1:-}"
    local task_id="${2:-}"

    if [[ -z "$project" ]] || [[ -z "$task_id" ]]; then
        log_error "Project and task ID required"
        echo "Usage: $0 worker-done --project <project> --task <task-id>"
        return 1
    fi

    validate_project "$project" || return 1

    local task_file="$PROJECTS_DIR/$project/tasks/$task_id.md"
    if [[ ! -f "$task_file" ]]; then
        log_error "Task not found: $task_file"
        return 1
    fi

    local timestamp
    timestamp=$(date -Iseconds)

    # Update task status
    sed_inplace 's/Status: Pending/Status: Worker Complete/' "$task_file"

    # Create worker-done signal file
    cat > "$PROJECTS_DIR/$project/worker-done-$task_id.md" << EOF
# Worker Complete: $task_id

**Completed:** $timestamp

## Instructions for Worker
Edit this file to add:

### Files Modified
- (list files you changed)

### Summary of Changes
(describe what you did)

### Quality Check Output
\`\`\`
(paste output of: npm run quality --prefix frontend)
\`\`\`

### Ready for Verification
YES / NO (delete one)

---
After filling this out, a verifier session can check your work.
EOF

    log_success "Worker completion signaled for: $task_id"
    echo "Edit this file to add details: $PROJECTS_DIR/$project/worker-done-$task_id.md"
    echo ""
    echo "Then tell the verifier session to run:"
    echo "  $0 verify-task --project $project --task $task_id"
}

verify_task() {
    local project="${1:-}"
    local task_id="${2:-}"

    if [[ -z "$project" ]] || [[ -z "$task_id" ]]; then
        log_error "Project and task ID required"
        echo "Usage: $0 verify-task --project <project> --task <task-id>"
        return 1
    fi

    validate_project "$project" || return 1

    local worker_done="$PROJECTS_DIR/$project/worker-done-$task_id.md"
    if [[ ! -f "$worker_done" ]]; then
        log_error "Worker has not signaled completion"
        echo "Expected file: $worker_done"
        echo "Worker should run: $0 worker-done --project $project --task $task_id"
        return 1
    fi

    local timestamp
    timestamp=$(date -Iseconds)
    local result_file="$PROJECTS_DIR/$project/results/verified-$task_id.md"

    # Create verification template
    cat > "$result_file" << EOF
# Verification Report: $task_id

**Verifier Session:** (your session)
**Timestamp:** $timestamp

## Pre-Verification Checklist
- [ ] Read the original task: \`$PROJECTS_DIR/$project/tasks/$task_id.md\`
- [ ] Read worker's claims: \`$worker_done\`
- [ ] Did NOT participate in implementation (fresh context)

## Quality Gate
Run: \`npm run quality --prefix frontend\`

\`\`\`
(paste actual output here)
\`\`\`

Result: PASS / FAIL

## Feature Tests
Run: \`npx playwright test --grep "$project"\`

\`\`\`
(paste actual output here)
\`\`\`

Result: PASS / FAIL (X passed, Y failed)

## Acceptance Criteria Check
For each criterion in the task file, verify with evidence:

1. Implementation complete: MET / NOT MET
   Evidence: (what you checked)

2. Quality gate passes: MET / NOT MET
   Evidence: (output above)

3. Feature tests pass: MET / NOT MET
   Evidence: (output above)

## Issues Found
- (list any issues)

## Final Verdict
**VERIFIED** / **FAILED**

(If FAILED, explain what needs to be fixed)
EOF

    log_success "Verification template created: $result_file"
    echo ""
    echo "Instructions:"
    echo "  1. Open Claude Code (if not already): claude"
    echo "  2. Read the task file and worker claims"
    echo "  3. Actually run the test commands"
    echo "  4. Fill out the verification report: $result_file"
    echo "  5. Mark final verdict as VERIFIED or FAILED"
}

show_task() {
    local project="${1:-}"
    local task_id="${2:-}"

    if [[ -z "$project" ]] || [[ -z "$task_id" ]]; then
        log_error "Project and task ID required"
        return 1
    fi

    local task_file="$PROJECTS_DIR/$project/tasks/$task_id.md"
    if [[ -f "$task_file" ]]; then
        cat "$task_file"
    else
        log_error "Task not found: $task_file"
    fi
}

list_tasks() {
    local project="${1:-}"

    if [[ -z "$project" ]]; then
        # List all tasks across all projects
        for p in "${VALID_PROJECTS[@]}"; do
            local tasks_dir="$PROJECTS_DIR/$p/tasks"
            if [[ -d "$tasks_dir" ]] && [[ -n "$(ls -A "$tasks_dir" 2>/dev/null)" ]]; then
                echo -e "${BOLD}$p:${NC}"
                for task in "$tasks_dir"/*.md; do
                    if [[ -f "$task" ]]; then
                        local tid
                        tid=$(basename "$task" .md)
                        local status
                        status=$(grep "Status:" "$task" 2>/dev/null | cut -d: -f2 | tr -d ' *' || echo "Unknown")
                        echo "  - $tid ($status)"
                    fi
                done
                echo ""
            fi
        done
    else
        validate_project "$project" || return 1
        local tasks_dir="$PROJECTS_DIR/$project/tasks"
        if [[ -d "$tasks_dir" ]] && [[ -n "$(ls -A "$tasks_dir" 2>/dev/null)" ]]; then
            for task in "$tasks_dir"/*.md; do
                if [[ -f "$task" ]]; then
                    local tid
                    tid=$(basename "$task" .md)
                    local status
                    status=$(grep "Status:" "$task" 2>/dev/null | cut -d: -f2 | tr -d ' *' || echo "Unknown")
                    echo "$tid ($status)"
                fi
            done
        else
            echo "No tasks found for $project"
        fi
    fi
}

# ============================================
# DASHBOARD
# ============================================

dashboard() {
    echo ""
    echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}         Claude Code Multi-Project Dashboard                 ${NC}"
    echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo ""

    echo -e "${BOLD}Active Sessions${NC}"
    echo "─────────────────────────────────────────────────────────────"

    local has_sessions=false
    for project in "${VALID_PROJECTS[@]}"; do
        local session_file="$PROJECTS_DIR/$project/current-session.md"
        if [[ -f "$session_file" ]]; then
            has_sessions=true
            local session_id started pid is_active
            session_id=$(grep "Session ID:" "$session_file" 2>/dev/null | cut -d: -f2 | tr -d ' *' | head -1 || echo "-")
            started=$(grep "Started:" "$session_file" 2>/dev/null | head -1 | cut -d: -f2- | tr -d ' *' || echo "-")
            pid=$(grep "PID:" "$session_file" 2>/dev/null | cut -d: -f2 | tr -d ' ' || echo "")

            if [[ -n "$pid" ]] && ps -p "$pid" > /dev/null 2>&1; then
                is_active="${GREEN}active${NC}"
            else
                is_active="${YELLOW}stale?${NC}"
            fi

            echo -e "  ${GREEN}●${NC} ${BOLD}$project${NC} ($is_active)"
            echo "    Session: $session_id"
            echo "    Started: $started"
            echo ""
        fi
    done

    if [[ "$has_sessions" == "false" ]]; then
        echo -e "  ${YELLOW}○${NC} No active sessions"
        echo ""
    fi

    echo -e "${BOLD}Available Projects${NC}"
    echo "─────────────────────────────────────────────────────────────"

    for project in "${VALID_PROJECTS[@]}"; do
        local status="${GREEN}Available${NC}"
        if [[ -f "$PROJECTS_DIR/$project/current-session.md" ]]; then
            status="${RED}In Use${NC}"
        fi
        echo -e "  • $project: $status"
    done
    echo ""

    # Show pending tasks
    echo -e "${BOLD}Pending Tasks${NC}"
    echo "─────────────────────────────────────────────────────────────"

    local has_tasks=false
    for project in "${VALID_PROJECTS[@]}"; do
        local tasks_dir="$PROJECTS_DIR/$project/tasks"
        if [[ -d "$tasks_dir" ]] && [[ -n "$(ls -A "$tasks_dir" 2>/dev/null)" ]]; then
            local pending=0
            local worker_done=0
            pending=$(grep -l "Status: Pending" "$tasks_dir"/*.md 2>/dev/null | wc -l | tr -d ' ' || echo "0")
            worker_done=$(grep -l "Status: Worker Complete" "$tasks_dir"/*.md 2>/dev/null | wc -l | tr -d ' ' || echo "0")
            if [[ "$pending" -gt 0 ]] || [[ "$worker_done" -gt 0 ]]; then
                has_tasks=true
                echo "  $project: $pending pending, $worker_done awaiting verification"
            fi
        fi
    done
    if [[ "$has_tasks" == "false" ]]; then
        echo "  No pending tasks"
    fi
    echo ""

    echo -e "${BOLD}Quick Commands${NC}"
    echo "─────────────────────────────────────────────────────────────"
    echo "  Start:  $0 start --project <name>"
    echo "  End:    $0 end --project <name>"
    echo "  Tasks:  $0 list-tasks [--project <name>]"
    echo ""
}

# ============================================
# HELP
# ============================================

show_help() {
    cat << EOF

${BOLD}Claude Code Multi-Project Orchestrator${NC}

Tracks and coordinates multiple Claude Code sessions across terminals.
This tool does NOT spawn Claude sessions - you run Claude manually.

${BOLD}Usage:${NC} $0 <command> [options]

${BOLD}Session Commands:${NC}
  init                              Initialize orchestrator
  start --project <name>            Register this terminal for a project
  end --project <name>              End session and release project
  force-release --project <name>    Force release a stuck project
  dashboard                         Show all sessions and projects

${BOLD}Task Commands (for worker/verifier handoffs):${NC}
  create-task --project <name> --desc "..." [--test "..."]
                                    Create a tracked task
  worker-done --project <name> --task <id>
                                    Signal worker completion
  verify-task --project <name> --task <id>
                                    Start verification process
  list-tasks [--project <name>]     List all tasks
  show-task --project <name> --task <id>
                                    Show task details

${BOLD}Available Projects:${NC}
EOF
    for project in "${VALID_PROJECTS[@]}"; do
        echo "  - $project"
    done

    cat << EOF

${BOLD}Typical Workflow:${NC}

  # Terminal 1: Work on change-events
  $0 start --project change-events
  claude                            # Start Claude Code manually
  # ... do your work ...
  $0 end --project change-events

  # Terminal 2: Work on direct-costs (at the same time)
  $0 start --project direct-costs
  claude
  # ... do your work ...
  $0 end --project direct-costs

${BOLD}Worker/Verifier Pattern:${NC}

  # Worker session creates and completes a task
  $0 create-task --project change-events --desc "Implement GET endpoint"
  # ... implement in Claude Code ...
  $0 worker-done --project change-events --task task-xxx

  # Verifier session (different terminal, fresh context) checks work
  $0 verify-task --project change-events --task task-xxx
  # ... verify in Claude Code, fill out report ...

EOF
}

# ============================================
# MAIN
# ============================================

# Parse arguments
PROJECT=""
TASK=""
DESC=""
TEST_CMD=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --project|-p)
            PROJECT="${2:-}"
            shift 2 || { log_error "--project requires a value"; exit 1; }
            ;;
        --task|-t)
            TASK="${2:-}"
            shift 2 || { log_error "--task requires a value"; exit 1; }
            ;;
        --desc|-d)
            DESC="${2:-}"
            shift 2 || { log_error "--desc requires a value"; exit 1; }
            ;;
        --test)
            TEST_CMD="${2:-}"
            shift 2 || { log_error "--test requires a value"; exit 1; }
            ;;
        -*)
            # Unknown flag - might be the command
            COMMAND="$1"
            shift
            ;;
        *)
            if [[ -z "${COMMAND:-}" ]]; then
                COMMAND="$1"
            fi
            shift
            ;;
    esac
done

case "${COMMAND:-}" in
    init)
        init
        ;;
    start)
        start_session "$PROJECT"
        ;;
    end)
        end_session "$PROJECT"
        ;;
    force-release)
        force_release "$PROJECT"
        ;;
    dashboard|status)
        dashboard
        ;;
    create-task)
        create_task "$PROJECT" "$DESC" "${TEST_CMD:-npm run quality --prefix frontend}"
        ;;
    worker-done)
        mark_worker_done "$PROJECT" "$TASK"
        ;;
    verify-task)
        verify_task "$PROJECT" "$TASK"
        ;;
    list-tasks)
        list_tasks "$PROJECT"
        ;;
    show-task)
        show_task "$PROJECT" "$TASK"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        show_help
        ;;
esac
