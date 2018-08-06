import { join, run } from './runner';

interface Params {
  [key: string]: any;
  $continuation?: Buffer;
  $param?: any;
};

export function main(params: Params): any {
  console.log(JSON.stringify(params));
  if (params.$resume) {
    console.log('resuming');
    const conductor = Object.assign({}, params.$resume);
    delete params.$resume;
    return conductor;
  }

  if (params.payload && params.state) {  // invoked from service
    params = Object.assign({}, params.payload, params.state);
  }

  if (params.join) {
    console.log('joining');
    return join(params);
  }

  const continuation = params.$continuation;
  delete params.$continuation;

  const parameter = params;

  return run({ continuation, parameter })
}