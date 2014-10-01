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
 * Generic plug component associated with a single CA.
 *
 * A plug CA is a stateful object associated with a single CA that provides an
 * interface to an external or local service. This interface is typically
 * wrapped into a stateless secure proxy before it gets exposed to application
 * code.
 *
 * A plug CA acts as a root container for that proxy, mediating access to other
 * internal services.
 *
 *
 * @name gen_plug_ca
 * @namespace
 * @augments gen_container
 */

var genContainer = require('./gen_container');


/**
 * Constructor method for a generic plug CA component.
 *
 * @see gen_component
 *
 */
exports.constructor = function($, spec) {

    var that = genContainer.constructor($, spec);

    // become the root component of the children context
    that.$._ = that;

    /**
     * Run-time type information.
     *
     * @type {boolean}
     * @name gen_plug#__ca_isPlugCA__
     */
    that.__ca_isPlugCA__ = true;


    /**
     * Returns the unique ID of the CA that contains this plug.
     *
     * @return {string} A unique ID for the containing CA.
     */
    that.__ca_getCAName__ = function() {
        return spec.CAName;
    };

    return that;
};
