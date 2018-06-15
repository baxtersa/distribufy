const v8 = require('v8');

function isNative(f: Function): boolean {
  return f.toString().indexOf('[native code]') !== -1;
}

const native = '$__native';
const user = '$__user';
const index = '$__index';
const functions = '$__functions';

/**
 * `Pickler` wraps the v8 serialization API with methods for serializing
 * user-defined and native function values.
 */
export class Pickler {
  /** Map Function objects to ids to support sharing */
  private id_map: Map<Object, number> = new Map();
  /** The next id to assign a shared object that gets restructured */
  private fn_id = 0;
  /** Reified fn objects that get assigned to object for serialization */
  private fns: any[] = [];

  private restructureFn(key: string, value: Function, o: any): any {
    // Maintain identity of serialized functions
    let ix = this.id_map.get(value)
    if (ix !== undefined) {
      o[key] = { type: index, value: ix };
      return;
    }

    // Replace function with index into serialized fn array;
    this.fns.push({ type: isNative(value) ? native : user, value });
    o[key] = { type: index, value: this.fn_id };
    this.id_map.set(value, this.fn_id++);
  }

  private restructureObject(key: string, value: Object, o: any): any {
    let ix = this.id_map.get(value)
    if (ix !== undefined) {
      o[key] = { type: index, value: ix };
      return;
    }
  }

  private restructure(o: any): any {
    const props = Object.getOwnPropertyNames(o);
    for (const key of props) {
      const value = o[key];
      switch (typeof value) {
        case 'function':
          this.restructureFn(key, value, o);
          break;
        case 'object':
          // Recursively restructure nested objects
          this.restructure(value);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Write the object `o` to a `Buffer`.
   *
   * Supports serialization of Function objects and class instances in
   * cooperation with the `Depickler` deserialization API.
   */
  serialize(o: any): Buffer {
    // Restructures Function objects and prototypes as serializable properties on `o`.
    this.restructure(o);
    o[functions] = this.fns.map(({ type, value }) =>
      ({ type, value: type === native ? value.name : value.toString() }));
    try {
      // Leverage v8 serialization API to preserve sharing
      return v8.serialize(o);
    } catch (e) {
      throw new Error(`Error: restructured object not serializable\n${e}`);
    }
  }
};

/**
 * `Depickler` wraps the v8 deserialization API with methods for deserializing
 * user-defined and native function values.
 *
 * Functions are deserialized to their textual representation and must be
 * reallocated within the same scope as the originally defined function, i.e.
 * closed-over variables within the serialized function must be restored to the
 * scope before the function is reallocated from its string representation.
 */
export class Depickler {
  private reconstruct(o: any): any {
    console.log(o);
    if (o.type === user) {
      console.log(o.value);
      return () => (Function(`return ${o.value}`)());
    }
  }

  private detraverse(o: any): any {
    const fns = o[functions];
    const props = Object.getOwnPropertyNames(o);
    for (const key of props) {
      const value = o[key];
      switch (typeof value) {
        case 'object':
          if (value.type === index) {
            o[key] = this.reconstruct(fns[value.value]);
          } else {
            this.detraverse(value);
          }
          break;
        default:
          break;
      }
    }
    delete o[functions];
  }

  /**
   * Deserialize the `Buffer` `buffer` into an object.
   *
   * Supports deserialization of Function objects and class instances in
   * cooperation with the `Pickler` Serialization API.
   */
  deserialize(buffer: Buffer): Object {
    // Deserialize into a raw object using the v8 API
    const o = v8.deserialize(buffer);

    // Traverse the raw object, reifying Function objects and class instances
    this.detraverse(o);
    return o;
  }
};
