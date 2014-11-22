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
 * A proxy is a stateless, frozen object that enables secure access to local
 * services from  application code.
 *
 * Proxies provide a limited service interface, enforce security checks on
 *  arguments, and piggyback to requests authenticated source information.
 *
 *
 * @name gen_proxy
 * @namespace
 * @augments gen_component
 */

var genComponent = require('./gen_component');

/**
 * Constructor method for a generic proxy component.
 *
 * @see gen_component
 *
 */
exports.constructor = function($, spec) {

    var that = genComponent.constructor($, spec);

    /**
     * Run-time type information.
     *
     * @type {boolean}
     * @name gen_proxy#__ca_isProxy__
     */
    that.__ca_isProxy__ = true;

    /**
     * Do not shutdown unknown proxies in a container.
     *
     * This allows adding proxy objects in (static) containers without
     *  modifying specs.
     *
     */
    that.__ca_isNotUnknown__ = true;


    /**
     * Returns the unique ID of the CA that contains this proxy.
     *
     * @return {string} A unique ID for the containing CA.
     */
    that.__ca_getCAName__ = function() {
        return $._.__ca_getCAName__();
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
     * @override
     * @name  gen_proxy#__ca_shutdown__
     * @function
     */
    that.__ca_shutdown__ = function(data, cb) {
        /* Enable frozen proxies by replacing default shutdown method
         that sets 'that.isShutdown' to  true.*/
        //        that.__ca_isShutdown__ = true;
        if ($ && ($[spec.name] === that)) {
            delete $[spec.name];
        }
        cb(null);
    };
    return that;
};
