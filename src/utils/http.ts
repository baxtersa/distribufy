import { CheckpointRuntime } from '../runtime/checkpointable';

/**
 * Register checkpointing functions which invoke HTTP requests and resume
 * checkpoints with the response body.
 */
export function register(runtime: CheckpointRuntime, serviceUrl: string) {
  function request(method: string, url: string, data: any, options: any) {
    return runtime.exec({
      action: 'http',
      args: Object.assign({}, { method, url }, data, options),
      serviceUrl,
    });
  }

  // HTTP GET
  function get(uri: string, data: any,  options: any) {
    return request('get', uri, data, options);
  }

  // HTTP PUT
  function put(uri: string, data: any, options: any) {
    return request('put', uri, data, options);
  }

  // HTTP POST
  function post(uri: string, data: any, options: any) {
    return request('post', uri, data, options);
  }

  // HTTP DELETE
  function Delete(uri: string, data: any, options: any) {
    return request('delete', uri, data, options);
  }

  delete this.register;
  return Object.assign(this, {
    get,
    delete: Delete,
    put,
    post,
  });
}