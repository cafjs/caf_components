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
"use strict";
/**
 * Miscellaneous collection of functions.
 *
 * @module myUtils
 *
 */

var async = require('async');
var assert = require('assert');
var crypto = require('crypto');

/**
 * Merges properties defined in a source map into a destination component.
 *
 * @param {Object} dest A target object to patch.
 * @param {Object} source A simple object with deltas.
 * @param {boolean} keepOld True if we can silently ignore changes to already
 * defined methods, false if we allow changing existing  ones.
 *
 * @return {Object} 'dest' after patching.
 * @name   myUtils#mixin
 * @function
 */
var mixin = exports.mixin = function(dest, source, keepOld) {
    assert.equal(typeof(dest),'object', "'dest' is not an object");
    assert.equal(typeof(source), 'object', "'source' is not an object");
    assert.ok(dest !== null, "'dest' is null");
    assert.ok(source !== null, "'source' is null");
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
 * @param {function(key): boolean=} filter An optional  filter to ignore certain
 *  keys  in an object.
 *
 * @return {Object| Array| number | null | string | boolean} A deeply cloned
 * structure.
 * @function
 */
var deepClone = exports.deepClone = function(obj, filter) {
    var result = obj; //assumed immutable
    if (Array.isArray(obj)) {
        result = obj.slice(0);
        result.forEach(function(x, i) {
                           result[i] = deepClone(x, filter);
                       });
    } else if ((typeof obj === 'object') && (obj !== null)) {
        result =  mixin({}, obj);
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
 *
 * @param {Object} dest A target object to patch.
 * @param {Object} source A simple object with deltas.
 * @param {boolean} keepOld True if we can silently ignore changes to already
 * defined methods, false if we allow changing existing  ones.
 *
 * @return {Object} A cloned and patched 'dest'.
 * @name   myUtils#cloneAndMixin
 * @function
 */
exports.cloneAndMixin = function(dest, source, keepOld) {
    return mixin(clone(dest), source, keepOld);
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
    assert.equal(typeof(f), 'function', "'f' is not a function");
    assert.equal(typeof(nTimes), 'number', "'nTimes' is not a number");
    assert.equal(typeof(delay), 'number', "'delay' is not a number");

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

/**
 * Stringifies an error object for logging or network transmission.
 *
 * @param {Error} err An error object to log or send.
 *
 * @return {string} A  JSON string representation of the error.
 */
var errToStr = exports.errToStr = function(err) {
    var obj = {};
    Object.getOwnPropertyNames(err)
        .forEach(function(key) { obj[key] = err[key]; });
    return JSON.stringify(obj, null, 2);
};


/**
 * Stringifies an error object so that the stack is properly formatted in the
 * console.
 *
 * @param {Error} err An error object to log or send.
 *
 * @return {string} A string representation of the error.
 */
var errToPrettyStr = exports.errToPrettyStr= function(err) {

    var result = errToStr(err);
    if (typeof result === 'string') {
        result = result.replace(/\\n/g,"\n");
    }
    return result;
};

var uniqueId = exports.uniqueId = function() {
    return new Buffer(crypto.randomBytes(15)).toString('base64');
};

/**
 * Filters keys in an object that are inherited or do not have a function value.
 *
 * @param {Object} obj An object to filter.
 * @return {Object} An object with only methods.
 *
 */
var onlyFun = exports.onlyFun = function(obj) {
    var result = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key) &&
            (typeof obj[key] === 'function')) {
            result[key] = obj[key];
        }
    }
    return result;
};

/**
 * Ensures that 'cb' is only called once. If not, and optional 'errF' callback
 *  is called.
 *
 * @param {caf.cb=} errF An optional cb for the second+ call.
 * @param {caf.cb} cb A callback that should only be called once.
 *
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
