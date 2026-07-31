# Machine Capability Verification

Date: 2026-07-29

No secret values are recorded in this evidence.

| Boundary | Command or observation | Result |
| --- | --- | --- |
| Machine environment | Windows user environment plus ACL-protected shared environment file | Pass; 99 non-ephemeral runtime variables centralized, Vercel OIDC variables excluded, file limited to current user and read-only |
| Supabase production DB | `machine-capabilities check --profile full --fresh` | Pass through direct production `DATABASE_URL`; migration ledger reachable without Docker |
| Supabase platform token | Management API project list | Partial by provider ownership: token is valid and exposes eight projects, but not legacy production ref `lgveqfnpkxvzbnnwuled`; direct DB path is the production fallback |
| Vercel | Full machine capability check | Pass for `the-alleato-group/project-management-agent` |
| Capability cache | Immediate repeated full check | Pass; second result reports cache hit |
| Workspace bootstrap contracts | Node tests for machine capabilities and isolated workspace | Pass, 16/16, including owned-path inference, capability-scoped dependencies, least-privilege linkage, and transactional cleanup |
| Dependency launcher | Windows pnpm entrypoint contract | Pass; invokes the installed pnpm/Corepack JavaScript file through `node`, never `cmd.exe` |
| Dependency readiness | Root/frontend executable contract | Pass; forces development dependencies and checks locked `tsx`, `next`, and `playwright` executables instead of accepting a production-only install |
| Transactional cleanup | Failed dependency-provisioning canary | Pass after correction; the original provider/install error is preserved even if Windows worktree removal needs fallback cleanup |
| Database type fallback | `scripts/generate-db-types.mjs --check` | Remote schema generated through postgres-meta without Docker; guard correctly reported tracked types are stale |
| Type fallback contracts | Focused Node tests | Pass, 3/3 |
| Browser preflight contracts | Focused Node tests | Pass, 7/7 |
| Browser tool | `agent-browser --version` | Pass, 0.33.1 |
| Authenticated browser | `verify:browser-auth --base-url https://projects.alleatogroup.com --route /tasks` | Pass; fresh session reached `https://projects.alleatogroup.com/tasks` |
| False-positive guard | `/access-denied` classification contract | Pass; access-denied routes are rejected |
| Secret failure guard | Cookie display and captured-output redaction contracts | Pass; auth-cookie values are never included in command failure messages |
| Environment isolation | File identity and attributes after provisioning | Pass; central source and all worktree materializations are separate links (`nlink=1`) and mode `0444` |
| Exposed test session recovery | Supabase global logout | Pass, HTTP 204; refresh tokens revoked and generated state removed before a clean replacement session |

Final fresh-worktree canary from published `origin/main`: pass. Workspace
`Scanary4` provisioned locked root/frontend dependencies, an independent
read-only environment, Supabase/Vercel linkage, a clean Git state, fresh remote
provider checks, Docker-free remote schema generation, and an authenticated
browser at `https://projects.alleatogroup.com/tasks`. The type check correctly
reported the separately owned tracked `database.types.ts` file as stale.

Independent review approved the final capability-scoping and least-privilege
diff after database-only workspaces were prevented from receiving frontend
runtime secrets.
