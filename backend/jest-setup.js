// Polyfill for Object.hasOwn in Node.js < 16.9
if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop),
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

// Jest's test globals (jest, describe, it, expect, ...) aren't auto-injected into
// unqualified scope when test files run as real ES modules (required because
// NestJS 12's packages are ESM-only -- see jest.config.js). Re-exposing them here
// on globalThis keeps every spec file's existing `jest.fn()` / `describe(...)`
// usage working without having to add `@jest/globals` imports everywhere.
const jestGlobals = require('@jest/globals');
Object.assign(globalThis, jestGlobals);
