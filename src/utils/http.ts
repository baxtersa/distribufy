import { CheckpointRuntime } from '../runtime/checkpointable';
const needle = require('needle');

/**
 * Register checkpointing functions which invoke HTTP requests and resume
 * checkpoints with the response body.
 */
export function register(runtime: CheckpointRuntime) {
  function request(method: string, uri: string, options: any) {
    // Return the result of the checkpoint. This captures and serializes the
    // continuation.
    return runtime.checkpoint(k =>
      // Once the continuation is captured and serialized, invoke an HTTP
      // request.
      needle(method, uri, { ...options, json: true })
        .then((response: any) =>
        // Return a conductor action result with the response body, and the
        // serialized continuation as the `state`. The `echo` action forwards
        // the HTTP response back to the main conductor action, which resumes
        // from the continuation with the response.
        ({
          action: '/whisk.system/utils/echo',
          params: response.body,
          state: { $continuation: k },
        })));
  }

  // HTTP GET
  function get(uri: string, options: any) {
    return request('GET', uri, options);
  }

  // HTTP PUT
  function put(uri: string, options: any) {
    return request('PUT', uri, options);
  }

  // HTTP POST
  function post(uri: string, options: any) {
    return request('POST', uri, options);
  }

  // HTTP DELETE
  function Delete(uri: string, options: any) {
    return request('DELETE', uri, options);
  }

  return {
    get,
    delete: Delete,
    put,
    post,
  };
}