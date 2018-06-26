const assert = require('assert');

function g() {
  return 7;
}

function f() {
  return g() + 1;
}

assert.equal(f(), 8);
