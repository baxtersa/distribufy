import * as babel from 'babel-core';
import { CompilerOpts } from 'stopify-continuations';
import { plugin as distribufy } from '../transform/distribufy';
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
}
