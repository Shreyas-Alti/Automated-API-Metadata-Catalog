/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
// VIOLATION FIXTURE — intentional forbidden import.
// This file exists solely so the negative test for no-child-process-outside-repository-loader
// can verify that dependency-cruiser exits non-zero and names the rule.
// It must never be imported from production code.
export const _fixture = require('child_process');
