const assert = require('assert');

const d = $__D.persist('d', () => Date.now());

function main() {
  const before = d.toString();
  $__D.checkpoint();
  const after = d.toString();
  assert.equal(before, after);
}

module.exports = main;
