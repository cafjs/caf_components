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
 * Generic plug component.
 *
 * A plug is an object that provides an interface to an external
 * or local service.
 *
 * The plug-in architecture in CAF has three components:
 *
 *  1. A `plug` instance that is shared by all the local CAs, implemented by
 * extending `gen_plug` (this file) and, for example, pools connections to an
 *  external service. A `plug` internal state is ephemeral.
 *
 *  2. A `plug_ca` instance for each CA, implemented by extending `gen_plug_ca`.
 * It  maintains CA-specific state that is managed transactionally
 * (see {@link module:caf_components/gen_transactional}), and checkpointed with
 *  a external service.
 *
 *  3. A `proxy` instance for each CA, implemented by extending `gen_proxy`.
 *  Proxies are stateless, frozen objects, that help security by reducing the
 *  attack surface.
 *
 * Application code can only interact with services by using proxies.
 * A `plug_ca` instance also acts as the root component for the proxy, further
 * limiting access to the  hierarchy of components from user code.
 *
 * @module caf_components/gen_plug
 * @augments module:caf_components/gen_component
 */
// @ts-ignore: augments not attached to a class
var genComponent = require('./gen_component');

/**
 * Helper constructor method for a plug component.
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

    var that = genComponent.constructor($, spec);

    /**
     * Run-time type information.
     *
     * @type {boolean}
     * @memberof! module:caf_components/gen_plug#
     * @alias __ca_isPlug__
     */
    that.__ca_isPlug__ = true;

    return that;
};
