# Render API release evidence

Executed 2026-07-22.

- Read the production `alleato-graph-sync` cron service through the Render API.
- Repaired its source from `MeganHarrison/alleato-pm` to the canonical `The-Alleato-Group/project-management` repository.
- Confirmed the service remains on `main` with `autoDeploy=yes`.
- Render does not support commit-reference deployment for cron jobs. Publishing this evidence commit triggers the first auto-deploy from the repaired source.

The next Render deploy must report the release commit or a later `main` commit before the worker is considered live.
