const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    // Mirrors tsconfig.json's "@/*" path alias. next/jest resolves this
    // automatically for plain `import`s, but jest.mock()'s target string
    // is resolved separately and needs it spelled out explicitly.
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/agent-skills-for-context-engineering/"],
};

module.exports = createJestConfig(customJestConfig);
