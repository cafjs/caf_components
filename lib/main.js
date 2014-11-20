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

var gen_loader = require('./gen_loader');


/**
 * Creates and initializes a hierarchy of asynchronous components.
 *
 *
 * @param {null | Object.<string, Object>}  $ A context for the top level
 * component. If null we create a new one, otherwise it should be a properly
 * initialized context (with objects $._ and $._.$, where $._ refers to the
 *  top level component).
 * @param {caf.specType=} spec Extra configuration data that will be merged
 *  with the resource description. For example, to override the default name
 *  of the top component using `spec.name`.
 * @param {string} resourceName The name of a description that specifies
 *  the components. We load the description using node.js
 *  module system (see 'gen_loader').
 * @param {Array.<Object>} modules A sequence of modules  to load
 *  descriptions and implementations (see 'gen_loader').
 * @param {caf.cb} cb A callback to return `$` with the created top level
 *  component bound by its name or an error.
 *
 */
var load = exports.load = function($, spec, resourceName, modules, cb) {
    try {
        /*
         *
         * 1) Creating a top level context:
         *
         * p = {loader: <loaderObject>}
         *
         * and now we pass {'$' : p} as context $ in loadComponent.
         *
         * The first thing loadComponent does is to create a gen_supervisor
         * 'sup' (or other container) that sets its children context to
         *  $.$ (in this case 'p').
         *
         * Then, it initializes '_' in the children context and in sup's
         * enclosing context to point to 'sup'.
         *
         * And now all the links work.
         *
         * If 'sup' wants to access the loader, it does $._.$.loader and that
         *  resolves to sup.$.loader (i.e.,  p.loader).
         *
         * If a child wants to access the loader it does $._.$.loader and that
         * resolves to sup.$.loader as above.
         *
         * All the children of 'sup' are now siblings of loader and can
         * be accessed in the same way $._.$.<name>
         *
         *
         * 2) Using an existing context:
         *
         * We just pass the given context to loadComponent. It should be a
         * properly constructed context with $._ and $._.$ defined.
         *
         *
         */
        var loader = null;
        if ($ === null) {
            // root of the hierarchy
            var p = { loader : gen_loader.constructor()};
            $ = {'$': p};
            loader = p.loader;
        }
        loader = loader || $._.$.loader;
        loader.__ca_setModules__(modules);
        var compSpec = loader.__ca_loadDescription__(resourceName, true, spec);
        var cb1 = function (err, comp) {
            if (err) {
                cb(err);
            } else {
                /* loadComponent already registered comp in `$` with its name,
                 * and also as `$._` if it was the top level component.
                 */
                cb(err, $);
            }
        };
        loader.__ca_loadComponent__($, compSpec, cb1);
    } catch(err) {
        cb(err);
    }
};



// export all the generic constructors
exports.gen_component = require('./gen_component');
exports.gen_container = require('./gen_container');
exports.gen_plug = require('./gen_plug');
exports.gen_plug_ca = require('./gen_plug_ca');
exports.gen_cron = require('./gen_cron');
exports.gen_proxy = require('./gen_proxy');
exports.gen_transactional = require('./gen_transactional');
exports.gen_container = require('./gen_container');
exports.gen_dynamic_container = require('./gen_dynamic_container');
exports.gen_loader = require('./gen_loader');
exports.gen_supervisor= require('./gen_supervisor');

// export default implementations
exports.supervisor= require('./supervisor');
exports.plug_log = require('./plug_log');

// export utils/conventions
exports.myUtils = require('./myUtils');
exports.containerUtils = require('./containerUtils');
exports.templateUtils = require('./templateUtils');
exports.naming = require('./naming');


// external
exports.async = require('async');
