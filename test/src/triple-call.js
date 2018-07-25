const assert = require('assert');

function main() {
  let x = 0;
  let y = 1;
  let z = 2;

  function foo() {
    $__D.checkpoint();
    x++;
    function bar() {
      $__D.checkpoint();
      y++;
      function baz() {
        $__D.checkpoint();
        z++;
        return x+y+z;
      }
      return {
        baz,
      }
    }
    return {
      bar,
    }
  }

  const o1 = foo();
  console.log('foo called');
  const o2 = o1.bar();
  console.log('bar called');
  const a = o2.baz();
  console.log('baz called');
  foo();

  assert.equal(a, 6);
  assert.equal(x, 2);
  assert.equal(y, 2);
  assert.equal(z, 3);
}

module.exports = main;
