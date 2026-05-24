// Polyfill for Object.hasOwn in Node.js < 16.9
if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop),
    writable: true,
    enumerable: false,
    configurable: true,
  });
}
