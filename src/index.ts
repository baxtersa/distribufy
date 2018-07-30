import { CheckpointRuntime } from './runtime/checkpointable';

declare const global: { $__D: CheckpointRuntime };
module.exports = global.$__D || {};