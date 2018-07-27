import { run } from './runner';

interface Params {
  [key: string]: any;
  $continuation?: Buffer;
  $param?: any;
};

export function main(params: Params): any {
  const continuation = params.$continuation;
  delete params.$continuation;
  const parameter = params;

  return run({ filename: '../tmp', continuation, parameter })
}