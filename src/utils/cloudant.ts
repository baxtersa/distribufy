import { CheckpointRuntime } from '../runtime/checkpointable';
import * as utils from './utils';

type Options = {
  host: string,
  auth: string,
  db: string,
};

/**
 * Register checkpointing functions which invoke Cloudant requests.
 */
export function register(runtime: CheckpointRuntime, serviceUrl: string) {
  const { action } = utils.register(runtime, serviceUrl);

  function upsert(kv: { key: string, value: any }, options: Options) {
    return action('cloudant', {
      key: kv.key,
      value: kv.value,
      url: options.host,
      password: options.auth,
      db: options.db,
    });
  }

  return {
    upsert,
  }
}
