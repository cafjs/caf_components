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
 * Generic base component.
 *
 * CAF component construction is asynchronous, using a
 * standard factory method named `newInstance()`.
 *
 * To simplify writing asynchronous constructors we
 * wrap the synchronous bits of a constructor in an internal
 * helper, i.e., a factory method named `create()`.
 *
 * Then, we use the following pattern:
 *```
 *     const genXX = require('./gen_XX');
 *     ...
 *     exports.newInstance = async function($, spec) {
 *         try {
 *             const that = genXX.create($, spec);
 *          // do asynchronous initialization of 'that' and then return tuple
 *             ...
 *                return [err, that];
 *         } catch(err) {
 *             return [err];
 *         }
 *     }
 *```
 * Internal helpers are defined by convention in files
 * named `gen_*`, and typically just set up data structures and
 * methods to facilitate the (asynchronous) initialization of the component.
 *
 * They also check inputs, throwing errors if invalid.
 * It is important to catch these exceptions within the asynchronous
 * constructor, and propagate them in the callback, as shown above.
 *
 *  CAF.js creates objects using a pure functional style because
 * closures enable private state, providing strong security properties.
 *
 *
 * @module caf_components/gen_component
 *
 */

const assert = /**@ignore @type {typeof import('assert')} */(require('assert'));
const myUtils = require('./myUtils');

/**
 * Helper constructor method for a generic component.
 *
 * Description of types in file `types.js`.
 *
 * @param {ctxType} $ A context containing references to other components.
 * @param {specType} spec Configuration data for this component.
 * @return {Object} A new generic component.
 *
 * @throws {Error} If inputs are invalid.
 */
exports.create = function($, spec) {

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

    const that = {};

    /**
     * True if this component has already been shutdown.
     *
     * @type {boolean}
     * @memberof! module:caf_components/gen_component
     * @alias __ca_isShutdown__
     */
    that.__ca_isShutdown__ = false;


    /**
     * Gets configuration data for this component. This data is read-only.
     *
     *  Typedef for specType is {{name: string, module: string,
     *                                description: string, env: Object,
     *                                components= : Array.<specType>}}
     *
     * @return {specType} Read-only configuration data for this
     * component.
     *
     * @memberof! module:caf_components/gen_component
     * @alias __ca_getSpec__
     */
    that.__ca_getSpec__ = function() {
        return spec;
    };


    /**
     *  Checks the health of this component.
     *
     * A shutdown component always fails the check.
     *
     * A failed check typically requires that the caller forces a shutdown, and
     * then creates a new replacement component.
     *
     *  @param {Object} data A hint on how to perform the checkup or `null`.
     *  @param {cbType=} cb A callback invoked after the check,
     *  with an error if the component is faulty, or optional info to bubble up
     *  in the second callback argument. If missing, it returns a
     *  promise with the equivalent array tuple `[err, data]`.
     *
     * @return {Promise.<Array.<Object>>=} An optional promise that resolves to
     * an array tuple `[err, data]` when the callback is missing. Rejected
     * promises only propagate unhandled exception errors.
     *
     * @function
     * @memberof! module:caf_components/gen_component
     * @alias __ca_checkup__
     */
    that.__ca_checkup__ = myUtils.condPromisify(function(data, cb) {
        if (that.__ca_isShutdown__) {
            const err = new Error('Checkup failed: component already shutdown');
            err.name = spec.name;
            cb(err);
        } else {
            cb(null);
        }
    });


    /**
     * Forces this component to shutdown.
     *
     * This action is non-recoverable and idempotent.
     *
     * After a successful shutdown, this component is deregistered
     * from the original local context `$`.
     *
     * If failures occur during shutdown, the parent component should also take
     * a recovery action to clean-up, e.g., retry or propagate shutdown to the
     * parent process.
     *
     *  @param {Object} data A hint on how to perform the shutdown or `null`.
     *  @param {cbType=} cb An optional callback invoked after
     * shutdown, with an error if it failed. If missing, it returns a
     * promise with the equivalent array tuple `[err, data]`.
     *
     * @return {Promise.<Array.<Object>>=} An optional promise that resolves to
     * an array tuple `[err, data]` when the callback is missing. Rejected
     * promises only propagate unhandled exception errors.
     *
     * @function
     * @memberof! module:caf_components/gen_component
     * @alias __ca_shutdown__
     */
    that.__ca_shutdown__ = myUtils.condPromisify(function(data, cb) {
        that.__ca_isShutdown__ = true;
        if ($ && ($[spec.name] === that)) {
            delete $[spec.name];
        }
        cb(null);
    });

    return that;
};
