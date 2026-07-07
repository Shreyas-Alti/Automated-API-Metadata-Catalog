# Phase 0 — Build Log

## Stack Decisions (recorded)

| Decision | Choice |
|---|---|
| Language / Framework | Node.js 20 + NestJS (TypeScript throughout) |
| Monorepo tool | pnpm workspaces |
| Job queue | BullMQ (Redis-backed) |
| Local dev infra | conda environment `api-catalog` (nodejs=20, postgresql=16 from conda-forge; Redis + MinIO as standalone binaries) |
| CI/staging infra | Docker Compose + GitHub Actions service containers |
| Database | PostgreSQL 16 |

---

## Files Created

### Root

| File | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Declares workspace globs: `packages/*`, `packages/parsers/*`, `packages/generators/*`, `apps/*`, `tools/*` |
| `package.json` | Root manifest — shared devDependencies, workspace-wide scripts |
| `tsconfig.base.json` | Shared TypeScript config (strict, ES2022, decorators, commonjs) |
| `jest.config.base.js` | Base Jest config extended by every package |
| `.eslintrc.js` | ESLint + `@typescript-eslint` for all `.ts` files |
| `.dependency-cruiser.js` | **Architecture boundary rules** (see below) |
| `.npmrc` | `shamefully-hoist=false` — enforces per-package dependency isolation |
| `.gitignore` | Excludes `dist/`, `node_modules/`, `local-data/`, `.env` |
| `.env.example` | Template for local dev connection strings (DATABASE_URL, REDIS_URL, S3_*) |
| `docker-compose.yml` | CI/staging reference only — Postgres 16, Redis 7, MinIO |
| `conda-environment.yml` | Conda env spec: `nodejs=20`, `postgresql=16` (resolves to 16.14), `git` — Redis + MinIO are standalone binary downloads |
| `.github/workflows/ci.yml` | Full CI pipeline (see below) |

### Scripts (`scripts/`)

| File | Purpose |
|---|---|
| `scripts/infra-init.ps1` | One-time setup: `initdb`, create databases, download `minio.exe` |
| `scripts/infra-start.ps1` | Start Postgres, Redis, MinIO as background processes |
| `scripts/infra-stop.ps1` | Stop all three services cleanly |

### `packages/contracts/` — Shared Type Contracts

All downstream modules import from here. Nothing here touches DB, LLM, or network.

| Source file | Defines |
|---|---|
| `extraction-result.ts` | `ExtractionResult`, `ParsedRoute`, `ParsedSchema`, `ParserCapabilities`, `ExtractionError` |
| `extraction-run.ts` | `ExtractionRun`, `ExtractionRunStatus` (7 transitions), `ValidationSummary`, `RunGateOutcome` |
| `evidence-record.ts` | `EvidenceRecord`, `EvidenceSource`, `VerificationStatus`, `SecurityFieldName`, `EndpointEvidenceSummary` |
| `canonical-graph.ts` | `Repository`, `Api`, `Endpoint`, `Schema`, `Auth`, `ApiVersion`, `ApiGraph` |
| `quality-score.ts` | `EndpointQualityScore`, `RunQualityReport`, `GateOutcome`, `QualitySignals`, score-band constants, `SECURITY_FIELDS_ALWAYS_REVIEW` |

### Library Packages (stubs — Phase 1 implementation)

Each has `package.json`, `tsconfig.json`, `jest.config.js`, `src/index.ts`, `src/__tests__/index.test.ts`.

| Package | Name | Key interface / export |
|---|---|---|
| `packages/parser-registry` | `@api-catalog/parser-registry` | `IParser`, `FrameworkName` |
| `packages/parsers/express` | `@api-catalog/parser-express` | `EXPRESS_PARSER_CAPABILITIES` (capability declaration) |
| `packages/host-prober` | `@api-catalog/host-prober` | `HostProbeTarget`, `HostProbeResult` |
| `packages/validation-engine` | `@api-catalog/validation-engine` | `ValidationRule` |
| `packages/quality-gates` | `@api-catalog/quality-gates` | `GateInput`, re-exports score constants |
| `packages/evidence-ledger` | `@api-catalog/evidence-ledger` | `IEvidenceLedger` (append-only — no update/delete) |
| `packages/canonical-graph` | `@api-catalog/canonical-graph` | `ICanonicalGraph` |
| `packages/extraction-run-tracker` | `@api-catalog/extraction-run-tracker` | `IExtractionRunTracker` (explicit status transitions) |
| `packages/core-extraction-engine` | `@api-catalog/core-extraction-engine` | `ExtractionEngineInput/Output` |
| `packages/llm-enrichment` | `@api-catalog/llm-enrichment` | `EnrichmentInput/Output` (structured context only, never raw files) |
| `packages/generators/openapi` | `@api-catalog/generator-openapi` | `GenerateOpenApi` (pure function) |
| `packages/generators/markdown` | `@api-catalog/generator-markdown` | `GenerateMarkdown` (pure function) |
| `packages/audit-log` | `@api-catalog/audit-log` | `IAuditLog`, `HumanEditEvent`, `GateDecisionEvent` |

### App Stubs (`apps/`)

Each has `package.json`, `tsconfig.json`, `jest.config.js`, `src/main.ts`, `src/app.module.ts`, `src/__tests__/app.test.ts`.

| App | Name | Port | Notes |
|---|---|---|---|
| `apps/api-service` | `@api-catalog/api-service` | 3000 | Thin HTTP layer — no business logic |
| `apps/worker-service` | `@api-catalog/worker-service` | 3001 | BullMQ consumer, wraps core-extraction-engine |
| `apps/auth-service` | `@api-catalog/auth-service` | 3002 | Login/RBAC — Phase 2 basic, Phase 3 full RBAC |
| `apps/web-ui` | `@api-catalog/web-ui` | — | Frontend stub — framework decided at Phase 2 start |

### `tools/arch-lint/`

| File | Purpose |
|---|---|
| `package.json` | `@api-catalog/arch-lint`, depends on `dependency-cruiser` |
| `src/__tests__/boundary-rules.test.ts` | Verifies the three boundary rules are correctly configured and that `pnpm run arch:lint` exits 0 on the clean codebase |

---

## Architecture Boundary Rules (`.dependency-cruiser.js`)

Three rules, all `severity: error` — CI fails on any violation.

| Rule | Allowed modules | Forbidden target |
|---|---|---|
| `no-db-outside-allowed-modules` | `canonical-graph`, `evidence-ledger`, `extraction-run-tracker`, `audit-log`, `auth-service` | `pg`, `typeorm`, `@prisma/client`, `knex`, `sequelize`, `drizzle-orm` |
| `no-llm-outside-llm-enrichment` | `llm-enrichment` only | `openai`, `@anthropic-ai`, `langchain`, `@google/generative-ai` |
| `no-http-client-outside-host-prober` | `host-prober` only | `axios`, `got`, `node-fetch`, `undici` |

---

## CI Pipeline (`.github/workflows/ci.yml`)

```
lint (ESLint + arch:lint)
  ↓
unit-tests (pnpm -r run test)
  ↓
integration-tests (Postgres 16 + Redis 7 service containers)
  ↓
golden-repo-tests (placeholder — activated in Phase 1)
  ↓
build (pnpm -r run build)
  ↓
[e2e-tests — commented out, added in Phase 2]
```

---

## Root Scripts

```
pnpm run build           # tsc -r across all packages
pnpm run typecheck       # tsc --noEmit -r
pnpm run lint            # ESLint on all .ts files
pnpm run arch:lint       # dependency-cruiser boundary check
pnpm run test:unit       # pnpm -r --parallel run test
pnpm run test:integration
pnpm run test:golden

pnpm run infra:init      # one-time: initdb + download minio.exe
pnpm run infra:start     # start Postgres, Redis, MinIO
pnpm run infra:stop      # stop all three
```

---

## Local Dev Setup (first time)

```powershell
# 1. Create conda env (nodejs=20, postgresql=16, git)
conda env create -f conda-environment.yml
conda activate api-catalog

# 2. Install pnpm inside the env (only needed once)
npm install -g pnpm

# 3. Install JS dependencies
pnpm install

# 4. One-time infra init (creates pgdata, creates DBs, downloads redis + minio binaries)
pnpm run infra:init

# 5. Copy env template
Copy-Item .env.example .env

# 6. Start services
pnpm run infra:start
```

---

## Phase 0 Exit Criteria — Status

| Criterion | Status |
|---|---|
| Empty-but-wired monorepo, one package per module | ✅ Done |
| Shared contracts defined before any logic | ✅ Done (`packages/contracts`) |
| Dependency-boundary lint rules in place from day one | ✅ Done (`.dependency-cruiser.js`) |
| CI pipeline skeleton: lint → unit → integration → golden → build | ✅ Done (`.github/workflows/ci.yml`) |
| Infra provisioned (Postgres, Redis, S3) | ✅ Verified — `pnpm run infra:init` ran on this machine with postgresql=16 pinned: `initdb` (PostgreSQL 16.14 via conda-forge), `pg_ctl start`, `createdb api_catalog` + `api_catalog_test` (PG_VERSION file = 16), `pg_ctl stop`, Redis 7.4.4 binary downloaded, MinIO binary downloaded. All steps exited 0. Local version now matches CI (docker-compose.yml: postgres:16-alpine). |
| Stack/language decision recorded | ✅ Done (Node.js 20 + NestJS, pnpm, BullMQ; Postgres + Redis + MinIO as standalone/conda binaries for local dev) |
| Every module builds/lints/tests trivially | ✅ Verified — 19/19 packages build clean, 50 tests pass, lint clean |
| Boundary rules demonstrably block a violation | ✅ Verified — `arch:lint` passes on clean codebase (118 modules, 104 deps); 3 negative tests each introduce a real forbidden import and assert depcruise exits 1 and names the rule. 13/13 `tools/arch-lint` tests pass. |

**Phase 0 complete. Ready to start Phase 1.**

---

## Notes recorded during Phase 0

### ExtractionRunStatus — 7 states explained
The plan names 5 terminal/outcome states (`ParserError`, `ValidationFailed`, `QualityGateFailed`, `ReviewRequired`, `Published`). Two in-progress states were added for the BullMQ job-queue model:
- `pending` — job queued but no worker has picked it up yet (observable in the UI, prevents runs from starting as `running` before they are)
- `running` — worker is actively executing the pipeline

All 7 states are documented with a comment in `packages/contracts/src/extraction-run.ts`.

### Local infra on Windows — what actually works
- **Postgres**: conda-forge `postgresql=16` (resolves to 16.14). Postgres binaries live in `Library\bin` inside the conda env; scripts use `conda run -n api-catalog` for all postgres commands to avoid PATH issues in child PowerShell processes.
- **Redis**: NOT available as a server binary on conda-forge for Windows. Downloaded as a standalone binary (redis-windows project, Redis 7.4.4) by `infra:init`.
- **MinIO**: standalone binary downloaded by `infra:init` (dl.min.io).
- **Docker Desktop**: installed on this machine but not usable — `docker ps` returns HTTP 500 (daemon engine error, not just "not started"). This is a Docker Desktop configuration issue unrelated to admin rights. `docker-compose.yml` is kept for CI (GitHub Actions service containers) and staging.

### Correct invocation for infra scripts

`infra-init.ps1` and `infra-start.ps1` use `conda run -n api-catalog <cmd>` for all postgres commands internally. A fresh contributor does **not** need to activate the env before running them — conda does not need to be active for `conda run` to work.

The only prerequisite is that `conda` itself is on `PATH` (which it is after the standard miniconda/anaconda install), and that `pnpm` is available. Once `npm install -g pnpm` has been run inside the env (step 2 in the setup), `pnpm` lives at `<conda-env>/Scripts/pnpm` and is reachable after `conda activate api-catalog`.

**Why `conda activate` alone may not work in a fresh PowerShell:**
conda's `activate` command only works if conda's PowerShell hook has been initialised. On a new machine, run once:
```powershell
conda init powershell
```
Restart the terminal. After that, `conda activate api-catalog` sets `PATH` automatically and `pnpm run infra:start` etc. all work without the manual `$env:PATH` prepend. The manual prepend was only needed during Phase 0 setup because the hook wasn't initialised in that particular terminal session.
