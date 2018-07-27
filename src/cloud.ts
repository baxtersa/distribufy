import { run } from './runner';

interface Params {
  [key: string]: any;
  $continuation?: Buffer;
  $param?: any;
};

interface HasState {
  state: any;
};

function restoreFilename<T extends HasState>(filename: string, result: T | Promise<T>): T | Promise<T> {
  if (result instanceof Promise) {
    return result.then(r => restoreFilename(filename, r));
  } else if (result.state) {
    result.state.$filename = filename;
  }

  return result;
}

export function main(params: Params): any {
  const continuation = params.$continuation;
  const filename = params.$filename;
  delete params.$continuation;
  delete params.$filename;

  const parameter = params;

  const result = run({ filename: `../${filename}`, continuation, parameter })
  return restoreFilename(filename, result);
}