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
 *  Generic dynamic container component that encapsulates the life-cycle of
 * other components.
 *
 * We use a supervisor strategy similar to Erlang's one-for-one:
 *  if one of them dies we just restart
 *  that component, since we are assuming they are all independent. Therefore,
 *  order of shutdown or start is arbitrary.
 *
 * The child's spec.env can contain a boolean attribute `__ca_temporary__`
 *  that disables component restart. This is useful when we rely on external
 *  mechanisms to restart components, as is the case with CAs.
 *
 *
 * @name gen_dynamic_container
 * @namespace
 * @augments gen_component
 *
 */

var assert = require('assert');
var genComponent = require('./gen_component');
var async = require('async');
var myUtils = require('./myUtils');
var containerUtils = require('./containerUtils');
var naming = require('./naming');


/**
 * Constructor method for a generic dynamic container component.
 *
 * @see gen_component
 *
 */
exports.constructor = function($, spec) {

    var that = genComponent.constructor($, spec);

    assert.equal(typeof(spec.env.maxRetries), 'number',
                 "'spec.env.maxRetries' is not a number");
    assert.equal(typeof(spec.env.retryDelay), 'number',
                 "'spec.env.retryDelay' is not a number");

    var cntUtils = containerUtils.utils(that, spec.env.maxRetries,
                                        spec.env.retryDelay);

    /**
     * Run-time type information.
     *
     * @type {boolean}
     * @name gen_dynamic_container#__ca_isDynamicContainer__
     */
    that.__ca_isDynamicContainer__ = true;

    $._ = $._ || that; // It is a top level component if missing $._


    /**
     * A context to register children. We can pass an existing children context
     * by using $.$
     *
     * @type {Object.<string, Object>}
     * @name gen_dynamic_container#$
     */
    that.$ = $.$ || {};

    that.$._ =  $._;

    assert.equal(typeof($._), 'object',
                 "'$' context has no global context '$._'");
    assert.equal(typeof($._.$), 'object',
                 "'$._' object has no context '$._.$'");

    /*
     * Map with expected child components.
     *
     * @type {Object.<string, caf.spec>}
     */
    var childrenSpecObj = {};

    /**
     *  Returns the spec for a created child.
     *
     * @param {string} name The name of the child component.
     *
     * @return {caf.spec} The spec of a running child.
     */
    that.__ca_getChildSpec__ = function(name) {
        return childrenSpecObj[name];
    };

    /**
     *  Adds a new child component.
     *
     * @param {Object=} data An optional hint on how to add the child.
     * @param {Object} childSpec A child description.
     * @param {caf.cb} cb A callback to return an error if I cannot create the
     *  child.
     *
     */
    that.__ca_createChild__ = function(data, childSpec, cb) {
        var cb1 = function(err, data) {
            if (err) {
                cb(err);
            } else {
                childrenSpecObj[childSpec.name] = childSpec;
                cb(null, data);
            }
        };
        cntUtils.createChild(data, true)(childSpec, cb1);
    };
    /*
     * We avoid name conflicts during child creation by using queues. We hash
     * the child name, and pick one of the queues to allow for some concurrency.
     *
     */
    var NUMBER_OF_QUEUES = 47; 

    var queues = [];
    for (var i =0; i < NUMBER_OF_QUEUES; i++) {
        queues[i] = async
            .queue(function(req, cb) {
                       var data = req.data;
                       var childSpec = req.childSpec;
                       if (that.$[childSpec.name]) {
                           cb(null, that.$[childSpec.name]);
                       } else {
                           that.__ca_createChild__(data, childSpec, cb);
                       };
                   }, 1); //sequential
    }

    /**
     *  Adds a new child component if it was not there. Otherwise, it
     * just returns the old one in the callback. We use a queue to
     * serialize child creation, to avoid race conditions.
     *
     * There is no guarantee that the returned child used the provided
     * description.
     *
     * @param {Object=} data An optional hint on how to add the child.
     * @param {Object} childSpec A child description.
     * @param {caf.cb} cb A callback to return an error if I cannot create the
     *  child.
     *
     */
    that.__ca_instanceChild__ = function(data, childSpec, cb) {
        var index = myUtils.hashCode(childSpec.name)%NUMBER_OF_QUEUES;
        queues[index].push({data:data, childSpec: childSpec}, cb);
    };

    /**
     * Deletes and shutdowns a child component. This is an idempotent operation.
     *
     * @param {Object=} data An optional hint on how to add the child.
     * @param {string} childName A name for the child.
     * @param {caf.cb} cb A callback to return an error if child still exists
     * and I cannot delete it.
     */
    that.__ca_deleteChild__ = function(data, childName, cb) {
        if (childrenSpecObj[childName]) {
            delete childrenSpecObj[childName];
            cntUtils.shutdownChild(data, true)(childName, cb);
        } else {
            cb(null);
        }
    };


    var known = function() {
        return Object.keys(that.$)
            .filter(function(x) {
                        return (childrenSpecObj[x] !== undefined);
                    });
    };

    /**
     * Returns an array with the names of active children.
     *
     * @return {Array.<string>} The names of current children.
     *
     */
    that.__ca_allChildren__ = function() {
        return known();
    };

    var unknown = function() {
        return Object.keys(that.$)
            .filter(function(x) {
                        return ((x !== naming.TOP) && (x !== naming.CA) &&
                                (x !== naming.LOADER) &&
                                (!that.$[x].__ca_isNotUnknown__) &&
                                (childrenSpecObj[x] === undefined));
                    });
    };

    /**
     * Reconciliates the current children state with the expected one.
     *
     *
     * @param {Object} data A hint on how to perform the checkup.
     * @param {caf.cb} cb A callback to propagate a checkup error/success.
     */
    var checkupChildren = function(data, cb) {
        async.series([
                         cntUtils.many('shutdownChild', unknown(), data),
                         cntUtils.many('checkAndRestartChild',
                                       childrenSpecObj, data, true)
                     ], cb);
    };

    var super__ca_checkup__ =  myUtils.superior(that, '__ca_checkup__');
    that.__ca_checkup__ = function(data, cb) {
        super__ca_checkup__(data, function(err, res) {
                                if (err) {
                                    cb(err);
                                } else {
                                    cntUtils.ensureShutdown(checkupChildren,
                                                            data, cb);
                                }
                            });
    };

    var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
    that.__ca_shutdown__ = function(data, cb) {
        that.__ca_isShutdown__ = true; // block checkup() creating children
        cntUtils.many('shutdownChild', unknown().concat(known()),
                      data)(function(err) {
                                if (err) {
                                    cb(err);
                                } else {
                                    // unregister from context
                                    super__ca_shutdown__(data, cb);
                                }
                            });
    };

    return that;
};
