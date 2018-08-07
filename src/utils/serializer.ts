import * as fs from 'fs';
import { Stack } from 'stopify-continuations';
import { ReifiedPromise } from '../runtime/checkpointable';
import { Pickler, Depickler } from '../serialization/pickler';

export class Serializer {
  private pickle = new Pickler();
  private depickle = new Depickler(this);

  /**
   * Maps identifiers to values to be persisted for initialization code re-run
   * when restoring checkpoints.
   */
  public persistent_map = new Map<string, any>();
  /** Maps `Promise` references to reified promise state for serialization. */
  public promises = new Map<Promise<any>, ReifiedPromise<any>>();
  public modules = new Map<string, any>();

  /**
   * Utility function to persist non-deterministic initialization code that
   * gets rerun across checkpoints.
   *
   * @param id - Identifier storing persisted value in serialized Map
   * @param e  - Thunk which evaluates to the value to be persisted
   */
  persist<T>(id: string, e: () => T): T {
    let v = this.persistent_map.get(id);
    if (v === undefined) {
      v = e();
      this.persistent_map.set(id, v);
    }
    return v;
  }

  require(path: string): any {
    const reqd = require('../../' + path);
    reqd[Symbol.for('required')] = path;
    this.modules.set(path, reqd);
    return reqd;
  }

  serialize(continuation: Stack): Buffer {
    const o = {
      continuation,
      persist: this.persistent_map,
//      promises: this.promises,
    };
    const continuationBuffer = this.pickle.serialize(o);
    fs.writeFileSync('continuation.data', continuationBuffer);
    return continuationBuffer;
  }

  deserialize(buffer: Buffer): Stack {
    const { continuation, persist } = this.depickle.deserialize(buffer);
    this.persistent_map = persist;
    return continuation as Stack;
  }
}