const assert = require('assert');

function g() {
  return 7;
}

function f() {
  return g() + 1;
}

function main() {
  assert.equal(f(), 8);
}

module.exports = main
