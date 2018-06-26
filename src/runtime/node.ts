/**
 * Runtime system for Node
 */
import { Runtime } from 'stopify-continuations';
import { SerializableRuntime } from './serializable';

let continuationsRTS: Runtime | undefined;

export function init(rts: Runtime) {
  continuationsRTS = rts;

  // This is not ideal. These opts should be passed to the runtime when
  // it is constructed.
  continuationsRTS.stackSize = Infinity;
  continuationsRTS.remainingStack = Infinity;
  continuationsRTS.restoreFrames = Infinity;

  const serializableRTS = new SerializableRuntime(continuationsRTS);

  return serializableRTS;
}

