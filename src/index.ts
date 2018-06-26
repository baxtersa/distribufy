import { compile } from './compiler/compiler';
import { CompilerOpts } from 'stopify-continuations';
import { checkAndFillCompilerOpts } from 'stopify-continuations/dist/src/compiler/check-compiler-opts';
import { getSourceMap } from 'stopify-continuations';

export function distribufy(src: string,
  opts: Partial<CompilerOpts>): string {
  return compile(src, checkAndFillCompilerOpts(opts, getSourceMap(src)));
}

//import * as $__T from 'stopify-continuations/dist/src/runtime/runtime';
//const $__R = $__T.newRTS('lazy');
//
//console.log($__R);
