#!/bin/bash
# Claude Code Task Helpers
# Simple utilities for Claude to track task state
# NOT an orchestration script - just state management helpers

set -euo pipefail

CLAUDE_DIR=".claude"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize tracking directories
init() {
    mkdir -p "$CLAUDE_DIR"/{tasks,sessions,templates}

    # Create task log if it doesn't exist
    if [ ! -f "$CLAUDE_DIR/task-log.md" ]; then
        cat > "$CLAUDE_DIR/task-log.md" << 'EOF'
# Task Log

| Timestamp | Task ID | Description | Status | Evidence |
|-----------|---------|-------------|--------|----------|
EOF
    fi

    echo -e "${GREEN}✓ Claude tracking initialized${NC}"
    echo -e "${BLUE}Directories:${NC}"
    echo "  - $CLAUDE_DIR/tasks/"
    echo "  - $CLAUDE_DIR/sessions/"
    echo "  - $CLAUDE_DIR/templates/"
    echo "  - $CLAUDE_DIR/task-log.md"
}

# Generate unique task ID
new_task_id() {
    # Use uuidgen for better portability across macOS/Linux
    if command -v uuidgen &> /dev/null; then
        echo "task-$(date +%Y%m%d-%H%M%S)-$(uuidgen | cut -d- -f1 | tr '[:upper:]' '[:lower:]')"
    else
        # Fallback to random hex
        echo "task-$(date +%Y%m%d-%H%M%S)-$(od -An -N4 -tx /dev/urandom | tr -d ' ')"
    fi
}

# Generate session ID
new_session_id() {
    echo "session-$(date +%Y%m%d-%H%M%S)-$$"
}

# Log task to task-log.md
log_task() {
    local task_id="$1"
    local description="$2"
    local status="$3"
    local evidence="${4:-N/A}"

    if [ ! -f "$CLAUDE_DIR/task-log.md" ]; then
        echo -e "${RED}Error: task-log.md not found. Run '$0 init' first.${NC}" >&2
        return 1
    fi

    echo "| $(date -Iseconds) | $task_id | $description | $status | $evidence |" >> "$CLAUDE_DIR/task-log.md"
    echo -e "${GREEN}✓ Logged task: $task_id ($status)${NC}"
}

# Show status dashboard
status() {
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}       Claude Code Task Dashboard          ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo ""

    # Check if initialized
    if [ ! -d "$CLAUDE_DIR/tasks" ]; then
        echo -e "${YELLOW}Not initialized. Run: $0 init${NC}"
        return 1
    fi

    # Active tasks
    echo -e "${YELLOW}Tasks Status:${NC}"
    local task_count=0

    if [ -d "$CLAUDE_DIR/tasks" ]; then
        for task_file in "$CLAUDE_DIR/tasks"/*.md; do
            if [ -f "$task_file" ]; then
                task_count=$((task_count + 1))
                local task_id=$(basename "$task_file" .md)
                local status_icon="⏳"
                local status_text="Pending"

                # Check for verification
                if [ -f "$CLAUDE_DIR/verified-$task_id.md" ]; then
                    if grep -q "VERIFIED ✓" "$CLAUDE_DIR/verified-$task_id.md" 2>/dev/null; then
                        status_icon="✓"
                        status_text="Verified"
                    else
                        status_icon="✗"
                        status_text="Failed"
                    fi
                # Check for worker completion
                elif [ -f "$CLAUDE_DIR/worker-done-$task_id.md" ]; then
                    status_icon="🔍"
                    status_text="Awaiting verification"
                fi

                # Get task description from file
                local desc=$(grep "^# Task:" "$task_file" | cut -d: -f2- | tr -d ' ')
                [ -z "$desc" ] && desc=$(grep "^## Description" -A1 "$task_file" | tail -1)

                echo "  $status_icon $task_id: $status_text"
                echo "     ${desc:0:60}"
            fi
        done
    fi

    if [ $task_count -eq 0 ]; then
        echo "  (no tasks yet)"
    fi
    echo ""

    # Recent activity
    echo -e "${YELLOW}Recent Activity (last 5):${NC}"
    if [ -f "$CLAUDE_DIR/task-log.md" ]; then
        tail -5 "$CLAUDE_DIR/task-log.md"
    else
        echo "  (no activity yet)"
    fi
    echo ""
}

# Show help
show_help() {
    echo "Claude Code Task Helpers"
    echo ""
    echo "Simple utilities for Claude to manage task state"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  init                              Initialize .claude/ directories"
    echo "  new-task                          Generate unique task ID"
    echo "  new-session                       Generate unique session ID"
    echo "  log <task-id> <desc> <status>     Log task completion"
    echo "  status                            Show task dashboard"
    echo ""
    echo "Examples:"
    echo "  $0 init"
    echo "  TASK_ID=\$($0 new-task)"
    echo "  $0 log task-123 'Add auth' 'VERIFIED' '.claude/verified-task-123.md'"
    echo "  $0 status"
    echo ""
    echo "Notes:"
    echo "  - This script is NOT an orchestrator"
    echo "  - Claude uses Task tool to spawn agents"
    echo "  - This script only tracks state in files"
}

# Main command dispatcher
case "${1:-}" in
    init)
        init
        ;;
    new-task)
        new_task_id
        ;;
    new-session)
        new_session_id
        ;;
    log)
        if [ $# -lt 4 ]; then
            echo -e "${RED}Error: log requires 4 arguments${NC}" >&2
            echo "Usage: $0 log <task-id> <description> <status> [evidence]" >&2
            exit 1
        fi
        log_task "$2" "$3" "$4" "${5:-N/A}"
        ;;
    status)
        status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -n "${1:-}" ]; then
            echo -e "${RED}Error: Unknown command '$1'${NC}" >&2
            echo "" >&2
        fi
        show_help
        exit 1
        ;;
esac
