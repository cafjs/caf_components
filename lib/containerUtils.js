// Modifications copyright 2020 Caf.js Labs and contributors
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
'use strict';

/**
 * Common functions for static and dynamic containers.
 *
 *
 * @module caf_components/containerUtils
 *
 */
const async = require('async');
const myUtils = require('./myUtils');
const assert = require('assert');
const timers = require('timers');

/**
 * Constructor of utils object.
 *
 * @param {Object} that Target container object.
 * @param {number} maxRetries Number of retries before giving up.
 * @param {number} retryDelay Delay in msec before retrying.
 */
exports.utils = function(that, maxRetries, retryDelay) {

    const result = {};

    const METHODS_INPUT_TYPE = {
        checkChild: 'string',
        checkAndRestartChild: 'object',
        shutdownChild: 'string',
        createChild: 'object'
    };

    /**
     *  Returns a function that checks a child status.
     *
     *  @param {Object=} data Optional meta-data for checks or to return
     * info.
     *
     *  @return {function(string, cbType)} A function of type
     * `function(string, cbType)` that will check
     * a child component status. If the child is missing or shutdown it will
     * return an error using the callback.
     *
     * @memberof! module:caf_components/containerUtils#
     * @alias checkChild
     */
    result.checkChild = function(data) {
        return function(childName, cb) {
            const child = that.$[childName];
            if (child) {
                const f = myUtils.wrapAsyncFunction(child.__ca_checkup__,
                                                    child);
                f(data, cb);
            } else {
                const err = new Error('checkChild: missing child');
                err.name = childName;
                cb(err);
            }
        };
    };

    /**
     *  Returns a function that checks a child status, and restarts it if
     *  needed.
     *
     *
     *  @param {Object=} data Optional meta-data for checks or to return
     * info. If  'data.doNotRestart' is true, it does not attempt recovery,
     * propagating an error in the callback.
     *
     *  @param {boolean=} doRetry True if it should retry a failed restart,
     *  otherwise no retry.
     *
     *  @return {function(specType, cbType)} A function of type
     * `function(specType, cbType)` that will check and restart a child
     *  component.
     *
     * @memberof! module:caf_components/containerUtils#
     * @alias checkAndRestartChild
     */
    result.checkAndRestartChild = function(data, doRetry) {
        return function(childSpec, cb) {
            const cb0 = function(err, res) {
                if (err) {
                    if (childSpec.env.__ca_temporary__) {
                        that.$._.$.log &&
                            that.$._.$.log.trace('Ignoring temporary child' +
                                                 myUtils.errToPrettyStr(err));
                        cb(null, res);
                    } else {
                        if (data && data.doNotRestart) {
                            const logMsg = 'doNotRestart=true passes error' +
                                    myUtils.errToPrettyStr(err);
                            that.$_.$.log && that.$._.$.log.trace(logMsg);
                            cb(err);
                        } else {
                            const logMsg = 'Creating  child ' +
                                myUtils.errToPrettyStr(err);
                            that.$._.$.log && that.$._.$.log.trace(logMsg);
                            result.createChild(data, doRetry)(childSpec, cb);
                        }
                    }
                } else {
                    cb(err, res);
                }
            };
            result.checkChild(data)(childSpec.name, cb0);
        };
    };

    /**
     *  Returns a function to shutdown a child.
     *
     *  @param {Object=} data Optional meta-data for shutdown or to return
     * info.
     *
     *  @param {boolean=} doRetry True if it should retry shutdown, otherwise
     *  no retry.
     *
     *  @return {function(string, cbType)} A function of type
     * `function(string, cbType)` to shutdown a child component.
     *
     * @memberof! module:caf_components/containerUtils#
     * @alias shutdownChild
     */
    result.shutdownChild = function(data, doRetry) {
        const retries = (doRetry ? maxRetries : 1);
        return function (childName, cb) {
            const f = function(cb0) {
                const child = that.$[childName];
                if (child) {
                    that.$._.$.log &&
                        that.$._.$.log.trace('Shuting down child ' + childName +
                                             ' in container ' +
                                             that.__ca_getSpec__().name);
                    const f = myUtils.wrapAsyncFunction(child.__ca_shutdown__,
                                                        child);
                    f(data, cb0);
                } else {
                    // previous shutdown eventually finished
                    cb0(null);
                }
            };
            myUtils.retryWithDelay(f, retries, retryDelay, cb);
        };
    };

    /**
     *  Returns a function that creates a new child. If necessary,
     * the function shuts down first an existing one with the same name.
     *
     *  @param {Object=} data Optional meta-date for creation or to return
     * info.
     *
     *  @param {boolean=} doRetry True if it should retry creation,
     * otherwise no retry.
     *
     *  @return {function(specType, cbType)} A function of type
     * `function(specType, cbType)` that will create
     * a child component from a description, and return it in the callback.
     *
     * @memberof! module:caf_components/containerUtils#
     * @alias createChild
     */
    result.createChild = function(data, doRetry) {
        const retries = (doRetry ? maxRetries : 1);
        return function (childSpec, cb) {
            const f = function(cb0) {
                async.series({
                    one: function(cb1) {
                        result.shutdownChild(data)(childSpec.name, cb1);
                    },
                    comp: function(cb1) {
                        that.$._.$.loader
                            .__ca_loadComponent__(that.$, childSpec, cb1);
                    }
                }, function(err, res) {
                    if (err) {
                        that.$._.$.log &&
                            that.$._.$.log.debug('Error creating child' +
                                                 myUtils.errToPrettyStr(err));
                        cb0(err, res);
                    } else {
                        const cb1 = function(err) {
                            cb0(err, res.comp);
                        };
                        const f = myUtils.wrapAsyncFunction(
                            res.comp.__ca_checkup__, res.comp
                        );
                        f(data, cb1);
                    }
                });
            };
            myUtils.retryWithDelay(f, retries, retryDelay, cb);
        };
    };

    /**
     * Returns a function that serially executes a `containerUtils` method on
     * a collection of children.
     *
     * @param {string} method A method name of this object (for example,
     * `createChild`).
     * @param {Array<specType|string> | Object<string, specType>} all
     *  An array of children or an object with a key with a child name and a
     * value describing its  spec.
     *
     * @param {Object=}  data Optional meta-data for methods, or to return
     * info.
     *
     * @param {boolean=} doRetry True if it should retry creation, otherwise
     * no retry.
     *
     * @return {function(cbType)} A function of type `function(cbType)` that
     *  will asyncronously execute the method on the collection, and finally
     * invokes the callback with the results or an error.
     *
     * @memberof! module:caf_components/containerUtils#
     * @alias many
     *
     */
    result.many = function(method, all, data, doRetry) {
        if (!METHODS_INPUT_TYPE[method]) {
            const err = new Error('many: invalid method name');
            err.name = method;
            err['all'] = all;
            throw err;
        }
        assert.equal(typeof(all), 'object', "'all' is not an object or array");
        if (!Array.isArray(all)) {
            if (METHODS_INPUT_TYPE[method] === 'string') {
                all = Object.keys(all);
            } else {
                all = Object.keys(all).map(function (x) { return all[x]; });
            }
        }

        return function(cb) {
            const f = result[method](data, doRetry);
            const fImmediate = function(x, cb0) {
                // avoid stack overflow, and give priority to I/O ops
                timers.setImmediate(function() {
                    f(x, cb0);
                });
            };
            async.eachSeries(all, fImmediate, cb);
        };
    };

    /**
     * Enforces a shutdown invariant for a function.
     *
     * In particular, if the container is shutdown, all its children should
     * also be shutdown.
     *
     * @param {function(any, cbType):void} f A function of type
     * `function(any, cbType)` that should respect a shutdown invariant.
     * @param {Object=}  data Optional meta-data.
     * @param {cbType} cb A callback for `f`  or the shutdown call.
     *
     * @memberof! module:caf_components/containerUtils#
     * @alias ensureShutdown
     */
    result.ensureShutdown = function(f, data, cb) {
        const shutF = myUtils.wrapAsyncFunction(that.__ca_shutdown__, that);
        if (that.__ca_isShutdown__) {
            shutF(data, cb);
        } else {
            const cb1 = function(err, res) {
                if (that.__ca_isShutdown__) {
                    shutF(data, cb);
                } else {
                    cb(err, res);
                }
            };
            f(data, cb1);
        }
    };

    return result;
};
