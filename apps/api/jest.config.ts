import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['ts', 'js', 'json'], // ts before js so .ts wins when both exist
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.json',
    }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    // rootDir = apps/api/src → go up 3 levels to reach monorepo root
    '^@pg-system/types$': '<rootDir>/../../../packages/types/src/index.ts',
    '^@pg-system/constants$': '<rootDir>/../../../packages/constants/src/index.ts',
    '^@pg-system/utils$': '<rootDir>/../../../packages/utils/src/index.ts',
    '^@pg-system/validations$': '<rootDir>/../../../packages/validations/src/index.ts',
  },
};

export default config;
