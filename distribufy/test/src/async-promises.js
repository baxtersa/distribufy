const assert = require('assert');

let i = 0;

function h() {
  console.log('foo');
  return 1;
}

function f() {
  $__D.checkpoint();
}

async function g() {
  $__D.checkpoint();
  await Promise.resolve((f(), 1));
  console.log('sleeping within g');
  $__D.sleep(1000);
  return Promise.resolve(i);
}

async function j() {
  console.log('starting');
  $__D.checkpoint();
  let v = await Promise.resolve(42)
  assert.equal(v, 42);
  console.log('sleep 1');
  $__D.sleep(1000);
  console.log('sleep 2');
  $__D.sleep(1000);
  console.log('done waiting...');
  f();
  assert.equal(i, 0);
  i = v;
  v = await g();

  console.log('sleeping after g');
  $__D.sleep(1000);

  assert.equal(i, v);
  console.log('done');
}

function main() {
  $__D.promise(j());

  assert.equal(i, 0);
  console.log('end');
}

module.exports = main;
