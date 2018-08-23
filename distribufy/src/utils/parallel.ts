import { CheckpointRuntime } from '../runtime/checkpointable';
import * as openwhisk from 'openwhisk';
import { register as registerAction } from './utils';

/**
 * Register checkpointing functions which invoke parallel actions.
 */
export function register(runtime: CheckpointRuntime, serviceUrl: string) {
  const { action: reinvoke } = registerAction(runtime, serviceUrl);
  let wsk: openwhisk.Client;

  function map(action: string, values: any[]): Promise<any> {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(`reinvoking\naction was: ${action}\nvalues was: ${JSON.stringify(values)}`);
      return reinvoke(process.env.__OW_ACTION_NAME!, {});
    }

    return runtime.checkpoint(k => {
      if (!wsk) {
        wsk = openwhisk({ ignore_certs: true });
      }

      console.log('forking', values.length);
      return runtime.fork(values.length, serviceUrl, k)
        .then((response: any) => {
          return Promise.all(values.map((value, position) => {
            console.log(value, position);
            if (value === null || typeof value !== 'object') {
              value = { value };
            }

            const join = {
              barrierId: response.body.id,
              position,
            };

            const params = Object.assign({}, { $resume: { action, params: value, state: { join, serviceUrl } } });
            console.log('conductor reinvoke', params);
            return wsk.actions.invoke({
              name: process.env.__OW_ACTION_NAME!,
              params,
            });
          }))
            .then(() => ({ params: { method: 'map', serviceId: response.body.id } }),
              (error: any) => {
                console.error(error); // Promise.all failed
                return { params: { message: 'Internal Error' } };
              });
        },
        (error: any) => {
          console.error(error); // fork failed
          return { params: { message: 'Internal Error' } };
        });
    })
  }

  return {
    map,
  };
}