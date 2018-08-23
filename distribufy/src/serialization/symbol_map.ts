export const native: symbol = Symbol('native');

function uniquify(ctor: string, fn: any): void {
  fn[native] = Symbol.for(`${ctor}.${fn.name}`);
}

Object.getOwnPropertyNames(Math)
  .filter(x => typeof eval(`Math.${x}`) === 'function')
  .forEach(x => uniquify('Math', eval(`Math.${x}`) as Function));
