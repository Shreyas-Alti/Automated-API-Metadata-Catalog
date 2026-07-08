/**
 * Dependency-cruiser architecture boundary rules.
 *
 * Three hard boundaries enforced per plan:
 *  1. DB clients  — only canonical-graph, evidence-ledger, extraction-run-tracker,
 *                   audit-log, and auth-service may import them.
 *  2. LLM clients — only llm-enrichment may import them.
 *  3. HTTP client libs — only host-prober may import them (SSRF boundary).
 *
 * Severity: error → CI fails on any violation.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-db-outside-allowed-modules',
      comment:
        'Only canonical-graph, evidence-ledger, extraction-run-tracker, audit-log, ' +
        'and auth-service may import a database client. All others are forbidden.',
      severity: 'error',
      from: {
        pathNot: [
          'packages[\\\\/]canonical-graph',
          'packages[\\\\/]evidence-ledger',
          'packages[\\\\/]extraction-run-tracker',
          'packages[\\\\/]audit-log',
          'apps[\\\\/]auth-service',
          // packages/database IS the DB layer — it directly wraps @prisma/client
          'packages[\\\\/]database',
        ],
      },
      to: {
        path: 'node_modules[\\\\/](pg|pg-pool|typeorm|@prisma[\\\\/]client|knex|sequelize|drizzle-orm)',
      },
    },
    {
      name: 'no-llm-outside-llm-enrichment',
      comment:
        'Only llm-enrichment may import an LLM/AI client. ' +
        'All other modules are forbidden from calling LLMs directly.',
      severity: 'error',
      from: {
        pathNot: ['packages[\\\\/]llm-enrichment'],
      },
      to: {
        path: 'node_modules[\\\\/](openai|@anthropic-ai|@google[\\\\/]generative-ai|langchain|@langchain)',
      },
    },
    {
      name: 'no-http-client-outside-host-prober',
      comment:
        'Only host-prober may use HTTP client libraries for outbound requests. ' +
        'This is the sole SSRF boundary — all user-supplied URL access goes through it.',
      severity: 'error',
      from: {
        pathNot: ['packages[\\\\/]host-prober'],
      },
      to: {
        path: 'node_modules[\\\\/](axios|got|node-fetch|undici)',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
    },
  },
};
