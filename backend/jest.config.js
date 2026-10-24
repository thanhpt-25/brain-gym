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
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  moduleNameMapper: {},
  setupFiles: ['<rootDir>/../jest-setup.js'],
  // NestJS 12's packages ship as ESM-only (package.json "type": "module"); Jest
  // can only load those natively in its own ESM mode, so tests run under
  // `--experimental-vm-modules` (see package.json's "test*" scripts) with our
  // .ts files compiled to ESM too. This doesn't affect the real app build:
  // `nest build` still emits CommonJS, since backend/package.json has no
  // "type": "module" and its tsconfig.json is untouched.
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          target: 'ES2020',
          module: 'ES2022',
          moduleResolution: 'node',
          resolvePackageJsonExports: false,
        },
      },
    ],
  },
};
