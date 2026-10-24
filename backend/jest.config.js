// Polyfill for Object.hasOwn in Node.js < 16.9 (required before ts-jest loads)
if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop),
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  moduleNameMapper: {
    // The Prisma 7 generated client (src/generated/prisma) emits relative
    // imports with explicit `.js` extensions, which is correct for tsc's
    // `nodenext` module resolution (it maps them back to the sibling
    // `.ts` source, and to the real compiled `.js` file in `dist/` at
    // runtime) but Jest's resolver has no such mapping. Strip the `.js`
    // suffix so Jest falls back to resolving the `.ts` source directly.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/../jest-setup.js'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2020',
          module: 'commonjs',
          moduleResolution: 'node',
          resolvePackageJsonExports: false,
        },
      },
    ],
    '^.+\\.jsx?$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          target: 'ES2020',
          module: 'commonjs',
          moduleResolution: 'node',
          resolvePackageJsonExports: false,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    // Transform uuid (ESM-only in v9+) and other packages that ship as ESM
    'node_modules/(?!(@nestjs|@prisma|class-transformer|class-validator|uuid)/)',
  ],
};
