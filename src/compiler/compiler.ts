import * as babel from 'babel-core';
import { CompilerOpts } from 'stopify-continuations';
import { plugin as distribufy } from '../transform/distribufy';
import { plugin as pickle } from 'jsPickle';

/**
 * Compiles (i.e., "distribufies") a program. This function should not be used
 * directly by clients of Distribufy.
 *
 * @param src the program to Distribufy
 * @param opts compiler options
 * @returns the distribufied program
 */
export function compile(src: string, opts: CompilerOpts): string {
  const babelOpts = {
    plugins: [[ distribufy, opts ]],
    babelrc: false,
    ast: false,
    code: true,
    comments: false,
  };

  const { code } = babel.transform(src, babelOpts);
  babelOpts.plugins = [[pickle]];
  const { code: checkpointed } = babel.transform(code!, babelOpts);
  return checkpointed!;

//  const babelOpts = {
//    plugins: [[ distribufy, opts ]],
//    babelrc: false,
//    ast: true,
//    code: false,
//    comments: false,
//  };
//
//  const { ast } = babel.transform(src, babelOpts);
//  babelOpts.plugins = [[pickle]];
//  babelOpts.code = true;
//  babelOpts.ast = false;
//  const { code } = babel.transformFromAst(ast!, undefined, babelOpts);
//  return code!;
}
