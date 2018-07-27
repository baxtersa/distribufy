import { run } from './runner';

interface Params {
  [key: string]: any;
  $continuation?: Buffer;
  $param?: any;
};

export function main(params: Params): any {
  const continuation = params.$continuation;
  const filename = params.$filename;
  delete params.$continuation;
  delete params.$filename;

  const parameter = params;

  const result = run({ filename: `../${filename}`, continuation, parameter })
  if (result.state) {
    result.state.$filename = filename;
  }

  return result;
}