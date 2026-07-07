# Automated API Metadata Catalog — Final Build Roadmap & Development Plan

## Guiding Principle

The platform never stores documentation. It stores verified extraction results with provenance. Documentation, search indexes, and SDKs are generated views over that model — never the model itself.

LLMs never create structural truth. Auth, permissions, and rate-limit fields can never be marked "Verified" from AI inference alone. Validation is always mechanical (no AI). Every extraction is reproducible from (repo, commit SHA, parser version) alone.

## Non-Goals (explicitly out of scope for Phase 1)

- GraphQL, gRPC, or AsyncAPI support (REST only until a second protocol paradigm is deliberately added — see Phase 4)
- SDK generation
- Developer Copilot / RAG Q&A
- Cross-repo / cross-service dependency graph
- True auto-accept without human review (see Quality Gate section — this arrives in Phase 3 at the earliest, and only for non-security fields)

Keep this list visible in the doc going forward. Any proposed feature should be checked against it before being added to a phase.

---

## Architecture Overview (one-page version)

```
GitHub Repo + Host URL
        │
        ▼
 Plugin Parser (versioned, capability-declared)
        │
        ▼
 ExtractionResult ──── Host Prober (runtime probe / discovery)
        │
        ▼
 Validation Engine (mechanical, no AI)
        │
        ▼
 Quality Gate (per-endpoint scoring → Auto-Accept / Human Review / Reject)
        │
        ▼
 Evidence Ledger (immutable) ──── LLM Enrichment (descriptions/examples only)
        │
        ▼
 Canonical Graph (sole source of truth)
        │
        ▼
 Human Review (edits the graph, never generated docs)
        │
        ▼
 Generated Outputs → OpenAPI · Markdown · Search Index · (later: SDKs)

Wrapping all of this: ExtractionRun (repo, commit SHA, parser versions,
  validation summary, gate outcome, status) + Audit Log + Parser
  Regression Suites (golden repos, per parser version)
```

---

## Module Map

| Module | Responsibility | May access DB? | May call LLM? | May call external URLs? |
|---|---|---|---|---|
| `parser-registry` | Plugin contract + factory (`detectFramework`, `loadParser`) | No | No | No |
| `parsers/express`, `parsers/fastapi`, ... | One module per framework, versioned, capability-declared, own golden-repo tests | No | No | No |
| `host-prober` | The ONLY module allowed to hit a user-supplied host URL. Owns all SSRF protections (private IP/metadata blocking, DNS-rebind checks, redirect validation, timeouts, size caps). Used both during ingestion (discovery + sanity probe) and by the scheduled drift job (Phase 3). | No | No | **Yes — exclusively** |
| `validation-engine` | Mechanical checks only: duplicate routes, orphan schemas, missing bodies, invalid refs | No | No | No |
| `quality-gates` | Computes per-endpoint signals (see below) and routes each endpoint/run to Auto-Accept / Human Review / Reject | No | No | No |
| `evidence-ledger` | Append-only `EvidenceRecord` store + denormalized per-endpoint confidence summary | Yes | No | No |
| `canonical-graph` | Domain model (Repository → API → Endpoint → Schema → Auth → Version); the sole source of truth | Yes | No | No |
| `extraction-run-tracker` | `ExtractionRun` entity + status transitions | Yes | No | No |
| `core-extraction-engine` | Orchestrates one full run: parse → validate → gate → probe → evidence → graph. Exposed as CLI + library. | No (delegates) | No | No (delegates to host-prober) |
| `llm-enrichment` | The ONLY module allowed to call an LLM. Structured, redacted input only; returns tagged AI evidence only | No | **Yes — exclusively** | No |
| `generators/openapi`, `generators/markdown`, `generators/sdk` | Pure functions: canonical graph in, artifact out | No | No | No |
| `audit-log` | Immutable log of human review edits, and of every gate decision (auto-accepted, sent to review, rejected) with the score that produced it | Yes | No | No |
| `api-service` | Thin HTTP layer, no business logic | No | No | No |
| `worker-service` | Consumes job queue, calls `core-extraction-engine` | No | No | No |
| `auth-service` | Login, org/team membership, RBAC | Yes | No | No |
| `web-ui` | Frontend, talks to `api-service` via generated API contract | No | No | No |

**Parser capability matrix** (generate from each parser's real capability declaration file — do not hand-maintain a separate copy that can drift):

| Capability | Express | FastAPI | Spring |
|---|---|---|---|
| Routes | supported | supported | supported |
| Models | supported | supported | supported |
| Middleware | supported | partial | supported |
| Auth (OAuth scopes) | not supported | partial | partial |
| Rate limits | not supported | not supported | not supported |

**CI enforcement (architecture tests, not just review):**
- Only `canonical-graph`, `evidence-ledger`, `extraction-run-tracker`, `audit-log`, `auth-service` may import a DB client.
- Only `llm-enrichment` may import an LLM/AI client.
- Only `host-prober` may make outbound requests to a user-supplied or externally-controlled URL.
- Enforce all three with a dependency-boundary lint tool (dependency-cruiser, import-linter, or ESLint import restrictions) — not just convention.

---

## How the Quality Gate Actually Works

This has two distinct parts. Do not conflate them.

**1. Signals — computed per run, no ground truth needed:**
- Parser error rate: fraction of files that failed to parse / hit unhandled constructs.
- Field completeness ratio: fraction of found routes with all required fields populated (method, path, at least one response schema).
- Cross-source agreement: compare statically-found routes against `host-prober`'s live results — large mismatches in either direction are a signal, independent of any absolute "correct" count.
- Delta from previous run: on the same repo, a sudden large drop/spike in route count on a small code diff is suspicious on its own.

**2. Thresholds — where the actual numbers come from:**
- Initially calibrated against the golden-repo corpus: run the parser against repos with known, hand-verified expected output, and find the score band where "known-good" extractions cluster vs. where "known-bad" ones cluster.
- Continuously recalibrated in production using `audit-log` data: track edit-volume-per-endpoint for extractions that passed the gate. If low-scoring runs are consistently getting near-zero edits, thresholds are too strict; if high-scoring runs still get heavily edited, they're too loose. Treat thresholds as a live, monitored parameter, reviewed periodically — never a value set once and left alone.

**3. Outcome — three tiers, scored per endpoint (not just per run):**

```
Per-endpoint quality score
  90–100%  → Auto-Accept
  70–89%   → Human Review Required
  <70%     → Reject Extraction
```

Scoring per endpoint (not the whole run) means a handful of ambiguous endpoints in an otherwise-clean 40-endpoint extraction only send those few to review, instead of dragging the entire run into manual review.

**4. Permanent exception — security fields are never auto-accepted:**
Auth requirements, permissions, and rate-limit fields always route to Human Review regardless of score, even at 95%+. A run can score high in aggregate while still being wrong on a security-sensitive field, and that's exactly the error a developer will trust and act on without question. This exception is hardcoded, not scored.

**5. Phased rollout — do not ship true auto-accept in Phase 1:**
- Phase 1–2: two effective outcomes only — Human Review Required or Reject. No auto-accept yet. This is also how you generate the calibration data referenced above (does a reviewer accept a 90%+ scored endpoint with zero edits, or still change it?).
- Phase 3: once production audit-log history shows a score band consistently correlating with zero-edit approvals, enable true Auto-Accept for that band, with the security-field exception remaining permanent.

---

## Risks

| Risk | Mitigation |
|---|---|
| Parser accuracy on real-world repos | Golden-repo regression suites, per-parser capability declarations, per-endpoint quality scoring |
| SSRF via user-supplied host URL | `host-prober` as the sole network-egress module, with IP/redirect/timeout/size controls |
| LLM hallucination becoming treated as fact | Evidence-ledger separation, validation before enrichment, security fields never AI-Verified |
| Large/malicious repositories (resource exhaustion, arbitrary code) | Static parsing only, sandboxed execution if ever needed, size/time caps in worker jobs |
| Auto-accept publishing wrong data | Phased rollout of the three-tier gate, calibrated thresholds, permanent security-field exception |
| Architecture boundary erosion over time (DB/LLM/network access creeping into the wrong modules) | Enforced via CI dependency-boundary lint rules, not just code review |

---

## Phase 0 — Planning & Project Setup

1. Set up a monorepo (Nx, Turborepo, or pnpm/uv workspaces), one package per module above, each with its own test config and lint rules.
2. Define shared contracts before writing logic: `ExtractionResult`, `ExtractionRun`, `EvidenceRecord`, canonical graph entities, and the per-endpoint quality-score shape.
3. Set up dependency-boundary linting from day one — before any module has real code — so the rules can't be worked around later.
4. Set up CI pipeline skeleton: lint → unit tests → integration tests → golden-repo regression tests → build. (E2E added in Phase 2.)
5. Provision Postgres (canonical graph, evidence, runs, audit), job queue (SQS/BullMQ/etc.), object storage (S3) for repo snapshots.
6. Decide and record the platform's own implementation language/stack (e.g. Python/FastAPI or Node/NestJS) as an explicit decision — this is a real choice to make now, not something to leave implicit.

**Exit criteria:** empty-but-wired monorepo, every module builds/lints/tests trivially, architecture boundary rules demonstrably block a violation in a test PR.

---

## Phase 1 — Core Extraction Engine (CLI/library only, no web app)

1. `parser-registry` — plugin interface + factory. Test: factory resolves the correct parser from framework-detection input.
2. `parsers/express` v1.0.0 — capability declaration + golden-repo test folder. No parser change merges without this suite passing.
3. `host-prober` — build early. Discovery probing (`/openapi.json`, `/swagger.json`, `/.well-known/...`) and a basic route-liveness check. Security tests required: reject private IP ranges, reject cloud metadata IP, reject DNS-rebind-to-private-IP, reject unapproved redirects, enforce timeout/size caps.
4. `validation-engine` — mechanical checks, one test per rule (pass + fail fixture each). CI-enforced: zero dependency on any LLM client.
5. `quality-gates` — implement the signal computations (error rate, completeness, cross-source agreement, delta-from-previous). In this phase, output is Human Review Required or Reject only — no auto-accept path exists yet. Compute and store per-endpoint scores even though auto-accept isn't live, so Phase 3 calibration has historical data to use.
6. `evidence-ledger` — append-only, immutability enforced at the interface (no update/delete methods exist). Denormalized per-endpoint summary recomputed on each append.
7. `canonical-graph` — domain model + `buildGraph(extractionResult, evidence)`. Test expected entities from a given input.
8. `extraction-run-tracker` — ties the above together with a traceable `ExtractionRun` and explicit status transitions (ParserError / ValidationFailed / QualityGateFailed / ReviewRequired / Published).
9. `generators/openapi` — pure function, snapshot-tested.
10. `core-extraction-engine` — wire into one CLI command: `extract-api --repo <url> --commit <sha> --parser express`. Integration test: full pipeline against fixtures, assert on final `ExtractionRun`.
11. Manually run against 3–5 real public Express repos before declaring the phase done.

**Testing gate:** unit tests across all modules (80%+ target on `core-extraction-engine`, `validation-engine`, `canonical-graph`, `host-prober`); golden-repo suite passing; full-pipeline integration test passing; all `host-prober` security tests passing.

**Exit criteria:** CLI reliably produces a reproducible `ExtractionRun`, canonical graph, evidence trail, and OpenAPI document for a real Express repo — zero web UI involved.

---

## Phase 2 — Human Review + Minimal Web Surface

1. `llm-enrichment` — structured, redacted input only, never raw repo files. Output is AI-tagged evidence only, written through `evidence-ledger`, never able to mark auth/permission/rate-limit fields as Verified. Tests: mock the LLM client; verify redaction precedes the call; verify security fields can't be AI-Verified; verify adversarial/injected input doesn't alter output structure.
2. Human review API on `canonical-graph`: fetch draft, edit fields, publish. Edits modify canonical entities directly, never generated docs.
3. `audit-log` — immutable event log for human edits, and for every gate decision made (score, outcome, which tier).
4. `api-service` — thin layer: submission, job status, review, publish, catalog browse. No business logic.
5. `worker-service` — thin wrapper around `core-extraction-engine`. Test that it calls the same public interface as the CLI, not a reimplementation.
6. `auth-service` — basic auth (single org/tenant fine here; full RBAC in Phase 3).
7. `web-ui` — submit, view status, view technical + friendly views, inline edit, publish. Generate frontend types from the same schema `api-service` serves.
8. Basic catalog list/detail page reading directly from `canonical-graph` (no search index yet).

**Testing gate:** contract tests between `web-ui`/`api-service` and `worker-service`/`core-extraction-engine` (generated types / real interfaces, not mocks); E2E test covering submit → review → edit → publish → appears in catalog; end-to-end SSRF rejection test through the real UI/API path.

**Exit criteria:** a non-technical user can submit a repo, review/edit the extracted API, and publish it into a browsable catalog.

---

## Phase 3 — Reliability & Scale-Readiness

1. Parser versioning: version per `ExtractionRun`, changelog per parser, feature-flag/percentage rollout for old vs. new parser versions.
2. Scheduled drift-detection job (separate from ingestion), reusing `host-prober` against already-published APIs. Test: retry-before-flag so a single transient failure doesn't trigger a false drift alert.
3. Canonical graph versioning + breaking-change diff between versions.
4. Real search layer: index canonical graph into OpenSearch/Elasticsearch.
5. Full org/team RBAC in `auth-service`.
6. Observability: structured logs, per-stage metrics, alerting on parser error rate and gate-outcome distribution.
7. Workflow orchestrator (Temporal / Step Functions) if pipeline retry/branching has outgrown simple queue chaining.
8. **Enable true Auto-Accept**, using the score/outcome history accumulated in `audit-log` since Phase 1: pick the score band where zero-edit approvals cluster, enable Auto-Accept for that band, keep the security-field exception permanent and hardcoded regardless of score.

**Testing gate:** nightly regression suite across all parsers with pass/fail history tracked as a metric; load/performance tests on `api-service` and search at expected scale; drift-job false-positive test; explicit test that a 95%+ scored endpoint with an auth field still routes to Human Review, never Auto-Accept.

**Exit criteria:** system runs unattended at higher volume, auto-accept is enabled only where calibration data supports it, operators get clear signals when something breaks.

---

## Phase 4 — Intelligence & Governance (only after Phases 1–3 are stable in real use)

1. Second and third parser (`parsers/fastapi`, `parsers/spring`, etc.) using the same plugin interface — the real test of whether the plugin abstraction holds up.
2. Semantic/vector search alongside keyword search.
3. SDK generation via existing generators (openapi-generator, quicktype) fed from `generators/openapi` — do not build generators from scratch.
4. Developer Q&A assistant (RAG over the canonical graph) — only once the graph is trustworthy enough to answer from directly.
5. Formal intermediate representation layer — only if/when a second protocol paradigm (GraphQL, gRPC, AsyncAPI) is deliberately added.
6. Cross-repo/service dependency mapping as its own initiative with its own accuracy bar, kept out of the core catalog data model.
7. CI/CD integration (PR checks using the Phase 1 CLI), policy enforcement, API lifecycle states (draft/deprecated/retired).

**Testing gate:** same standard as Phase 1 applies to every new parser — capability declaration + semantic version + golden-repo suite required before merge, enforced in CI.

---

## Testing Strategy Summary (applies across all phases)

- **Unit tests** — every module, every commit.
- **Integration tests** — every commit; full pipeline against controlled fixtures.
- **Regression tests (golden-repo suites)** — every parser change + nightly; expected output changes require explicit, reviewed updates.
- **Contract tests** — every commit; frontend/backend and worker/engine interfaces from shared schemas, not hand-synced.
- **End-to-end tests** — pre-release only; full user journey plus SSRF rejection path.
- **Security-specific tests** — required: prompt-injection resistance in `llm-enrichment`, sandbox escape tests if any code execution exists, secrets-redaction verification, full SSRF/redirect/timeout coverage in `host-prober`, and the auth-field-never-auto-accepted rule.

## CI Pipeline Order

lint → unit tests → integration tests → golden-repo regression tests → build → (release branches only) e2e tests

## Non-Negotiable Guardrails (apply in every phase)

- LLM enrichment may only generate descriptions/examples/suggestions layered on statically-verified data — never structural facts.
- Auth, permissions, and rate-limit fields can never be marked "Verified" from AI inference alone, and can never be Auto-Accepted regardless of quality score.
- No untrusted repo code is ever executed — static parsing only, or fully network-isolated sandboxing if execution is ever required.
- Every extraction is reproducible from (repo, commit SHA, parser version) alone.
- Generated artifacts (OpenAPI, Markdown, SDKs) are always regenerable and never edited directly by humans.
- Only `host-prober` may contact a user-supplied URL; only `llm-enrichment` may contact an LLM; only the entities listed in the module map may touch the database — enforced architecturally via CI lint rules, not convention.
- True Auto-Accept is disabled until Phase 3, and only enabled for score bands supported by real production calibration data, not asserted upfront.



## Aditional Instructions(Apply is applicable) 

A vague "review this phase" prompt gets you a vague pass. Better to point Opus at specific things:

Re-check the phase's exit criteria from the roadmap doc, one by one — does the actual build satisfy each one, not just "does the code run."
Re-check the architecture guardrails specific to that phase (e.g. end of Phase 1: does validation-engine really have zero LLM dependency, enforced by the lint rule, not just by convention; end of Phase 2: does llm-enrichment actually fail closed on the security-field exception).
Run the golden-repo regression suite and flag anything Sonnet's changes broke silently.
Only after 1–3: suggest actual code improvements. This ordering matters — "does this satisfy the spec" should come before "how would I have written this," or you'll get stylistic rewrites instead of catching real gaps.