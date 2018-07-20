const assert = require('assert');

function main() {
  function suspend(v) {
    $__D.checkpoint();
    console.log(i++);
    $__D.checkpoint();
    return ++v;
  }
  let i = 0;

  return new Promise((resolve, reject) => {
    resolve(42);
  }).then(suspend)
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
