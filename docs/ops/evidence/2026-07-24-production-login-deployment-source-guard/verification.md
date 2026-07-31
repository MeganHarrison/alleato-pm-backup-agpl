# Production Login Restoration Evidence

## Incident boundary

The canonical alias served Vercel deployment
`dpl_JA7QdK5Uk6gxyPLwCofFQziDYPdB`, built from backup commit `09223ce2`.
The deployment source was `MeganHarrison/alleato-pm-backup`, branch
`codex/s019f94ef-ai-capabilities-detail-941cea`.

During closeout, a second source-less CLI production deployment,
`dpl_Bc8FKARhEN5Nv4aBp7bVaASogZcK`, automatically displaced the restored
artifact and reproduced the dark backup login. Its provider metadata had no Git
source, confirming that source-less production builds are part of the same
failure class.

## Recovery

- Promoted canonical `main` deployment: `dpl_5QFpAicbQ23L2SMDh8PMSRZ5CNwH`.
- Canonical source commit: `7a4bd8b6e632e3d7dc1e0deaed22b697f6020e46`.
- Provider readback: `https://projects.alleatogroup.com` resolves to the restored deployment with status `Ready`.
- Browser readback: `https://projects.alleatogroup.com/auth/login?callbackUrl=%2F` renders the original light, two-column login.
- Both known noncanonical production artifacts were removed by exact deployment
  ID after the canonical alias was restored. The backup repository and its
  development deployment were not changed.

## Guardrail contract

The production build now accepts only:

- Provider: `github`
- Owner: `The-Alleato-Group`
- Repository: `project-management`
- Branch: `main`
- Commit SHA: present

Missing or mismatched production source metadata fails before any build mutation
or compilation begins. Local and Preview builds remain unaffected.

## Focused verification

- `node --test frontend/scripts/build/__tests__/production-source-gate.test.mjs`
  passed 5/5 cases.
- Syntax checks passed for both the new gate and the production build runner.
- `git diff --check` passed.
- Vercel project API readback confirmed `autoExposeSystemEnvs=true` and the Git
  integration is `The-Alleato-Group/project-management`, production branch
  `main`, so the canonical production deployment supplies the enforced fields.
- The restored deployment's last-30-minute error scan contained only two
  unauthenticated `/api/users/me/profile` 401 responses caused by loading the
  public login page. It contained no 5xx response or restored-login error.

## Independent review

- Reviewer: Codex reviewer `/root/review_prod_source_guard`
- Reviewed at: `2026-07-24T17:25:03Z`
- Decision: `APPROVED`
- No blocking findings. The reviewer confirmed the production-only gate is
  fail-closed, runs before build mutation or compilation, and has focused
  allow/deny coverage for canonical, backup, feature-branch, and source-less
  production metadata.
