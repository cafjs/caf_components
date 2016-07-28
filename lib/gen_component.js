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
 * Generic base component.
 *
 * CAF component construction is asynchronous, using an
 * standard factory method named `newInstance()`.
 *
 * To simplify writing asynchronous constructors we
 * wrap the synchronous bits of a constructor in an internal
 * factory method (i.e., `constructor()`). Then, we use the following pattern:
 *
 *     var genXX = require('./gen_XX');
 *     ...
 *     exports.newInstance = function($, spec,  cb) {
 *         try {
 *             var that = genXX.constructor($, spec);
 *          // do asynchronous initialization of 'that' and then call
 *          //   cb(err, that) using the node.js callback convention
 *         } catch(err) {
 *             cb(err)
 *         }
 *     }
 *
 * Synchronous (internal) constructors are always defined in files
 * named gen_XXX, and typically just set-up data structures and
 * methods to facilitate the (asynchronous) initialization of the component.
 *
 * Synchronous constructor also validate inputs,  throwing
 * InvalidArgumentExceptions when needed. It is important to catch these
 *  exceptions within the asynchronous constructor and always
 * propagate them in the callback.
 *
 * @name gen_component
 * @namespace
 *
 */

var assert = require('assert');

/**
 * Constructor method for a generic base component.
 *
 *  Typedef for caf.specType is {{name: string, module: string,
 *                                description=: string, env: Object,
 *                                components= : Array.<caf.specType>}}
 *
 * @param {Object.<string, Object>} $ A local context containing references
 * to other resources needed by this component.
 * @param {caf.specType} spec Read-only configuration data for this
 * component extracted from a JSON description.
 * @return A generic root component representation.
 *
 * @throws {Error} If it cannot validate the inputs.
 */
exports.constructor = function($, spec) {

    assert.equal(typeof($), 'object', "'$' context is not an object");
    assert.ok($ !== null, "'$' context is null");
    assert.equal(typeof(spec), 'object', "'spec' is not an object");
    assert.equal(typeof(spec.env), 'object', "'spec.env' is not an object");
    assert.equal(typeof(spec.name), 'string', "'spec.name' is not a string");
    assert.equal(typeof(spec.module), 'string',
                 "'spec.module' is not a string");
    assert.ok((spec.description === undefined) ||
              (typeof(spec.description) === 'string'),
              "'spec.description' is not a string");
    assert.ok((spec.components === undefined) ||
              Array.isArray(spec.components),
              "'spec.components' is not an array");

    var that = {};

    /**
     * True if this component has already been shutdown.
     *
     * @type {boolean}
     * @name gen_component#.__ca_isShutdown__
     */
    that.__ca_isShutdown__ = false;


    /**
     * Gets read only configuration data for this component.
     *
     *  Typedef for caf.specType is {{name: string, module: string,
     *                                description: string, env: Object,
     *                                components= : Array.<caf.specType>}}
     *
     * @return {caf.specType} Read-only configuration data for this
     * component (derived from a JSON description).
     * @name  gen_component#__ca_getSpec__
     * @function
     */
    that.__ca_getSpec__ = function() {
        return spec;
    };


    /**
     *  Checks the health of this component.
     *
     *  @param {Object=} data An optional hint on how to perform the checkup.
     *  @param {function(?Error=, Object=)} cb A callback invoked after the
     *  check,
     *  with an error if component faulty, or optional info to bubble up.
     *
     * @name  gen_component#__ca_checkup__
     * @function
     */
    that.__ca_checkup__ = function(data, cb) {
        if (that.__ca_isShutdown__) {
            var err = new Error('Checkup failed: component already shutdown');
            err.name = spec.name;
            cb(err);
        } else {
            cb(null);
        }
    };


    /**
     *  Forces this component to shutdown. This action is non-recoverable and
     * idempotent. After a successful shutdown, a component  is deregistered
     * from the original local context '$'. If failures occur, the
     * parent component should also take a recovery action to clean-up (e.g.,
     * shutdown the  node.js process).
     *
     *  @param {Object=} data An optional hint on how to perform the shutdown.
     *  @param {function(?Error=)} A callback invoked after the
     * shutdown, with an error if it failed.
     *
     * @name  gen_component#__ca_shutdown__
     * @function
     */
    that.__ca_shutdown__ = function(data, cb) {
        that.__ca_isShutdown__ = true;
        if ($ && ($[spec.name] === that)) {
            delete $[spec.name];
        }
        cb(null);
    };

    return that;
};
