// Jest e2e mock for the `uuid` package.
//
// `uuid@13` ships as pure ESM ("type": "module", no CJS build). The e2e
// suite runs with NODE_OPTIONS=--experimental-vm-modules (required so
// Jest's sandbox permits the dynamic `import()` the Prisma 7 WASM query
// compiler performs on $connect()). Under that flag, Jest defers
// packages whose nearest package.json declares "type": "module" to the
// real ESM loader instead of its usual CJS transform pipeline, which
// breaks `require('uuid')` from our CommonJS-compiled test/app code.
//
// `crypto.randomUUID()` (Node builtin, CommonJS) returns the same
// RFC4122 v4 UUID format as uuid's `v4()`, so this is a drop-in
// replacement for the one export the codebase uses.
const { randomUUID } = require('crypto');

module.exports = { v4: randomUUID };
