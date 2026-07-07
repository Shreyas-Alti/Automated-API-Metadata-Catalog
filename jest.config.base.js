/** @type {import('jest').Config} */
const baseConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__integration__/**/*.test.ts',
    '**/__golden__/**/*.test.ts',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
};

module.exports = baseConfig;
