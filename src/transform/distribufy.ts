import * as t from 'babel-types';
import { NodePath, Visitor } from 'babel-traverse';
import { plugin as callcc, transformFromAst, fastFreshId } from 'stopify-continuations';
import { plugin as pickle } from 'jsPickle';

import insertCheckpoints from './insertCheckpoints';

function timeSlow<T>(label: string, thunk: () => T): T {
  const start = Date.now();
  const result = thunk();
  const end = Date.now();
  const elapsed = end - start;
  if (elapsed > 2000) {
    console.info(`${label} (${elapsed} ms)`);
  }
  return result;
}

const visitor: Visitor = {
  Program(path: NodePath<t.Program>, state): void {
    const opts = state.opts;

    fastFreshId.init(<any>path);

    const onDoneBody: t.Statement[] = [];
    opts.onDone = t.functionExpression(fastFreshId.fresh('onDone'), [t.identifier('result')],
      t.blockStatement(onDoneBody));
    if (!opts.compileFunction) {
      onDoneBody.push(
        t.expressionStatement(
          t.callExpression(
            t.memberExpression(t.identifier('$__D'), t.identifier('onEnd')),
            [t.identifier('result')])));
    }

//    timeSlow('insertCheckpoints', () =>
//      transformFromAst(<any>path, [insertCheckpoints]));

    timeSlow('(control ...) elimination', () =>
      transformFromAst(<any>path, [[callcc, opts]]));

//    timeSlow('pickling', () =>
//      transformFromAst(<any>path, [pickle]));

    // var $__D = require('distribufy/dist/runtime/node').init($__R);;
    path.node.body.splice(opts.eval ? 3 : 2, 0,
      t.variableDeclaration('var',
        [t.variableDeclarator(
          t.identifier('$__D'),
          t.callExpression(
            t.memberExpression(
              t.callExpression(t.identifier('require'),
                [t.stringLiteral('distribufy/dist/src/runtime/node')]),
              t.identifier('init')),
            [t.identifier('$__R')]))]));
  },
};

export function plugin() {
  return { visitor };
}
