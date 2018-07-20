import * as t from 'babel-types';
import { NodePath, Visitor } from 'babel-traverse';
import {
  plugin as callcc,
  transformFromAst,
  fastFreshId,
  flatness,
} from 'stopify-continuations';

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

    timeSlow('flatness', () =>
      transformFromAst(<any>path, [flatness]));

    timeSlow('(control ...) elimination', () =>
      transformFromAst(<any>path, [[callcc, opts]]));
  },
};

export function plugin() {
  return { visitor };
}
