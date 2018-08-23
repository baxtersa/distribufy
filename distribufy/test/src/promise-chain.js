const assert = require('assert');

function suspend(v) {
  $__D.checkpoint();
  console.log(i++);
  $__D.checkpoint();
  return ++v;
}
let i = $__D.persist('i', () => 0);

function main() {
  return Promise.resolve(42)
    .then(suspend)
    .then(suspend)
    .then(suspend)
    .then(suspend)
    .then(v => {
      console.log('asserting');
      assert.equal(v, 46);
      assert.equal(i, 4);
    });
}

module.exports = main;
