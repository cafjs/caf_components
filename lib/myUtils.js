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
/**
 * Miscellaneous collection of functions.
 *
 * @module myUtils
 *
 */

var async = require('async');

/**
 * Flattens an array containing arrays
 *
 */
exports.flatten = function(array) {
    var result = [];
    return result.concat.apply(result, array);
};

/**
 * Flattens a deeply nested array containing arrays.
 * @function
 */
var deepFlatten = exports.deepFlatten = function(array) {
    if (Array.isArray(array)) {
        return array.reduce(function(previousValue, currentValue) {
            if (Array.isArray(currentValue)) {
                return previousValue.concat(deepFlatten(currentValue));
            } else {
                previousValue.push(currentValue);
                return previousValue;
            }
        }, []);
    } else {
        return array;
    }
};



/** Clones an array reversing its elements.*/
exports.cloneReverse = function(array) {
    return array.slice(0).reverse();
};

/**
 * Merges properties defined in a source map into a destination component.
 *
 * @param {Object} dest A target object to enhance.
 * @param {Object.<string, Object>} source A simple object with deltas.
 * @param {boolean} keepOld True if we can silently ignore changes to already
 * defined methods, false if we allow changing existing  ones.
 *
 * @name   myUtils#mixin
 * @function
 */
var mixin = exports.mixin = function(dest, source, keepOld) {
    var key;
    for (key in source) {
        if (source.hasOwnProperty(key) &&
            (!keepOld || (dest[key] === undefined))) {
            dest[key] = source[key];
        }
    }
    return dest;
};



/** Clones arrays or objects.
 * @function
 */
var clone = exports.clone = function(obj) {
    if (Array.isArray(obj)) {
        return obj.slice(0);
    } else if ((typeof obj === 'object') && (obj !==  null)) {
        return mixin({}, obj);
    } else {
        // assume immutable
        return obj;
    }
};

/**
 * Deep clones simple nested arrays and objects (e.g., JSON like collections)
 *
 * @param {Object| Array| number | null | string | boolean} obj Structure to
 * deep clone.
 *
 * @return {Object| Array| number | null | string | boolean} A deeply cloned
 * structure.
 * @function
 */
var deepClone = exports.deepClone = function(obj) {
    var result = obj; //assumed immutable
    if (Array.isArray(obj)) {
        result = obj.slice(0);
        result.forEach(function(x, i) {
                           result[i] = deepClone(x);
                       });
    } else if ((typeof obj === 'object') && (obj !== null)) {
        result =  mixin({}, obj);
        Object.keys(result).forEach(function(x) {
                                        result[x] = deepClone(result[x]);
                                    });
    }
    return result;
};


/**
 * Binds all the functions in an object so that 'this' is set to 'self'.
 * Ignores fields that are not functions.
 *
 *
 * @param {Object} self A value for 'this'.
 * @param {Object} obj A map with a collection of functions.
 *
 * @return {Object} A collection of bound functions in a map object.
 *
 */
exports.bind = function(self, obj) {
    if (obj && typeof obj === 'object') {
        var result = {};
        Object.keys(obj).forEach(function(x) {
                                     if (typeof obj[x] === 'function') {
                                         result[x] = obj[x].bind(self);
                                     }
                                 });
        return result;
    }
    return null;
};


/**
 * Captures in a closure a method of the parent class before we override it.
 *
 * For example:
 *
 *     var supHello = myUtils.superior(that, 'hello');
 *     that.hello = function() {
 *        supHello(); // call original 'hello'
 *        // do something else
 *     }
 *
 * @param {Object} target An object to capture a method from.
 * @param {string} methodName The name of the method that we want
 *to override.
 * @return {function} The function implementing that method in the
 * parent class.
 *
 * @name   myUtils#superior
 * @function
 */
exports.superior = function(target, methodName) {
    var method = target[methodName];
    return function() {
        return method.apply(target, arguments);
    };
};


/** Clones an object before mix-in some properties for a source object.
 * @function
 */
exports.cloneAndMix = function(dest, source, keepOld) {
    return mixin(clone(dest), source, keepOld);
};


// the cookie method in 'res' formats the value using uri encoding
//  and unfortunately cloud foundry expects base64 encoding for
// the encripted cookies. This breaks because the character '/'
// valid for base 64 gets mapped to '%2F'...

/**
 * Sets a cookie in the response stream that never expires.
 *
 * We cannot use the built-in cookie method in 'res' because Cloud Foundry
 * uses base64  encoding (instead of URI encoding) for encrypted cookies.
 * @function
 */
var setForeverCookie = exports.setForeverCookie = function(res, name, value) {
    var pairs = [name + '=' + value];
    pairs.push('path=/');
    var expires = (new Date(Date.now() + FOREVER)).toUTCString();
    pairs.push('expires=' + expires);
    var cookie = pairs.join('; ');
    res.header('Set-Cookie', cookie);
};

/**
 * Retries an asynchronous function several times until it succeeds. It delays a
 *  retry by a fixed amount of time.
 *
 * @param {function(function(Object=, Object=))} f An asynchronous function to
 * be evaluated. It returns error/result using a callback with node.js
 * conventions.
 * @param {integer} nTimes  Max number of attempts.
 * @param {integer} delay Time between retries in miliseconds.
 * @param {caf.cb} cb Standard callback function for error/result propagation.
 *
 */
exports.retryWithDelay = function(f, nTimes, delay, cb) {
    async.retry(nTimes,
                function(cb0) {
                    var cb1 = function (err, res) {
                        if (err) {
                            setTimeout(function() { cb0(err, res); }, delay);
                        } else {
                            cb0(err, res);
                        };
                    };
                    f(cb1);
                }, cb);
};

/**
 * Stringifies an error object for logging or network transmission.
 *
 * @param {Error} err An error object to log or send.
 *
 * @return {string} A  JSON string representation of the error.
 */
exports.errToStr = function(err) {
    var obj = {};
    Object.getOwnPropertyNames(err)
        .forEach(function(key) { obj[key] = err[key]; });
    return JSON.stringify(obj, null, 2);
};
