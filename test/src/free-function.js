const assert = require('assert');

function g() {
  while (false) {}
  return 7;
}

function f() {
  return g() + 1;
}

function main() {
  assert.equal(f(), 8);
}

module.exports = main
