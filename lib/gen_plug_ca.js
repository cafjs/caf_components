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
 * Generic plug component associated with a single CA.
 *
 * See {@link module:caf_components/gen_plug} for a discussion of the plug-in
 * architecture in CAF.
 *
 * @module caf_components/gen_plug_ca
 * @augments module:caf_components/gen_transactional
 */
// @ts-ignore: augments not attached to a class

const genTransactional = require('./gen_transactional');

/**
 * Helper constructor method for a CA plug component.
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

    const that = genTransactional.create($, spec);

    // become the root component of the children context
    that.$._ = that;
    that.$.loader = $._.$.loader;

    /**
     * Run-time type information.
     *
     * @type {boolean}
     * @memberof! module:caf_components/gen_plug_ca#
     * @alias __ca_isPlugCA__
     */
    that.__ca_isPlugCA__ = true;


    /**
     * Returns the name of the CA that contains this plug.
     *
     * @return {string} The name of the containing CA.
     *
     * @memberof! module:caf_components/gen_plug_ca#
     * @alias __ca_getCAName__
     */
    that.__ca_getCAName__ = function() {
        return $.ca && $.ca.__ca_getName__() || spec.env.CAName;
    };

    return that;
};
