/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.unit.test.ts',
    '**/*.unit.test.tsx'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/',
    '/tests/visual-regression/',
    '/.next/'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^chat$': '<rootDir>/node_modules/chat/dist/index.js',
    '^chat/(.*)$': '<rootDir>/node_modules/chat/dist/$1',
  },
  // Allow Jest to transform ESM packages that are imported by our code
  transformIgnorePatterns: [
    'node_modules/(?!(chat|@chat-adapter)/)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        jsx: 'react-jsx'
      }
    }]
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/services/**/*.{ts,tsx}',
    '!src/services/**/*.d.ts',
    '!src/**/__tests__/**'
  ],
  // Ratchet thresholds — set to current actuals (branches: 11%, functions: 22%,
  // lines: 18%, statements: 17%) minus a 2-point buffer. Increase these as
  // coverage improves; never lower them.
  coverageThreshold: {
    global: {
      branches: 9,
      functions: 20,
      lines: 15,
      statements: 15
    }
  },
  // Setup file for jsdom environment tests (only runs when jsdom is used)
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
  verbose: true
};

module.exports = config;
