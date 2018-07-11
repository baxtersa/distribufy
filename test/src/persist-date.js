const assert = require('assert');

const d = $__D.persist('d', () => Date.now());

function suspend() {
  while (false) {}
}

function main() {
  const before = d.toString();
  suspend();
  const after = d.toString();
  assert.equal(before, after);
}

module.exports = main;
