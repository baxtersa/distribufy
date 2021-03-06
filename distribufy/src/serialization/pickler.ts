import { Serializer } from '../utils/serializer';
import { native as nativeSym } from './symbol_map';
const v8 = require('v8');

function isNative(f: Function): boolean {
  return f.toString().indexOf('[native code]') !== -1;
}

const native = '$__native';
const user = '$__user';
const index = '$__index';
const functions = '$__functions';
const promises = '$__promises';
const symbols = '$__symbols';
const globals = '$__globals';
const cached = '$__cached';
const serializer = '$__serializer';

const cache = Symbol.for('cache');
const required = Symbol.for('required');

/**
 * `Pickler` wraps the v8 serialization API with methods for serializing
 * user-defined and native function values.
 */
export class Pickler {
  /** Map Function objects to ids to support sharing */
  private fn_id_map: Map<Object, number> = new Map();
  /** Map Promises to ids to support sharing */
  private promise_id_map: Map<Object, number> = new Map();
  /** The next id to assign a shared object that gets restructured */
  private fn_id = 0;
  private promise_id = 0;
  /** Reified fn objects that get assigned to object for serialization */
  private fns: any[] = [];
  private promises: any[] = [];

  private restructureProperties(key: string, value: any): any {
    let properties: any = {};
    for (const key of Object.getOwnPropertyNames(value)) {
      properties[key] = (<any>value)[key];
    }

    this.restructure(properties);

    return properties;
  }

  private restructureFn(key: string, value: Function, o: any): any {
    delete o[key];

    // Maintain identity of serialized functions
    let ix = this.fn_id_map.get(value)
    if (ix !== undefined) {
      o[key] = { type: index, value: ix };
      return;
    }

    const record: any = {
      type: isNative(value) ? native : user,
      value,
    };
    // Replace function with index into serialized fn array;
    this.fns.push(record);

    o[key] = { type: index, value: this.fn_id };
    this.fn_id_map.set(value, this.fn_id++);

    record.properties = this.restructureProperties(key, value);
  }

  private restructurePromise(key: string, value: Promise<any>, o: any): any {
    delete o[key];

    let ix = this.promise_id_map.get(value);
    if (ix !== undefined) {
      o[key] = { type: promises, value: ix };
      return;
    }

    const record = { type: promises, value };
    this.promises.push(record)

    o[key] = { type: promises, value: this.promise_id };
    this.promise_id_map.set(value, this.promise_id++);
  }

  private restructureMap(o: Map<any, any>): any {
    const keys = Array.from(o.keys());
    for (const key of keys) {
      const value = o.get(key);
      o.delete(key);

      const boxKey = { box: key };
      this.restructure(boxKey);
      const boxVal = { box: value };
      this.restructure(boxVal);

      o.set(key, value);
    }
  }

  private restructure(o: any): any {
    switch (typeof o) {
      case 'object':
      case 'function':
        // `null` has type 'object'
        if (o === null) {
          return;
        }

        if (o instanceof Map) {
          return this.restructureMap(o);
        }

        const props = Object.getOwnPropertyNames(o);
        for (const key of props) {
          const value = o[key];
          switch (typeof value) {
            case 'function':
              if (value[required]) {
                o[key] = { type: '$__required', value: value[required] };
                continue;
              } else if (value[cache]) {
                console.log('caching function');
                const cacheWrapper = { type: cached, value: value[cache] };
                this.restructureFn('value', value[cache], cacheWrapper);
                o[key] = cacheWrapper;
                continue;
              }
              this.restructureFn(key, value, o);
              break;
            case 'object':
              if (value instanceof Promise) {
                this.restructurePromise(key, value, o);
                continue;
              } else if (value === global) {
                o[key] = { type: globals };
                continue;
              } else if (value instanceof Serializer) {
                o[key] = { type: serializer };
                continue;
              } else if (value !== null && value[cache]) {
                console.log('caching object');
                const cacheWrapper = { type: cached, value: value[cache] };
                o[key] = cacheWrapper;
                console.log(value[cache]);
                this.restructureFn('value', value[cache], cacheWrapper);
                continue;
              } else if (value !== null && value[required]) {
                o[key] = { type: '$__required', value: value[required] };
                continue;
              }
              // Recursively restructure nested objects
              this.restructure(value);
              break;
            default:
              break;
          }
        }

        break;
      default:
        break;
    }
  }

  serializePromise(map: Map<any, any>, p: Promise<any>): any {
    const reified = map.get(p);
    return reified;
  }

  /**
   * Write the object `o` to a `Buffer`.
   *
   * Supports serialization of Function objects and class instances in
   * cooperation with the `Depickler` deserialization API.
   */
  serialize(o: any): Buffer {
    const box: any = { box: o };
    // Restructures Function objects and prototypes as serializable properties on `box`.
    this.restructure(box);
    box[functions] = this.fns.map(foo => ({
      type: foo.type,
      value: foo.type === native ? {
        type: symbols,
        value: Symbol.keyFor(foo.value[nativeSym]),
      } : foo.value.toString(),
      properties: foo.properties,
    }));

    box[promises] = this.promises.map(promise =>
      ({
        type: promise.type,
        value: this.serializePromise(box.box.promises, promise.value)
      }));
    delete box.box.promises;

    try {
      // Leverage v8 serialization API to preserve sharing
      return v8.serialize(box);
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
  constructor(private runtime: Serializer) {}

  /** Map Function objects to ids to support sharing */
  private fn_map: Map<number, Function> = new Map();
  /** Map Promises to ids to support sharing */
  private promise_map: Map<number, Promise<any>> = new Map();

  private filterFnProperties(obj: { [key: string]: any }): string[] {
    const properties = Object.getOwnPropertyNames(obj);
    return properties.filter(key =>
      !/^(prototype|arguments|caller|length|name)$/.test(key));
  }

  private reconstructFn(serial: any): Function {
    const { value } = serial;
    const fn = Function('require', `return ${value}`)(require);
    return fn;
  }

  private reconstructProperties(serial: any, ix: number): void {
    const { properties } = serial;
    const fn: any = this.fn_map.get(ix)!;
    for (const key of this.filterFnProperties(properties)) {
      if (fn[key] && typeof fn[key] === 'function') {
        console.log('continuing');
        continue;
      }

      this.dispatch(properties[key]);
      fn[key] = properties[key];
    }
  }

  private dispatch(o: any): any {
    switch (typeof o) {
      case 'object':
        // `null` has type 'object'
        if (o === null) {
          return;
        } else if (o === global) {
          return;
        }

        const props = Object.getOwnPropertyNames(o);
        for (const key of props) {
          const value = o[key];
          switch (typeof value) {
            case 'object':
              if (value && value.type === cached) {
                this.dispatch(value);
                o[key] = value.value();
              } else if (value && value.type === index) {
                o[key] = this.fn_map.get(value.value);
              } else if (value && value.type === globals) {
                o[key] = global;
              } else if (value && value.type === promises) {
                o[key] = this.promise_map.get(value.value);
              } else if (value && value.type === serializer) {
                o[key] = this.runtime;
              } else if (value && value.type === '$__required') {
                o[key] = this.runtime.modules.get(value.value);
              } else {
                this.dispatch(value);
              }
              break;
            default:
              break;
          }
        }
        break;
    }
  }

  private reconstructPromise(serial: any): Promise<any> {
    if (serial.type !== promises) {
      throw new Error(`Attempting to reconstruct a promise, but got ${serial}`);
    }

    const reified = serial.value;
    if (typeof reified === 'number') {
      return this.promise_map.get(reified)!;
    }

    switch (reified.status) {
      case 'pending':
        console.log('pending');
        break;
      case 'fulfilled':
        return Promise.resolve(reified.value);
      case 'rejected':
        break;
      default:
        throw new Error(`unreachable: ${reified}`);
    }

    return Promise.resolve();
  }

  private reconstruct(o: any): any {
    o[functions].forEach((serial: any, ix: number) => {
      if (serial.type === user) {
        this.fn_map.set(ix, this.reconstructFn(serial));
      } else {
        this.fn_map.set(ix, eval(serial.value.value))
      }
    });
    o[functions].forEach((serial: any, ix: number) => {
      if (serial.type === user) {
        this.reconstructProperties(serial, ix);
      } else {
        this.fn_map.set(ix, eval(serial.value.value))
      }
    });

    o[promises].forEach((serial: any, ix: number) => {
      const p = this.reconstructPromise(serial);
      this.promise_map.set(ix, p);
      this.promise_map.set(serial.value, p);
    });
    this.dispatch(o[promises].map((o: any) => o.value));
    o[promises].map((o: any) => o.value).forEach((p: any, ix: number) => {
      if (p.resolvesTo) {
        const promise = this.promise_map.get(p)!;
        promise.then(p.resolvesTo);
      }
    });

    const data = o.box;
    switch (typeof data) {
      case 'object':
        if (data.type === index) {
          o.box = this.fn_map.get(data.value);
        } else if (data.type === globals) {
          o.box = global;
        } else {
          this.dispatch(data);
        }
    }
  }

  /**
   * Deserialize the `Buffer` `buffer` into an object.
   *
   * Supports deserialization of Function objects and class instances in
   * cooperation with the `Pickler` Serialization API.
   */
  deserialize(buffer: Buffer): any {
    // Deserialize into a raw object using the v8 API
    const o = v8.deserialize(buffer);

    // Traverse the raw object, reifying Function objects and class instances
    this.reconstruct(o);
    return o.box;
  }
};
