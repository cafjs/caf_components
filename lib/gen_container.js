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
 * Generic container component that encapsulates the life-cycle of
 * other components.
 *
 * A container is static, using a description list to create child components,
 *  allocating a new context to register them, and propagating
 *  actions as needed. Unknown children are shutdown without triggering
 * a recovery strategy.
 *
 * We use a supervisor strategy similar to Erlang/OTP `one-for-all`: If a
 * child is missing or shutdown,  we will shutdown all the remaining
 * children first, and then restart them all. Recovery actions order is based
 * on description order, to ensure that dependent services will also recover.
 *
 *  The following required properties specify recovery behavior:
 *
 *         { maxRetries: number, retryDelay: number}
 *
 *  where `maxRetries` is the number of attempts before giving up, and
 * `retryDelay` is the delay in msec between attempts.
 *
 * We want to avoid split brain situations: two instances of the
 * same component assuming that they are unique, and, for example,
 * interacting with the external world.
 *
 * For this reason, we cannot restart
 * a child until a previous shutdown has been successful. Shutdown is
 * always idempotent, and we retry multiple times. Eventually we give up
 * and trigger a process shutdown, relying on an external
 * recovery mechanism to restart the process.
 *
 * Static containers are not adequate for managing CAs. CAs are mostly
 * independent from each other, and created dynamically. See
 * `gen_dynamic_container` for an alternative.
 *
 *
 * @module caf_components/gen_container
 * @augments module:caf_components/gen_component
 */
// @ts-ignore: augments not attached to a class
const assert = require('assert');
const genComponent = require('./gen_component');
const async = require('async');
const myUtils = require('./myUtils');
const containerUtils = require('./containerUtils');
const naming = require('./naming');

/**
 * Helper constructor method for a container component.
 *
 * Description of types in file `types.js`.
 *
 * @param {ctxType} $ A context containing references to other components.
 * @param {specType} spec Configuration data for this component.
 * @return {Object} A new generic component.
 *
 * @throws {Error} If inputs are invalid.
 */
exports.constructor = function($, spec) {

    const that = genComponent.constructor($, spec);

    assert.equal(typeof(spec.env.maxRetries), 'number',
                 "'spec.env.maxRetries' is not a number");
    assert.equal(typeof(spec.env.retryDelay), 'number',
                 "'spec.env.retryDelay' is not a number");

    const cntUtils = containerUtils.utils(that, spec.env.maxRetries,
                                          spec.env.retryDelay);

    /**
     * Run-time type information.
     *
     * @type {boolean}
     *
     * @memberof! module:caf_components/gen_container#
     * @alias __ca_isContainer__
     */
    that.__ca_isContainer__ = true;

    $._ = $._ || that; // It is a top level component if missing $._

    /**
     * A context to register children.
     *
     * Provide an existing children context in `$.$`, otherwise a new one is
     * created.
     *
     * @type {ctxType}
     * @memberof! module:caf_components/gen_container#
     * @alias $
     */
    that.$ = $.$ || {};

    that.$._ = $._;

    assert.equal(typeof($._), 'object',
                 "'$' context has no global context '$._'");
    assert.equal(typeof($._.$), 'object',
                 "'$._' object has no context '$._.$'");

    /*
     * A description of the expected children.
     *
     * @type {Array.<specType>}
     *
     */
    const childrenSpec = myUtils.clone(spec.components || []);

    const childrenNames = childrenSpec.map(function(x) { return x.name;});

    const toObject = function(spec) {
        const result = {};
        spec.forEach(function(x) {
            if (result[x.name]) {
                const msg ='Ignoring duplicate:' + x.name + ' in spec';
                const err = new Error(msg);
                err['spec'] = spec;
                $._.$.log && $._.$.log.error(myUtils.errToPrettyStr(err));
                throw err;
            } else {
                result[x.name] = x;
            }
        });
        return result;
    };


    const childrenSpecObj = toObject(childrenSpec);


    /**
     * Gets a description of the expected children.
     *
     * @return {Array.<specType>} A description of the expected children.
     *
     * @memberof! module:caf_components/gen_container#
     * @alias __ca_getChildrenSpec__
     *
     */
    that.__ca_getChildrenSpec__ = function() {
        return myUtils.clone(childrenSpec); //static container, no spec changes!
    };


    /*
     *  Filter current children based on whether they are expected.
     *
     * @param {boolean} known True if we want to select present and expected
     * children, false if present and unexpected.
     *
     * @return {Array.<string>} Names of the selected children.
     *
     */
    const selectChildren = function(known) {
        if (known) {
            return childrenSpec
                .filter(function(x) {
                    return (that.$[x.name] !== undefined);
                })
                .map(function(x) { return x.name;});
        } else {
            return Object.keys(that.$)
                .filter(function(x) {
                    return ((x !== naming.TOP) && (x !== naming.CA) &&
                            (x !== naming.LOADER) &&
                            (!that.$[x].__ca_isNotUnknown__) &&
                            (childrenSpecObj[x] === undefined));
                });
        }
    };

    const unknown = function() { return selectChildren(false);};

    const known = function() { return selectChildren(true);};

    const restartAll = function(data, cb) {
        async.series([
            cntUtils.many('shutdownChild', known().reverse(), data),
            cntUtils.many('createChild', childrenSpec, data, true)
        ], cb);
    };

    /*
     * Reconciliates the current children state with the expected one.
     *
     *
     * @param {Object} data A hint on how to perform the checkup. If
     * `data.doNotRestart` is true, we do not attempt recovery, propagating
     * an error in the callback instead.
     * @param {cbType} cb A callback to propagate a checkup error/success.
     */
    const checkupChildren = function(data, cb) {
        async.series([
            cntUtils.many('shutdownChild', unknown(), data),
            function (cb1) {
                const cb2 = function(err, res) {
                    if (err) {
                        if (data && data.doNotRestart) {
                            const logMsg = 'Cannot restart children in ' +
                                      spec.name + ' got error ' +
                                      myUtils.errToPrettyStr(err);
                            $._.$.log && $._.$.log.trace(logMsg);
                            cb1(err);
                        } else {
                            const logMsg = 'Restarting children in ' +
                                      spec.name + ' due to error ' +
                                      myUtils.errToPrettyStr(err);
                            $._.$.log && $._.$.log.trace(logMsg);
                            restartAll(data, cb1);
                        }
                    } else {
                        cb1(err, res);
                    }
                };
                cntUtils.many('checkChild', childrenNames, data)(cb2);
            }
        ], cb);
    };


    const super__ca_checkup__ = myUtils.superior(that, '__ca_checkup__');
    that.__ca_checkup__ = function(data, cb) {
        super__ca_checkup__(data, function(err) {
            if (err) {
                cb(err);
            } else {
                cntUtils.ensureShutdown(checkupChildren, data, function(err) {
                    if (err) {
                        // Cannot recover children, shutdown and propagate error
                        that.__ca_shutdown__(data, function(err1) {
                            if (err1) {
                                cb(err1);
                            } else {
                                cb(err);
                            }
                        });
                    } else {
                        cb(null);
                    }
                });
            }
        });
    };

    const super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
    that.__ca_shutdown__ = function(data, cb) {
        super__ca_shutdown__(data, function(err) {
            if (err) {
                cb(err);
            } else {
                const all = unknown().concat(known()).reverse();
                cntUtils.many('shutdownChild', all, data)(function(err) {
                    if (err) {
                        const msgLog = 'Child shutdown error in ' + spec.name +
                                  ' due to ' + myUtils.errToPrettyStr(err);
                        $._.$.log && $._.$.log.debug(msgLog);
                    }
                    cb(err);
                });
            }
        });
    };

    return that;
};
