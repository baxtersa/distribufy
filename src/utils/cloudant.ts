import { CheckpointRuntime } from '../runtime/checkpointable';

export type Options = {
  host: string,
  auth: string,
  db: string,
};

type InternalOptions = Options & {
  key: string,
  value?: any,
};

/**
 * Register checkpointing functions which invoke Cloudant requests.
 */
export function register(runtime: CheckpointRuntime, serviceUrl: string) {
  function request(method: string, options: InternalOptions) {
    return runtime.exec({
      action: 'http',
      args: {
        method,
        url: `https://${options.host}/${options.db}/${options.key}`,
        headers: {
          'Authorization': `Basic ${options.auth}`,
          'Content-Type': 'application/json',
        },
      },
      payload: options.value || {},
      serviceUrl,
    });
  }

  function get(key: string, options: Options) {
    return request('get', { ...options, key });
  }

  function insert(key: string, value: any, options: Options) {
    return request('put', { ...options, key, value });
  }

  delete this.register;
  return Object.assign(this, {
    get,
    insert,
  });
}
