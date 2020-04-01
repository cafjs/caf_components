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
 * A proxy is a stateless, frozen object that enables secure access to local
 * services from  application code.
 *
 * A proxy provides a restricted interface to a service, enforces
 * security checks on arguments, and piggybacks trusted source information
 * to all requests.
 *
 * Proxies are a key enabler of the *internal trusted bus*
 * architecture of a CAF application that facilitates multi-tenancy with
 * collaboration.
 *
 * By convention proxies are always named `proxy` in a description, and
 * this makes it easier for internal code to discover them.
 *
 * See {@link module:caf_components/gen_plug} for a discussion of the plug-in
 * architecture in CAF.
 *
 * @module caf_components/gen_proxy
 * @augments module:caf_components/gen_component
 */
// @ts-ignore: augments not attached to a class

const genComponent = require('./gen_component');

/**
 * Helper constructor method for a proxy component.
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

    const that = genComponent.create($, spec);

    /**
     * Run-time type information.
     *
     * @type {boolean}
     * @memberof! module:caf_components/gen_proxy#
     * @alias __ca_isProxy__
     */
    that.__ca_isProxy__ = true;

    /**
     * Disable shutdown of unknown proxies in a container.
     *
     * This allows dynamically adding proxy objects in (static) containers
     *  without modifying specs.
     *
     * @type {boolean}
     * @memberof! module:caf_components/gen_proxy#
     * @alias __ca_isNotUnknown__
     */
    that.__ca_isNotUnknown__ = true;


    /**
     * Returns the name of the CA that contains this proxy.
     *
     * @return {string} A name for the containing CA.
     *
     * @memberof! module:caf_components/gen_proxy#
     * @alias __ca_getCAName__
     */
    that.__ca_getCAName__ = function() {
        return $._.__ca_getCAName__();
    };

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
