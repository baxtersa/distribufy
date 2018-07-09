import { compile } from './compiler/compiler';
import { CompilerOpts, getSourceMap } from 'stopify-continuations';
import { checkAndFillCompilerOpts } from 'stopify-continuations/dist/src/compiler/check-compiler-opts';

export function distribufy(src: string,
  opts: Partial<CompilerOpts>): string {
  return compile(src, checkAndFillCompilerOpts(opts, getSourceMap(src)));
}
