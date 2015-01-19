/*!
Copyright 2014 Hewlett-Packard Development Company, L.P.

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
 * Common functions for static and dynamic containers.
 *
 *
 * @name containerUtils
 * @namespace
 */

var async = require('async');
var myUtils = require('./myUtils');
var assert = require('assert');

/**
 * Constructor of utils object.
 *
 */
exports.utils = function(that, maxRetries, retryDelay) {

    var result = {};

    var METHODS_INPUT_TYPE = {
        checkChild : 'string',
        checkAndRestartChild: 'object',
        shutdownChild: 'string',
        createChild: 'object'
    };


    /**
     *  Returns a function that checks a child.
     *
     *
     *  @param {Object=} data Optional structure to affect checks or return
     * info.
     *
     *  @return {function(string, caf.cb)} A function that will check
     * a child component. If child is missing or shutdown it will return an
     * error using the callback.
     */
    result.checkChild = function(data) {
        return function(childName, cb) {
            var child = that.$[childName];
            if (child) {
                child.__ca_checkup__(data, cb);
            } else {
                var err = new Error('checkChild: missing child');
                err.name = childName;
                cb(err);
            }
        };
    };

    /**
     *  Returns a function that checks a child and restarts it if needed.
     *
     *
     *  @param {Object=} data Optional structure to affect checks or return
     * info.
     *
     *  @param {boolean} doRetry True if it should retry a failed restart, by
     *  default (false) no retry.
     *
     *  @return {function(caf.specType, caf.cb)} A function that will check
     * and restart a child component.
     */
    result.checkAndRestartChild = function(data, doRetry) {
        return function(childSpec, cb) {
            var cb0 = function(err, res) {
                if (err) {
                    if (childSpec.env.__ca_temporary__) {
                        that.$._.$.log  &&
                            that.$._.$.log.trace("Ignoring temporary child" +
                                                 myUtils.errToPrettyStr(err));
                        cb(null, res);
                    } else {
                        that.$._.$.log  &&
                            that.$._.$.log.trace("creating  child" +
                                                 myUtils.errToPrettyStr(err));
                        result.createChild(data, doRetry)(childSpec, cb);
                    }
                } else {
                    cb(err, res);
                }
            };
            result.checkChild(data)(childSpec.name, cb0);
        };
    };

    /**
     *  Returns a function that shutdowns a child.
     *
     *  @param {Object=} data Optional structure to affect shutdown or return
     * info.
     *
     *  @param {boolean} doRetry True if it should retry shutdown, by default
     *  (false) no retry.
     *
     *  @return {function(string, caf.cb)} A function that shutdowns
     * a child component.
     */
    result.shutdownChild = function(data, doRetry) {
        var retries = (doRetry ? maxRetries : 1);
        return function (childName, cb) {
            var f = function(cb0) {
                var child = that.$[childName];
                if (child) {
                    that.$._.$.log  &&
                        that.$._.$.log.trace('Shuting down child ' + childName +
                                             ' in container ' +
                                             that.__ca_getSpec__().name);
                    child.__ca_shutdown__(data, cb0);
                } else {
                    // previous shutdown eventually finished
                    cb0(null);
                }
            };
            myUtils.retryWithDelay(f, retries, retryDelay, cb);
        };
    };

    /**
     *  Returns a function that creates a new child, shutting down first an
     *  existing one with the same name.
     *
     *  @param {Object=} data Optional structure to affect creation or return
     * info.
     *
     *  @param {boolean} doRetry True if it should retry creation, by default
     *  (false) no retry.
     *
     *  @return {function(caf.specType, caf.cb)} A function that will create
     * a child component from a description and returns it in the callback.
     */
    result.createChild = function(data, doRetry) {
        var retries = (doRetry ? maxRetries : 1);
        return function (childSpec, cb) {
            var f  = function(cb0) {
                async.series({
                                 one: function(cb1) {
                                     result.shutdownChild(data)(childSpec.name,
                                                                cb1);
                                 },
                                 comp: function(cb1) {
                                     that.$._.$.loader
                                         .__ca_loadComponent__(that.$,
                                                               childSpec, cb1);
                                 }
                             }, function(err, res) {
                                 if (err) {
                                     that.$._.$.log  &&
                                         that.$._.$.log
                                         .debug("Error creating child" +
                                                myUtils.errToPrettyStr(err));
                                     cb0(err, res);
                                 } else {
                                     var cb1 = function(err) {
                                           cb0(err, res.comp);
                                     };
                                     res.comp.__ca_checkup__(data, cb1);
                                 }
                             });
            };
            myUtils.retryWithDelay(f, retries, retryDelay, cb);
        };
    };

    /**
     * Returns a function that serially executes a containerUtils method on
     * a collection of children.
     *
     * @param {string} method A method name of this object (for example,
     * `createChild`).
     * @param {Array<caf.specType| string> | Object< string, caf.specType>} all
     *  An array of children or an object with a key with a child name and a
     * value with its  spec.
     *
     * @param {Object=}  data Optional structure to affect methods or return
     * info.
     *
     * @param {boolean} doRetry True if it should retry creation, by default
     *  (false) no retry.
     *
     * @return {function(caf.cb)} A function that will asyncronously execute
     * the method on the collection and invoke the callback with results/error.
     *
     */
    result.many = function(method, all, data, doRetry) {
        if (!METHODS_INPUT_TYPE[method]) {
            var err = new Error('many: invalid method name');
            err.name = method;
            err.all = all;
            throw err;
        }
        assert.equal(typeof(all), 'object', "'all' is not an object or array");
        if (!Array.isArray(all))  {
            if (METHODS_INPUT_TYPE[method] === 'string') {
                all = Object.keys(all);
            } else {
                all = Object.keys(all).map(function (x) { return all[x]; });
            }
        }

        return function(cb) {
            var f = result[method](data, doRetry);
            var fImmediate = function(x, cb0) {
                // avoid stack overflow, and give priority to I/O ops
                setImmediate(function() {
                                 f(x, cb0);
                             });
            };
            async.eachSeries(all, fImmediate, cb);
        };
    };

    /**
     * Enforce shutdown invariants for a function.
     *
     *  The invariant is that if the parent component, i.e., the container,  is
     *  shutdown, all the children should also be shutdown.
     *
     * @param {function(data, cb)} f A function that we want to guarantee it
     *  respects shutdown invariants.
     * @param {Object=}  data Optional structure to affect methods or return
     * info passed as an argument to 'f' or shutdown call.
     * @param {function(caf.cb)} cb A callback for 'f'  or shutdown call.
     *
     */
    result.ensureShutdown = function(f, data, cb) {
        if (that.__ca_isShutdown__) {
            that.__ca_shutdown__(data, cb);
        } else {
            var cb1 = function(err, res) {
                if (that.__ca_isShutdown__) {
                    that.__ca_shutdown__(data, cb);
                } else {
                    cb(err, res);
                }
            };
            f(data, cb1);
        }
    };

    return result;
};
