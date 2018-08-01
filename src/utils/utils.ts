import { CheckpointRuntime } from '../runtime/checkpointable';

/**
 * Register checkpointing utility functions.
 */
export function register(runtime: CheckpointRuntime, serviceUrl: string) {
  function action(action: string, params: any): any {
    return runtime.checkpoint($continuation =>
      ({ action, params, state: { $continuation: $continuation } }));
  }

  return {
    action,
  };
}
