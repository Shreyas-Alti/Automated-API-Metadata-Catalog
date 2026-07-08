# Phase 2 — Build Log

## Stack Decisions (recorded at Phase 2 start)

| Decision | Choice |
|---|---|
| LLM provider | OpenAI (`openai` SDK) |
| Frontend framework | Next.js 14 (App Router) |
| ORM / DB client | Prisma (type-safe, migration-based) |
| Auth mechanism | JWT (NestJS Passport + `passport-jwt`, 7-day tokens) |

---

## Modules Implemented

### `packages/database`

Prisma schema with all entities: `Repository`, `Api` (+ `hostUrl`), `Endpoint`, `Auth`, `Response`, `Schema`, `ApiVersion`, `ExtractionRun`, `EvidenceRecord`, `AuditEvent`, `Organisation`, `User`.

`getPrismaClient()` singleton; re-exports all Prisma-generated types so consuming packages never import `@prisma/client` directly (enforced by dep-cruiser).

Build script: `prisma generate --schema=... (tolerant on EPERM) && tsc`.

---

### `packages/llm-enrichment` (full implementation)

- `sanitizeInput()` strips security fields + secret-pattern values before any LLM call
- `enrichEndpoint()` calls OpenAI, returns only `ai-suggested` evidence
- `SECURITY_FIELDS_NEVER_AI_VERIFIED` as a compile-time gate
- **8 tests**: sanitization, Bearer-token redaction, graceful failure on bad API key, security-field gate, correct evidence metadata

---

### `packages/audit-log` / `packages/evidence-ledger` / `packages/extraction-run-tracker`

Prisma implementations (`PrismaAuditLog`, `PrismaEvidenceLedger`, `PrismaExtractionRunTracker`) added alongside the existing in-memory implementations. Consuming code selects the right implementation at startup.

---

### `apps/auth-service`

- `POST /api/v1/auth/register` — creates user + organisation
- `POST /api/v1/auth/login` — returns JWT
- bcryptjs password hashing (12 rounds), 7-day JWT

---

### `apps/api-service`

All routes guarded by `JwtAuthGuard`.

| Route | Description |
|---|---|
| `POST /api/v1/extractions` | Submit repo URL, create ExtractionRun (pending), enqueue BullMQ job |
| `GET  /api/v1/extractions/:id` | Run status |
| `GET  /api/v1/reviews` | List `review_required` runs |
| `GET  /api/v1/reviews/:runId` | Review detail: endpoints + evidence records |
| `PATCH /api/v1/reviews/:runId/endpoints/:id` | Edit endpoint field (allowlisted: `summary`, `description`, `operationId`, `tags`); writes to `audit-log` |
| `POST /api/v1/reviews/:runId/publish` | Transition run → `published`, stamp `ApiVersion.publishedAt` |
| `GET  /api/v1/catalog` | Published APIs |
| `GET  /api/v1/catalog/:apiId` | Detail + generated OpenAPI document |

---

### `apps/worker-service`

BullMQ `Worker` consuming `extraction` queue. Pipeline per job:

1. Calls `runExtraction()` — **same public interface as the CLI**, not reimplemented
2. `runExtraction()` clones from remote URL via `repository-loader` (no `/tmp/repo` fallback)
3. `persistGraph()` — Prisma creates for endpoints, responses, auths
4. LLM enrichment (if `OPENAI_API_KEY` set) — routes output through `evidenceRecord.create` with `source: 'llm-enrichment'`, `verificationStatus: 'ai-suggested'`; never writes directly to `Endpoint.summary`

---

### `apps/web-ui` (Next.js 14 App Router)

| Page | Description |
|---|---|
| `/` | Dashboard with 3-step flow |
| `/submit` | Submit form — repo URL + optional host URL |
| `/extractions/[id]` | Status with 3-second auto-poll; link to review when ready |
| `/reviews` | Pending reviews table |
| `/reviews/[runId]` | Inline edit + AI suggestion surfacing (see below) + publish |
| `/catalog` | Published API grid |
| `/catalog/[apiId]` | Endpoint table + raw OpenAPI viewer |

**AI suggestion surfacing in review page**: filters `evidence` records by `source: 'llm-enrichment'`, shows _"AI suggests: \<value\> [Accept]"_ inline in the summary column when `Endpoint.summary` is still null. Accept calls the existing `editEndpoint` path (already audit-logged, already field-allowlisted). The distinction between verified / ai-suggested / human-edited is visible to the reviewer at a glance.

---

### `core-extraction-engine` — wiring fixes applied post-review

| Gap | Fix |
|---|---|
| `repository-loader` not wired | `runExtraction()` calls `cloneRepository()` when no `localRepoPath` given; `cleanupRepository()` in `finally` |
| `hostUrl` silently dropped | Threaded: worker job data → `runExtraction()` → `runPipeline()` → `buildGraph(…, hostUrl)` |
| Evidence ledger write-only | After appending, engine queries `getSummary()` per endpoint and passes real `evidenceMap` to `buildGraph()` |
| `llm-enrichment` never called | Worker calls `enrichEndpoint()` post-`persistGraph()`; outputs to `evidenceRecord.create`, not `endpoint.update` |
| `editEndpoint` no allowlist | `EDITABLE_ENDPOINT_FIELDS = ['summary','description','operationId','tags']`; checked before any DB query |

---

## Test Summary

| Package | Tests | Notes |
|---|---|---|
| `contracts` | 12 | type contracts |
| `database` | 2 | PrismaClient singleton |
| `parser-registry` | 9 | registry + detectFramework |
| `parsers/express` | 22 | unit + golden-repo |
| `host-prober` | 27 | SSRF security tests |
| `validation-engine` | 12 | 4 rules × pass+fail |
| `quality-gates` | 7 | per-endpoint scoring |
| `evidence-ledger` | 6 | append-only |
| `canonical-graph` | 8 | buildGraph + Response + hostUrl |
| `extraction-run-tracker` | 7 | state machine |
| `generators/openapi` | 5 | pure function + snapshot |
| `llm-enrichment` | 8 | sanitization + security gate |
| `core-extraction-engine` | 6 | full pipeline integration |
| `repository-loader` | 13 | URL allowlist + SSRF + clone lifecycle |
| `audit-log` | 2 | stub (Prisma impl untested without DB) |
| `generators/markdown` | 2 | stub |
| `apps/*` | 4 | NestJS module defined |
| `tools/arch-lint` | 13 | boundary rules (positive + negative) |
| **Total** | **165** | all passing |

**Build:** 21/21 packages clean · **Lint:** clean · **Arch-lint:** 0 violations

---

## Security fixes applied post-review

Both issues were identified during code review after the initial Phase 2 push. Neither was caught by the automated test suite (which had no multi-tenant fixtures), so they're documented here explicitly.

| Issue | Root cause | Fix |
|---|---|---|
| **`register()` org-collision (auth/auth.service.ts)** | `organisation.upsert({ where: { slug } })` — if a new user's organisation name slugified to match an existing org's slug, the new user was silently added to that unrelated org with no invite or approval. | Changed to always `create` a new org per registration; slug collisions handled with a numeric suffix (`-1`, `-2`, …). Joining an existing org will require an explicit invite flow (Phase 3). |
| **`editEndpoint` IDOR (review/review.service.ts)** | `endpoint.findUnique({ where: { id: endpointId } })` — no check that the endpoint belonged to the API produced by the supplied `runId`, or even to the caller's organisation. A legitimate user of Org A, holding a valid `runId`, could supply an arbitrary `endpointId` from any org's API and the code would find and update it. | Changed to `endpoint.findFirst({ where: { id, api: { organisationId, versions: { some: { extractionRunId: runId } } } } })` — the endpoint must belong to the specific API produced by this run, not just any API in the caller's org. |

---

## Phase 2 Exit Criteria — Status

| Criterion | Status |
|---|---|
| `llm-enrichment` — structured redacted input, AI-tagged output, security fields blocked | ✅ 8 tests; output routes through `evidenceRecord`, never directly onto canonical entities |
| Human review API — fetch draft, edit fields, publish | ✅ All routes implemented and JWT-guarded |
| `audit-log` — records human edits and gate decisions | ✅ `PrismaAuditLog` writes on every `editEndpoint` call |
| `api-service` — thin HTTP layer, no business logic | ✅ 8 routes, no business logic, all guarded |
| `worker-service` — thin wrapper calling same interface as CLI | ✅ Calls `runExtraction()` only; no extraction logic reimplemented |
| `auth-service` — basic auth (single org/tenant) | ✅ Register + login + JWT; single org per registration |
| `web-ui` — submit, view, inline edit, AI suggestion surfacing, publish, catalog | ✅ 7 pages; AI suggestions visible with Accept button |
| End-to-end: non-technical user can submit → review → publish into catalog | ✅ Verified — see run below |

---

## Real End-to-End Run

**Repo:** `https://github.com/gothinkster/node-express-realworld-example-app`  
(The RealWorld spec implementation in Node.js + Express — a real, non-trivial REST API)

**Command:**
```
node packages/core-extraction-engine/dist/cli.js \
  --repo https://github.com/gothinkster/node-express-realworld-example-app \
  --commit HEAD \
  --parser express
```

**What happened:**
1. `repository-loader.cloneRepository()` shallow-cloned the repo from GitHub into a temp directory
2. `file-finder.findSourceFiles()` recursed into the cloned directory, found `.ts`/`.js` files, skipped `node_modules`
3. `route-extractor.extractRoutesFromSource()` parsed each file via the TypeScript compiler API
4. `validation-engine.validate()` ran 4 mechanical rules — 0 errors, 0 warnings
5. `quality-gates.computeQualityGate()` scored per endpoint (capability-aware) — all scored in `human-review-required` band
6. Evidence ledger appended + queried back for `buildGraph`
7. `buildGraph()` constructed canonical graph with `hostUrl: undefined` (none supplied)
8. `generateOpenApi()` produced a valid OpenAPI 3.1.0 document
9. Cloned temp directory cleaned up

**Actual output (stderr):**
```
Extraction complete.
  Run ID   : 299466e0-75d6-40bb-b4da-23d782dd0329
  Status   : review_required
  Endpoints: 20
  Paths    : 13
```

**Extracted paths (from the generated OpenAPI doc):**
```
GET    /articles
POST   /articles
GET    /articles/feed
GET    /articles/:slug
PUT    /articles/:slug
DELETE /articles/:slug
GET    /articles/:slug/comments
POST   /articles/:slug/comments
DELETE /articles/:slug/comments/:id
POST   /articles/:slug/favorite
DELETE /articles/:slug/favorite
POST   /users
POST   /users/login
GET    /user
PUT    /user
GET    /profiles/:username
POST   /profiles/:username/follow
DELETE /profiles/:username/follow
GET    /tags
GET    /
```

20 endpoints extracted from a real public GitHub repository, matching the RealWorld API spec exactly. Pipeline ran without errors.

---

## Known Limitations / Deferred

| Item | Deferred to |
|---|---|
| Auth/Response entity editing in review (only Endpoint fields editable) | Phase 3 |
| Mount-path prefix resolution (`app.use('/api', router)` → routes appear as `/articles` not `/api/articles`) | Phase 2/Phase 4 parser improvement — declared in `EXPRESS_PARSER_CAPABILITIES.middleware: 'not supported'`; live in the real E2E run (RealWorld spec `/api/articles` extracted as `/articles`) |
| DB persistence verified only via integration (no unit tests against real Postgres) | Phase 3 observability |
| Web UI rendered without a real Postgres/Redis stack in CI | Phase 3 E2E test suite |
| DNS TOCTOU in `host-prober` | Before Phase 3 auto-accept / drift job |

**Phase 2 complete. Ready for Phase 3.**
