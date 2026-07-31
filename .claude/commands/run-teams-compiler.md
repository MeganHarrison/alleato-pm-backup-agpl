Run the Teams conversation compiler batch against the Supabase database.

## Steps

1. Syntax-check the compiler modules:
```bash
cd /Users/meganharrison/Documents/alleato-pm/backend && /opt/homebrew/opt/python@3.13/libexec/bin/python3 -m py_compile \
  src/services/intelligence/client.py \
  src/services/intelligence/prompts.py \
  src/services/intelligence/teams_compiler.py \
  src/api/main.py && echo "PASS: syntax OK"
```
If this fails, fix the syntax error before continuing.

2. Run the batch. The user may pass a number as an argument (e.g. `/run-teams-compiler 50`) — use that as `batch_size`. Default is 25.
```bash
cd /Users/meganharrison/Documents/alleato-pm/backend && /opt/homebrew/opt/python@3.13/libexec/bin/python3 - <<'PY'
import sys
sys.path.insert(0, 'src')
from services.env_loader import load_env
load_env()
from services.supabase_helpers import get_supabase_client
from services.intelligence.teams_compiler import run_compiler_batch
batch_size = 25  # replace with the numeric argument if one was provided
stats = run_compiler_batch(get_supabase_client(), batch_size=batch_size)
print(stats)
PY
```

3. Report results clearly:
- **succeeded / total_processed** — how many compiled successfully
- **failed** and **failed_doc_ids** — any errors to investigate
- **timed_out** — whether the batch hit the time limit (normal for large runs)
- **insight_cards_written**, **tasks_written**, **structured_insights_written** — intelligence extracted
- **processing_time_ms** — how long it took

If `failed > 0`, show the failed doc IDs and suggest re-running with `target_status=["error"]` to retry them.
If `timed_out=True`, note how many rows remain and suggest running again.
