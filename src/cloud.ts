import { run } from './runner';

interface Params {
  [key: string]: any;
  $continuation?: Buffer;
  $param?: any;
};

export function main(params: Params): any {
  console.log(params);
  if (params.payload && params.state) {  // invoked from service
    params = Object.assign({}, params.payload, params.state);
  }

  const continuation = params.$continuation;
  delete params.$continuation;

  const parameter = params;

  return run({ continuation, parameter })
}