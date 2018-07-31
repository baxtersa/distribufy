import { CheckpointRuntime } from '../runtime/checkpointable';

/**
 * Register checkpointing functions which invoke HTTP requests and resume
 * checkpoints with the response body.
 */
export function register(runtime: CheckpointRuntime, serviceUrl: string) {
  function request(method: string, url: string, options: any) {
    return runtime.exec({
      action: 'http',
      args: { method, url },
      serviceUrl,
    });
  }

  // HTTP GET
  function get(uri: string, options: any) {
    return request('get', uri, options);
  }

  // HTTP PUT
  function put(uri: string, options: any) {
    return request('put', uri, options);
  }

  // HTTP POST
  function post(uri: string, options: any) {
    return request('post', uri, options);
  }

  // HTTP DELETE
  function Delete(uri: string, options: any) {
    return request('delete', uri, options);
  }

  return {
    get,
    delete: Delete,
    put,
    post,
  };
}