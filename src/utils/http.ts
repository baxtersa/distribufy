import { CheckpointRuntime } from '../runtime/checkpointable';
const needle = require('needle');

declare const $__D: CheckpointRuntime & { http: any };

function request(method: string, uri: string, options: any) {
  return $__D.checkpoint(k =>
    needle(method, uri, { ...options, json: true })
      .then((response: any) => ({
        action: '/whisk.system/utils/echo',
        params: response.body,
        state: { $continuation: k },
      })));
}

function get(uri: string, options: any) {
  return request('GET', uri, options);
}

function put(uri: string, options: any) {
  return request('PUT', uri, options);
}

function post(uri: string, options: any) {
  return request('POST', uri, options);
}

function Delete(uri: string, options: any) {
  return request('DELETE', uri, options);
}

module.exports = {
  get,
  delete: Delete,
  put,
  post,
}