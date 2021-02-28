// Modifications copyright 2020 Caf.js Labs and contributors
/*!
 Copyright 2013 Hewlett-Packard Development Company, L.P.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
'use strict';

/**
 * Miscellaneous collection of functions.
 *
 * @module caf_components/myUtils
 *
 */
const async = require('async');
const assert = /** @type {typeof import('assert')} */(require('assert'));
const crypto = require('crypto');
const util = require('util');

const mixin =
/**
 * Merges properties defined in a source map into a destination object.
 *
 * @param {Object} dest A target object to patch.
 * @param {Object} source A simple object with deltas.
 * @param {boolean} keepOld True if we can silently ignore changes to already
 * defined methods, false if we allow changing existing  ones.
 *
 * @return {Object} `dest` after patching.
 *
 * @memberof! module:caf_components/myUtils
 * @alias mixin
 */
exports.mixin = function(dest, source, keepOld) {
    assert.equal(typeof(dest), 'object', "'dest' is not an object");
    assert.equal(typeof(source), 'object', "'source' is not an object");
    assert.ok(dest !== null, "'dest' is null");
    assert.ok(source !== null, "'source' is null");
    Object.keys(source).forEach(function(key) {
        if (!keepOld || (dest[key] === undefined)) {
            dest[key] = source[key];
        }
    });
    return dest;
};

const clone =
/**
 * Clones arrays or objects.
 *
 * @param {Object} obj An object to be cloned.
 *
 * @return {Object} A clone of `obj`.
 */
exports.clone = function(obj) {
    if (Array.isArray(obj)) {
        return obj.slice(0);
    } else if ((typeof obj === 'object') && (obj !== null)) {
        return mixin({}, obj);
    } else {
        // assume immutable
        return obj;
    }
};

const deepClone =
/**
 * Deep clones nested arrays and objects (e.g., JSON like collections)
 *
 * @param {Object| Array| number | null | string | boolean} obj Structure to
 * deep clone.
 * @param {function(key): boolean=} filter An optional  filter of type
 * `function(string): boolean` to ignore certain keys  in an object.
 *
 * @return {Object| Array| number | null | string | boolean} A deeply cloned
 * structure.
 *
 * @memberof! module:caf_components/myUtils
 * @alias deepClone
 */
exports.deepClone = function(obj, filter) {
    var result = obj; //assumed immutable
    if (Array.isArray(obj)) {
        result = obj.slice(0);
        result.forEach(function(x, i) {
            result[i] = deepClone(x, filter);
        });
    } else if ((typeof obj === 'object') && (obj !== null)) {
        result = mixin({}, obj);
        Object.keys(result).forEach(function(x) {
            if (filter && filter(x)) {
                delete result[x];
            } else {
                result[x] = deepClone(result[x],
                                      filter);
            }
        });
    }
    return result;
};

const superior =
/**
 * Captures in a closure a method of the parent class before we override it.
 *
 * For example:
 *
 *     const supHello = myUtils.superior(that, 'hello');
 *     that.hello = function() {
 *        supHello(); // calls original 'hello'
 *        // do something else
 *     }
 *
 * @param {Object} target An object to capture a method from.
 * @param {string} methodName The name of the method that we want
 * to override.
 * @return {function} The function implementing that method in the
 * parent class.
 *
 * @memberof! module:caf_components/myUtils
 * @alias superior
 *
 */
exports.superior = function(target, methodName) {
    const method = target[methodName];
    const wrappedMethod = wrapAsyncFunction(method, target);
    return function() {
        return wrappedMethod.apply(target, arguments);
    };
};

/**
 * Captures in a closure a method of the parent class before we override it.
 * It also transforms a callback based function into one that returns a promise.
 *
 * For example:
 *
 *     const supHello = myUtils.superiorPromisify(that, 'hello');
 *     that.hello = async function() {
 *        try {
 *           const data = await supHello(); // calls original 'hello'
 *        // do something else
 *        } catch (err) {
 *           ...
 *     }
 *
 * @param {Object} target An object to capture a method from.
 * @param {string} methodName The name of the method that we want
 * to override.
 * @return {function} The function implementing that method in the
 * parent class, modified to return a promise.
 *
 * @memberof! module:caf_components/myUtils
 * @alias superiorPromisify
 *
 */
exports.superiorPromisify = function(target, methodName) {
    return util.promisify(superior(target, methodName));
};

/** Clones an object before mixin some properties from a source object.
 *
 * @param {Object} dest A target object to patch.
 * @param {Object} source A simple object with deltas.
 * @param {boolean} keepOld True if we can silently ignore changes to already
 * defined methods, false if we allow changing existing  ones.
 *
 * @return {Object} A cloned and patched `dest`.
 *
 * @memberof! module:caf_components/myUtils
 * @alias cloneAndMixin
 *
 */
exports.cloneAndMixin = function(dest, source, keepOld) {
    return mixin(clone(dest), source, keepOld);
};

/**
 * Retries an asynchronous function several times until it succeeds. It delays a
 *  retry by a fixed amount of time.
 *
 * @param {function(cbType):void} f An asynchronous function of type
 * `function(cbType)` to be evaluated. It returns error/result using a callback
 *  with node.js conventions.
 * @param {number} nTimes  Max number of attempts.
 * @param {number} delay Time between retries in miliseconds.
 * @param {cbType} cb Standard callback function for error/result propagation.
 *
 * @memberof! module:caf_components/myUtils
 * @alias retryWithDelay
 */
exports.retryWithDelay = function(f, nTimes, delay, cb) {
    assert.equal(typeof(f), 'function', "'f' is not a function");
    assert.equal(typeof(nTimes), 'number', "'nTimes' is not a number");
    assert.equal(typeof(delay), 'number', "'delay' is not a number");
    f = wrapAsyncFunction(f);
    async.retry(nTimes,
                function(cb0) {
                    const cb1 = function (err, res) {
                        if (err && (nTimes > 1)) {
                            setTimeout(function() { cb0(err, res); },
                                       delay);
                        } else {
                            cb0(err, res);
                        }
                    };
                    f(cb1);
                }, function(err, res) {
                    cb(err, res);
                });
};

const errToStr =
/**
 * Stringifies an error object for logging or network transmission.
 *
 * @param {Error} err An error object to log or send.
 *
 * @return {string} A string representation of the error.
 * @memberof! module:caf_components/myUtils
 * @alias errToStr
 */
exports.errToStr = function(err) {
    if (err && (typeof err === 'object')) {
        const obj = {};
        Object.getOwnPropertyNames(err)
            .forEach(function(key) { obj[key] = err[key]; });
        return JSON.stringify(obj, null, 2);
    } else {
        return err;
    }
};


/**
 * Stringifies an error object so that its stack is properly formatted in the
 * console.
 *
 * @param {Error} err An error object to log or send.
 *
 * @return {string} A string representation of the error.
 *
 * @memberof! module:caf_components/myUtils
 * @alias errToPrettyStr
 */
exports.errToPrettyStr= function(err) {
    try {
        let result = errToStr(err);
        if (typeof result === 'string') {
            result = result.replace(/\\n/g, '\n');
        }
        return result;
    } catch (ex) {
        // 'err' not JSON serializable
        return '' + err;
    }
};

/**
 * Returns a unique identifier.
 *
 * @return {string} A unique identifier.
 *
 * @memberof! module:caf_components/myUtils
 * @alias uniqueId
 */
exports.uniqueId = function() {
    return Buffer.from(crypto.randomBytes(15)).toString('base64');
};

/**
 * Returns a random string with capital letters and digits.
 *
 * @return {len} The number of characters in the string.
 *
 * @memberof! module:caf_components/myUtils
 * @alias randomString
 */
exports.randomString = function(len) {
    const result = [];
    while (result.length < len) {
        const ch = crypto.randomBytes(1).readUInt8(0);
        if (((ch >= 48) && (ch < 58)) || ((ch >= 65) && (ch < 91))) {
            result.push(String.fromCharCode(ch));
        }
    }
    return result.join('');
};

/**
 * Computes a  hash code for a string.
 *
 * @param {string} st An input string.
 *
 * @return {number} An unsigned 32 bit integer representing a hash code for the
 *  string.
 *
 * @memberof! module:caf_components/myUtils
 * @alias hashCode
 */
exports.hashCode = function(st) {
    var result = 5381;
    for (let i =0; i< st.length; i++) {
        const ch = st.charCodeAt(i);
        result = (result *33 + ch) & 0xffffffff;
    }
    return result>>>0;
};

/**
 * Filters keys in an object that are inherited or do not have a function value.
 *
 * @param {Object} obj An object to filter.
 * @return {Object} An object with only methods.
 *
 * @memberof! module:caf_components/myUtils
 * @alias onlyFun
 */
exports.onlyFun = function(obj) {
    const result = {};
    Object.keys(obj).forEach(function(key) {
        if (typeof obj[key] === 'function') {
            result[key] = obj[key];
        }
    });
    return result;
};

const callJustOnce =
/**
 * Ensures that `cb` is only called once. If not, and optional `errF` callback
 *  is called.
 *
 * @param {cbType=} errF An optional callback for any extra calls to `cb`.
 * @param {cbType} cb A callback that should only be called once.
 *
 * @memberof! module:caf_components/myUtils
 * @alias callJustOnce
 */
exports.callJustOnce = function(errF, cb) {
    var alreadyCalled = false;
    return function(err, data) {
        if (alreadyCalled) {
            errF && errF(err, data);
        } else {
            alreadyCalled = true;
            cb(err, data);
        }
    };
};

/**
 * Whether two objects are structurally similar.
 *
 * @param {Object} x An object to compare.
 * @param {Object} y An object to compare.
 *
 * @return {boolean} True if `x` and `y` are  structurally similar.
 *
 * @memberof! module:caf_components/myUtils
 * @alias deepEqual
 */
exports.deepEqual = function(x, y) {
    try {
        assert.deepEqual(x, y);
        return true;
    } catch (ex) {
        return false;
    }
};

const IDENT_F = function(x) { return x;};

/**
 * Promisify a function only when it is called without a callback argument,
 * otherwise use the callback.
 *
 * @param {function} f A function that expects a callback in its last argument.
 * @return {function} A wrapped function that when invoked without a callback it
 * returns a Promise with an Array tuple `[error, data]`, and when using a
 * callback, it is a pass-through call.
 *
 * @memberof! module:caf_components/myUtils
 * @alias condPromisify
 */
exports.condPromisify = function(f) {
    return function(...args) {
        if ((args.length > 0) && (typeof args[args.length -1] === 'function')) {
            return f.apply(f, args);
        } else {
            return new Promise((resolve, reject) => {
                args.push((err, data) => {
                    if (err) {
                        resolve([err]);
                    } else {
                        resolve([null, data]);
                    }
                });
                try {
                    f.apply(f, args);
                } catch (err) {
                    reject(err);
                }
            });
        }
    };
};

const promiseToCallback =
/**
 * Maps a promise to a callback.
 *
 * Assumes that the promise resolves to a `[error, value]` array, compatible
 * with an standard node.js callback.
 *
 * It does nothing if the promise is missing.
 *
 * If it has a non-null value but is not a promise object, or resolves to a
 * non-array object, or an array with length greater than 2,
 * it will propagate an error in the callback.
 *
 * An optional `wrapException` function can modify that error, e.g.,  to
 * distinguish them from standard application errors propagated in the array.
 *
 *
 * @param {Promise} promise A promise to be mapped into a callback
 * @param {cbType} cb A callback to propagate the resolved promise values.
 * @param {function(Error): Error=} wrapException An optional function to wrap
 * non-propagated errors.
 * @param {function(Error): Error=} wrapAppError An optional function to wrap
 * application errors propagated in the first element of the returned array.
 *
 * @memberof! module:caf_components/myUtils
 * @alias promiseToCallback
 */
exports.promiseToCallback = function(promise, cb, wrapException, wrapAppError) {
    if (promise) {
        wrapException = wrapException || IDENT_F;
        wrapAppError = wrapAppError || IDENT_F;
        if (Promise.resolve(promise) !== promise) {
            const err = new Error('Returning an object that is not a promise.' +
                                ' Is your function async?');
            err['obj'] = promise;
            cb(wrapException(err));
        } else {
            promise.then(function(value) {
                if (Array.isArray(value)) {
                    if (value.length <= 2) {
                        cb(wrapAppError(value[0]), value[1]);
                    } else {
                        const err = new Error('Promise array length > 2');
                        err['obj'] = value;
                        cb(wrapException(err));
                    }
                } else {
                    const err = new Error('Promise value not an array');
                    err['obj'] = value;
                    cb(wrapException(err));
                }
            }).catch(function(e) {
                cb(wrapException(e));
            });
        }
    }
};

const wrapAsyncFunction =
/**
 * Wraps an asynchronous function.
 *
 *  The goal is to make it behave the same whether it uses a callback or
 * returns a promise, e.g, uses the async/await pattern.
 *
 *  Assumes that the promise resolves to a `[error, value]` array, compatible
 * with an standard node.js callback.
 *
 *  If the function throws, and the exception was captured in the promise, we
 * just mark the exception as thrown, i.e., `wasThrown=true`, so that later we
 * can handle it like a callback-based function exception.
 *
 * It does nothing if the function is missing. It throws if called without a
 * callback or something that is not a function.
 *
 * @param {function=} f An asynchronous function to be wrapped.
 * @param {Object=} target An optional target object when the function is one
 * of its methods. It defaults to `f`.
 * @return {function=} A wrapped function that behaves the same whether `f` is
 * callback or promise based.
 * @throws {Error} if `f` is provided but is not a function, or we call the
 * wrapped function without a callback.
 *
 * @memberof! module:caf_components/myUtils
 * @alias wrapAsyncFunction
 */
exports.wrapAsyncFunction = function(f, target) {
    if (!f) {
        return f;
    } else if (typeof f !== 'function') {
        throw new Error('Object to wrap is not a function');
    } else {
        return function(...args) {
            if ((args.length === 0) ||
                (typeof args[args.length -1] !== 'function')) {
                throw new Error('No callback');
            } else {
                const cb = args[args.length -1];
                const promise = f.apply(target || f, args);
                promiseToCallback(promise, cb, err => {
                    if (err) {
                        err['wasThrown'] = true;
                    }
                    return err;
                });
            }
        };
    }
};

/**
 * Wraps an asynchronous function to limit its duration.
 *
 *
 * @param {function(cbType):void} f An asynchronous function to be wrapped.
 * @param {number=} timeout A maximum duration for the call (in msec).
 * @return {function(cbType)} A wrapped function that will return an error in
 * the callback if timeout expires. The error has a field `timeout` set to
 * `true`.
 *
 * @memberof! module:caf_components/myUtils
 * @alias wrapWithTimeout
 */
exports.wrapWithTimeout = function(f, timeout) {
    if (!timeout) {
        return f;
    } else {
        return function(cb) {
            const cbOnce = callJustOnce(null, cb);
            const t = setTimeout(function () {
                const err = new Error('Timeout!');
                err['timeout'] = true;
                cbOnce(err);
            }, timeout);
            try {
                f(function(err, data) {
                    clearTimeout(t);
                    cbOnce(err, data);
                });
            } catch (ex) {
                clearTimeout(t);
                throw ex;
            }
        };
    }
};

/**
 * Extracts the data field from a tuple `[error, data]`.
 *
 * Throws `error` if not null
 *
 * @param {Array} tuple An `[error, data]` pair.
 * @return {any} The `data` field.
 * @throws {Error} if the `error` field is not a falsy.
 *
 * @memberof! module:caf_components/myUtils
 * @alias extractData
 */
exports.extractData = function(tuple) {
    if (tuple[0]) {
        throw tuple[0];
    } else {
        return tuple[1];
    }
};

/**
 * Deletes all the enumerable properties of an object
 *
 * @param {Object} obj An object to cleanup.
 *
 * @memberof! module:caf_components/myUtils
 * @alias deleteProps
 */
exports.deleteProps = function(obj) {
    if (obj && (typeof obj === 'object')) {
        Object.keys(obj).forEach((key) => delete obj[key]);
    }
};
