/**
 * Runtime system for Node
 */
import { Runtime } from 'stopify-continuations';
import { CheckpointRuntime } from './checkpointable';

export function init(rts: Runtime): CheckpointRuntime {
  // This is not ideal. These opts should be passed to the runtime when
  // it is constructed.
  rts.stackSize = Infinity;
  rts.remainingStack = Infinity;
  rts.restoreFrames = Infinity;

  const checkpointRTS = new CheckpointRuntime(rts);

  return checkpointRTS;
}

