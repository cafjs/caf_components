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
 *  Generic dynamic container component that encapsulates the life-cycle of
 * other components.
 *
 * Container membership changes at run-time.
 *
 * We use a supervisor strategy similar to Erlang/OTP `one-for-one`:
 *  components are assumed to be independent, and if one of them dies we just
 *  restart that component. Order of component shutdown or start is arbitrary.
 *
 * The child's `spec.env` can contain a boolean attribute
 * `__ca_temporary__` that disables component restart. This is useful when we
 * rely on external  mechanisms to restart components, as is the case with CAs.
 *
 *  The following required properties specify recovery behavior for
*  non-temporary components:
 *
 *         { maxRetries: number, retryDelay: number}
 *
 *  where `maxRetries` is the number of attempts before giving up, and
 * `retryDelay` is the delay in msec between attempts.
 *
 *
 * @module caf_components/gen_dynamic_container
 * @augments module:caf_components/gen_component
 *
 */
// @ts-ignore: augments not attached to a class

const assert = require('assert');
const genComponent = require('./gen_component');
const async = require('async');
const myUtils = require('./myUtils');
const containerUtils = require('./containerUtils');
const naming = require('./naming');

/**
 * Helper constructor method for a dynamic container component.
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
     * @memberof! module:caf_components/gen_dynamic_container#
     * @alias __ca_isDynamicContainer__
     */
    that.__ca_isDynamicContainer__ = true;

    $._ = $._ || that; // It is a top level component if missing $._


    /**
     * A context to register children. We can pass an existing children context
     * in $.$
     *
     * @type {Object.<string, Object>}
     * @memberof! module:caf_components/gen_dynamic_container#
     * @alias $
     */
    that.$ = $.$ || {};

    that.$._ = $._;

    assert.equal(typeof($._), 'object',
                 "'$' context has no global context '$._'");
    assert.equal(typeof($._.$), 'object',
                 "'$._' object has no context '$._.$'");

    /*
     * Map with expected child components.
     *
     * @type {Object.<string, specType>}
     */
    const childrenSpecObj = {};

    /**
     *  Returns the spec for a created child.
     *
     * @param {string} name The name of the child component.
     *
     * @return {specType} The spec of a running child.
     *
     * @memberof! module:caf_components/gen_dynamic_container#
     * @alias __ca_getChildSpec__
     */
    that.__ca_getChildSpec__ = function(name) {
        return childrenSpecObj[name];
    };

    /*
     *  Adds a new child component.
     *
     * @param {Object=} data An optional hint on how to add the child.
     * @param {Object} childSpec A child description.
     * @param {cbType} cb A callback to return an error if I cannot create the
     *  child.
     *
     */
    const createChild = function(data, childSpec, cb) {
        childrenSpecObj[childSpec.name] = childSpec;
        const cb0 = function(err, resp) {
            if (err && childSpec.env.__ca_temporary__) {
                delete childrenSpecObj[childSpec.name];
            }
            cb(err, resp);
        };
        cntUtils.createChild(data, true)(childSpec, cb0);
    };

    /*
     * We avoid name conflicts during child creation by using queues. We hash
     * the child name, and pick one of the queues to allow for some concurrency.
     *
     */
    const NUMBER_OF_QUEUES = 47;

    const queues = [];
    for (let i =0; i < NUMBER_OF_QUEUES; i++) {
        queues[i] = async
            .queue(function(req, cb) {
                const data = req.data;
                const childSpec = req.childSpec;
                if (that.$[childSpec.name]) {
                    // @ts-ignore: return data in 'async' callback
                    cb(null, that.$[childSpec.name]);
                } else {
                    createChild(data, childSpec, cb);
                }
            }, 1); //sequential
    }

    /**
     * Adds a new child component if it was not already created.
     *
     * We avoid race conditions by using a queue to serialize child creation.
     *
     * There is no guarantee that the returned child used the provided
     * description, it could have already been created with a different
     * one. Use `__ca_deleteChild__` first to force a description.
     *
     * @param {Object=} data An optional hint on how to add the child.
     * @param {Object} childSpec A child description.
     * @param {cbType} cb A callback to return an error or the new (or existing)
     * child.
     *
     * @memberof! module:caf_components/gen_dynamic_container#
     * @alias __ca_instanceChild__
     */
    that.__ca_instanceChild__ = function(data, childSpec, cb) {
        const index = myUtils.hashCode(childSpec.name)%NUMBER_OF_QUEUES;
        queues[index].push({data: data, childSpec: childSpec}, cb);
    };

    /**
     * Deletes and shutdowns a child component.
     *
     * This is an idempotent operation.
     *
     * @param {Object=} data An optional hint on how to delete the child.
     * @param {string} childName A name for the child.
     * @param {cbType} cb A callback to return an error if a child still exists
     * and `delete` failed.
     *
     * @memberof! module:caf_components/gen_dynamic_container#
     * @alias __ca_deleteChild__
     */
    that.__ca_deleteChild__ = function(data, childName, cb) {
        if (childrenSpecObj[childName]) {
            delete childrenSpecObj[childName];
            cntUtils.shutdownChild(data, true)(childName, cb);
        } else {
            cb(null);
        }
    };


    const known = function() {
        return Object.keys(that.$)
            .filter(function(x) {
                return (childrenSpecObj[x] !== undefined);
            });
    };

    /**
     * Returns an array with the names of all the children that are currently
     * active.
     *
     * @return {Array.<string>} The names of all active children.
     *
     * @memberof! module:caf_components/gen_dynamic_container#
     * @alias __ca_allChildren__
     */
    that.__ca_allChildren__ = function() {
        return known();
    };

    const unknown = function() {
        return Object.keys(that.$)
            .filter(function(x) {
                return ((x !== naming.TOP) && (x !== naming.CA) &&
                        (x !== naming.LOADER) &&
                        (!that.$[x].__ca_isNotUnknown__) &&
                        (childrenSpecObj[x] === undefined));
            });
    };

    /*
     * Reconciliates the current children state with the expected one.
     *
     *
     * @param {Object} data A hint on how to perform the checkup.
     * @param {cbType} cb A callback to propagate a checkup error/success.
     */
    const checkupChildren = function(data, cb) {
        async.series([
            cntUtils.many('shutdownChild', unknown(), data),
            // childrenSpecObj type cannot be {}??
            // @ts-ignore
            cntUtils.many('checkAndRestartChild', childrenSpecObj, data, true)
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
                cntUtils.many('shutdownChild', unknown().concat(known()), data)(
                    function(err) {
                        if (err) {
                            const msgLog = 'Error in child shutdown: ' +
                                      spec.name + ' due to ' +
                                      myUtils.errToPrettyStr(err);
                            $._.$.log && $._.$.log.debug(msgLog);
                        }
                        cb(err);
                    }
                );
            }
        });
    };

    return that;
};
