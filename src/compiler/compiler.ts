import * as babel from 'babel-core';
import { CompilerOpts, getSourceMap } from 'stopify-continuations';
import { checkAndFillCompilerOpts } from 'stopify-continuations/dist/src/compiler/check-compiler-opts';
import { plugin } from '../transform/distribufy';
import { default as pickle } from '../serialization/transform/scope';

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
    plugins: [[ plugin, opts ]],
    babelrc: false,
    ast: false,
    code: true,
    comments: false,
  };

  const { code } = babel.transform(src, babelOpts);
  babelOpts.plugins = [[pickle]];
  const { code: checkpointed } = babel.transform(code!, babelOpts);
  return checkpointed!;
}


export function distribufy(src: string,
  opts: Partial<CompilerOpts>): string {
  return compile(src, checkAndFillCompilerOpts(opts, getSourceMap(src)));
}