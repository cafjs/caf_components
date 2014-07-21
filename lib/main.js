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
 * initialized context (with objects $._ and $._.$).
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
         * 1) Creating a top level context:
         *
         * p = {loader: <loaderObject>}
         *
         * top  = {'$' : p}
         *
         * top._ = top;
         *
         * and now we pass 'top' as context $ in loadComponent.
         *
         * The first thing loadComponent does is to create a gen_container
         * that uses `top` as $ and sets the children context to
         * $.$ (in this case 'p'). Then, it initializes the '_'
         * in the children context to point to $._ (in this case 'top._' that is
         * equal to 'top').
         *
         * And now all the links work.
         *
         * If the container wants to access the
         *  loader, it does $._.$.loader and that resolves to top.$.loader and
         * then p.loader as we want.
         *
         * If a child wants to access the loader it does $._.$.loader that
         * resolves to top._.$.loader and then top.$.loader like above.
         *
         * All the children of gen_container are now siblings of loader and can
         * be accessed in the same way $._.$.<name>
         *
         * And finally we can return using the callback $ that contains the
         *  component (gen_container) that we have just built.
         *
         *
         * 2) Using an existing context:
         *
         * We just pass the given context to loadComponent. It should be a
         * properly constructed context with $._ and $._.$ defined.
         *
         *
         */
        if ($ === null) {
            // root of the hierarchy
            var p = { loader : gen_loader.constructor()};
            $ = {'$': p};
            $._ = $;
        }
        var loader = $._.$.loader;
        loader.__ca_setModules__(modules);
        var compSpec = loader.__ca_loadDescription__(resourceName, true, spec);
        var cb1 = function (err, top) {
            if (err) {
                cb(err);
            } else {
                // loadComponent already registered `top` in `$`
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
exports.gen_cron = require('./gen_cron');
exports.gen_proxy = require('./gen_proxy');
exports.gen_transactional = require('./gen_transactional');
exports.gen_container = require('./gen_container');
exports.gen_dynamic_container = require('./gen_dynamic_container');
exports.gen_loader = require('./gen_loader');


// export utils/conventions
exports.myUtils = require('./myUtils');
exports.containerUtils = require('./containerUtils');
exports.templateUtils = require('./templateUtils');
exports.naming = require('./naming');
