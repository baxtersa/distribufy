const assert = require('assert');
let x = 0;
let y = 0;
let z = 0;

function foo() {
  while (false) {}
  x++;
  function bar() {
    while (false) {}
    y++;
    function baz() {
      while (false) {}
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

console.log(a, 3);
console.log(x, 1);
console.log(y, 1);
console.log(z, 1);
