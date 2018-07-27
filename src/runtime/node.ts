/**
 * Runtime system for Node
 */
import { Runtime } from 'stopify-continuations';
import { InterruptEstimator } from 'stopify-estimators';
import { Depickler } from '../serialization/pickler';
import { CheckpointRuntime } from './checkpointable';

export function init(rts: Runtime, buf?: Buffer): CheckpointRuntime {
  // This is not ideal. These opts should be passed to the runtime when
  // it is constructed.
  rts.stackSize = Infinity;
  rts.remainingStack = Infinity;
  rts.restoreFrames = Infinity;

  const checkpointRTS = new CheckpointRuntime(rts);

  if (buf) {
    const depickle = new Depickler();

    const { continuation, persist } = depickle.deserialize(buf);
    checkpointRTS.persistent_map = persist;
    checkpointRTS.rts.stack = continuation;
  }

  const estimator = new InterruptEstimator(100);
  checkpointRTS.setEstimator(estimator);

  return checkpointRTS;
}

