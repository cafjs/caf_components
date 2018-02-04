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
var async = require('async');
var assert = require('assert');
var crypto = require('crypto');

/**
 * @typedef {function(Error?, any?)} cbType
 *
 */

var mixin =
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

var clone =
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

var deepClone =
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

/**
 * Captures in a closure a method of the parent class before we override it.
 *
 * For example:
 *
 *     var supHello = myUtils.superior(that, 'hello');
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
    var method = target[methodName];
    return function() {
        return method.apply(target, arguments);
    };
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
 * @param {function(cbType)} f An asynchronous function of type
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
                    var cb1 = function (err, res) {
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

var errToStr =
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
        var obj = {};
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
        var result = errToStr(err);
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
    return new Buffer(crypto.randomBytes(15)).toString('base64');
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
    for (var i =0; i< st.length; i++) {
        var ch = st.charCodeAt(i);
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
    var result = {};
    Object.keys(obj).forEach(function(key) {
        if (typeof obj[key] === 'function') {
            result[key] = obj[key];
        }
    });
    return result;
};

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

var IDENT_F = function(x) { return x;};

var promiseToCallback =
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
            var err = new Error('Returning an object that is not a promise.' +
                                ' Is your function async?');
            err['obj'] = promise;
            cb(wrapException(err));
        } else {
            promise.then(function(value) {
                if (Array.isArray(value)) {
                    if (value.length <= 2) {
                        cb(wrapAppError(value[0]), value[1]);
                    } else {
                        err = new Error('Promise array length > 2');
                        err['obj'] = value;
                        cb(wrapException(err));
                    }
                } else {
                    err = new Error('Promise value not an array');
                    err['obj'] = value;
                    cb(wrapException(err));
                }
            }).catch(function(e) {
                cb(wrapException(e));
            });
        }
    }
};

var wrapAsyncFunction =
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
 * just rethrow the exception, so that it behaves like a callback based async
 * function.
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
        return function() {
            var args = Array.prototype.slice.call(arguments);
            if ((args.length === 0) ||
                (typeof args[args.length -1] !== 'function')) {
                throw new Error('No callback');
            } else {
                var cb = args[args.length -1];
                var promise = f.apply(target || f, args);
                promiseToCallback(promise, cb, function(err) {
                    if (err) {
                        throw err;
                    }
                });
            }
        };
    }
};
