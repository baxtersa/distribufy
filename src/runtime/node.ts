/**
 * Runtime system for Node
 */
import { Runtime } from 'stopify-continuations';
import { InterruptEstimator } from 'stopify-estimators';
import { Depickler } from 'jsPickle';
import { SerializableRuntime } from './serializable';
import { polyfillPromises } from '../promises';

let continuationsRTS: Runtime | undefined;

export function init(rts: Runtime, buf?: Buffer) {
  continuationsRTS = rts;

  // This is not ideal. These opts should be passed to the runtime when
  // it is constructed.
  continuationsRTS.stackSize = Infinity;
  continuationsRTS.remainingStack = Infinity;
  continuationsRTS.restoreFrames = Infinity;

  const serializableRTS = new SerializableRuntime(continuationsRTS);
  polyfillPromises(serializableRTS);

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

