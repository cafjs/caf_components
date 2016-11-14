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
 * Constants for naming conventions.
 *
 *
 * @module caf_components/naming
 */


/**
 * The name of the topmost level component in every context.
 *
 * @type {string}
 * @memberof! module:caf_components/naming
 * @alias TOP
 */
exports.TOP = '_';


/**
 * The name of the loader component in the top level context.
 *
 * @type {string}
 * @memberof! module:caf_components/naming
 * @alias LOADER
 */
exports.LOADER = 'loader';

/**
 * The name of the enclosing CA component in a particular CA context.
 *
 * @type {string}
 * @memberof! module:caf_components/naming
 * @alias CA
 */
exports.CA = 'ca';

/**
 * The suffix in a JSON description filename to indicate that is a delta on a
 * JSON template with similar base name. For example, `foo++.json` is a delta
 * on the template `foo.json`.
 *
 * @type {string}
 * @memberof! module:caf_components/naming
 * @alias DELTA
 */
exports.DELTA = '++.json';

/**
 * Prefix that identifies a description value in an environment that needs
 * to be resolved to a top level description property.
 *
 * @type {string}
 * @memberof! module:caf_components/naming
 * @alias ENV_LINK_PREFIX
 */
exports.ENV_LINK_PREFIX = '$._.env.';


/**
 * Prefix that identifies a description value that needs to be resolved by
 *  looking up an environment property.
 *
 * @type {string}
 * @memberof! module:caf_components/naming
 * @alias ENV_PROPERTY_PREFIX
 */
exports.ENV_PROPERTY_PREFIX = 'process.env.';
