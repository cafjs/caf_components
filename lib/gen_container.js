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
 * Generic container component that encapsulates the life-cycle of
 * other components.
 *
 * A container uses a description list to create child components,
 *  defines a new context to register them, and propagates
 *  actions to them when needed.
 *
 * Child creation order is based on description order (JSON array),
 * and a created child component is immediately visible in the
 * context. Also, even though creation is an asynchronous operation, CAF
 * serializes for each CA (or for the framework
 * itself) the creation of components. This means that a child component
 * can rely on other (child) components during its creation
 * as long as the listed order respects all the dependencies.
 *
 * During shutdown we serialize actions and reverse creation order to
 * avoid dangling references to other components.
 *
 * We use a supervisor strategy similar to Erlang's one-for-all: If a
 * child is missing or shutdown,  we will shutdown all the remaining
 * children first, and then restart them all,  with actions always in the
 * correct order. In that way services dependent on the failed one will
 * also be able to recover.
 *
 * We want to avoid split-brain situations: two instances of the
 * same component assuming that they are the only one, and, for example,
 * interacting with the external world. For this reason, we cannot restart
 * a child until a previous shutdown has been successful. Shutdown is
 * always idempotent, and we retry multiple times. Eventually, we give up
 * and that would trigger a whole process shutdown, relying on an external
 * recovery mechanism to restart the process.
 *
 * This strategy is not adequate for managing CAs. They are mostly independent
 *  from each other and created dynamically. See
 * gen_dynamic_container.js for an alternative.
 *
 * Note that unknown services are shutdown without triggering recoveries.
 *
 * @name gen_container
 * @namespace
 * @augments gen_component
 */
var assert = require('assert');
var genComponent = require('./gen_component');
var async = require('async');
var myUtils = require('./myUtils');
var containerUtils = require('./containerUtils');
var naming = require('./naming');


/**
 * Constructor method for a generic container component.
 *
 * Optionally, we can pass an existing children context in $.$
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
     * @name gen_container#__ca_isContainer__
     */
    that.__ca_isContainer__ = true;


    $._ = $._ || that; // It is a top level component if missing $._

    /**
     * A context to register children. We can pass an existing children context
     * by using $.$
     *
     * @type {Object.<string, Object>}
     * @name gen_container#$
     */
    that.$ = $.$ || {};

    that.$._ =  $._;

    assert.equal(typeof($._), 'object',
                 "'$' context has no global context '$._'");
    assert.equal(typeof($._.$), 'object',
                 "'$._' object has no context '$._.$'");

    /**
     * A description of the expected children.
     *
     * @type {Array.<caf.specType>}
     * @name gen_container#childrenSpec
     */
    var childrenSpec = myUtils.clone(spec.components || []);

    var childrenNames = childrenSpec.map(function(x) { return x.name;});

    var toObject = function(spec) {
        var result = {};
        spec.forEach(function(x) {
                         if (result[x.name]) {
                             var msg ="Ignoring duplicate:" + x.name +
                                 " in spec";
                             var err = new Error(msg);
                             err.spec = spec;
                             $._.$.log &&
                                 $._.$.log.error(myUtils.errToStr(err));
                             throw err;
                         } else {
                             result[x.name] = x;
                         }
                     });
        return result;
    };


    var childrenSpecObj = toObject(childrenSpec);


    /**
     * Gets a description of the expected children.
     *
     * @return {Array.<caf.specType>} A description of the expected children.
     *
     *
     */
    that.__ca_getChildrenSpec__ = function() {
        return myUtils.clone(childrenSpec); //static container, no spec changes!
    };


    /**
     *  Filter current children based on whether they are expected.
     *
     * @param {boolean} known True if we want to select present and expected
     * children, false if present and unexpected.
     *
     * @return {Array.<string>} Names of the selected children.
     *
     */
    var selectChildren = function(known) {
        if (known) {
            return childrenSpec
                .filter(function(x) {
                            return (that.$[x.name] !== undefined);
                        })
                .map(function(x) { return x.name;});
        } else {
            return Object.keys(that.$)
                .filter(function(x) {
                        return ((x !== naming.TOP) && (x !== naming.LOADER) &&
                                (childrenSpecObj[x] === undefined));
                    });

        }
    };

    var unknown = function() { return selectChildren(false);};

    var known =  function() { return selectChildren(true);};

    var restartAll = function(data, cb) {
        async.series([
                         cntUtils.many('shutdownChild', known().reverse(),data),
                         cntUtils.many('createChild', childrenSpec, data)
                     ], cb);
    };

    /**
     * Reconciliates the current children state with the expected one.
     *
     *
     * @param {Object} data A hint on how to perform the checkup.
     * @param {caf.cb} cb A callback to propagate a checkup error/success.
     */
    var checkupChildren = function(data, cb) {
        var f = function(cb0) {
            async.series([
                             cntUtils.many('shutdownChild', unknown(), data),
                             function (cb1) {
                                 var cb2 = function(err, res) {
                                     if (err) {
                                         restartAll(data, cb1);
                                     } else {
                                         cb1(err, res);
                                     }
                                 };
                                 cntUtils.many('checkChild', childrenNames,
                                               data)(cb2);
                             }
                         ], cb0);
        };
        myUtils.retryWithDelay(f, spec.env.maxRetries, spec.env.retryDelay, cb);
    };



    var super__ca_checkup__ =  myUtils.superior(that, '__ca_checkup__');
    that.__ca_checkup__ = function(data, cb) {
        super__ca_checkup__(data, function(err, res) {
                                if (err) {
                                    cb(err);
                                } else {
                                    checkupChildren(data, cb);
                                }
                            });
    };

    var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
    that.__ca_shutdown__ = function(data, cb) {
        that.__ca_isShutdown__ = true; // block checkup() creating children
        cntUtils.many('shutdownChild', unknown().concat(known()).reverse(),
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
