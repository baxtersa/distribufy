/**
 * Runtime system for Node
 */
import { Runtime } from 'stopify-continuations';
import { InterruptEstimator } from 'stopify-estimators';
import { Depickler } from '../serialization/pickler';
import { SerializableRuntime } from './serializable';

export function init(rts: Runtime, buf?: Buffer): SerializableRuntime {
  // This is not ideal. These opts should be passed to the runtime when
  // it is constructed.
  rts.stackSize = Infinity;
  rts.remainingStack = Infinity;
  rts.restoreFrames = Infinity;

  const serializableRTS = new SerializableRuntime(rts);

  if (buf) {
    const depickle = new Depickler();

    const { continuation, persist } = depickle.deserialize(buf);
    serializableRTS.persistent_map = persist;
    serializableRTS.rts.stack = continuation;
  }

  const estimator = new InterruptEstimator(100);
  serializableRTS.setEstimator(estimator);

  return serializableRTS;
}

