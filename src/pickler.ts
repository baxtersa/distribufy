const v8 = require('v8');

function isNative(f: Function): boolean {
  return f.toString().indexOf('[native code]') !== -1;
}

const native = '$__native';
const user = '$__user';
const index = '$__index';
const functions = '$__functions';
const symbols = '$__symbols';

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

  private restructure(o: any): any {
    switch (typeof o) {
      case 'object':
      case 'function':
        // `null` has type 'object'
        if (o === null) {
          return;
        }

        const props = Object.getOwnPropertyNames(o);
        for (const key of props) {
          const value = o[key];
          switch (typeof value) {
            case 'function':
              this.restructureFn(key, value, o);
              break;
            case 'object':
              if (value === global) {
                o[key] = 'global';
                break;
              }
              // Recursively restructure nested objects
              this.restructure(value);
              break;
            case 'symbol':
              o[key] = value.toString();
              break;
            default:
              break;
          }
        }

        const syms = Object.getOwnPropertySymbols(o);
        for (const key of syms) {
          this.restructure(o[key]);
          o[symbols] = o[symbols] || {};
          o[symbols][key.toString()] = o[key];
          delete o[key];
        }
        break;
      case 'symbol':
        o = o.toString();
        break;
      default:
        break;
    }
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
    box[functions] = this.fns.map((foo: any/*{ type, value }*/) => {
      // Restructure function properties to serialize
      let o: any = {};
      for (const key of Object.getOwnPropertyNames(foo.value)) {
        o[key] = foo.value[key];
      }

      this.restructure(o);

      return {
        type: foo.type,
        value: foo.type === native ? foo.value.name : foo.value.toString(),
        properties: o,
      };
    });

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
  /** Map Function objects to ids to support sharing */
  private fn_map: Map<number, Function> = new Map();

  private filterFnProperties(obj: { [key: string]: any }): string[] {
    const properties = Object.getOwnPropertyNames(obj);
    return properties.filter(key =>
      !/^(arguments|caller|length|name)$/.test(key));
  }

  private reconstructFn(serial: any): Function {
    const { value, properties } = serial;
    const fn = Function('require', `
var $__T = require("stopify-continuations/dist/src/runtime/runtime");
var $__R = $__T.newRTS("catch");
var $__D = require("distribufy/dist/src/runtime/node").init($__R);
return ${value}`)(require);
    for (const key of this.filterFnProperties(properties)) {
      fn[key] = properties[key]
    }

    return fn;
  }

  private dispatch(o: any): any {
    switch (typeof o) {
      case 'object':
        // `null` has type 'object'
        if (o === null) {
          return;
        }

        const props = Object.getOwnPropertyNames(o);
        for (const key of props) {
          const value = o[key];
          switch (typeof value) {
            case 'object':
              if (value.type === index) {
                o[key] = this.fn_map.get(value.value);
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

  private reconstruct(o: any): any {
    o[functions].forEach((serial: any, ix: number) => {
      if (serial.type === user) {
        this.fn_map.set(ix, this.reconstructFn(serial));
      } else {
        throw new Error(`Deserializing native function (${serial.value}) not supported.`);
      }
    });
    const data = o.box;
    switch (typeof data) {
      case 'object':
        if (data.type === index) {
          o.box = this.fn_map.get(data.value);
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
  deserialize(buffer: Buffer): Object {
    // Deserialize into a raw object using the v8 API
    const o = v8.deserialize(buffer);

    // Traverse the raw object, reifying Function objects and class instances
    this.reconstruct(o);
    return o.box;
  }
};
