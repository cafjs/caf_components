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
 * Generic component that loads component descriptions and their
 *  implementations.
 *
 * The strategy for finding these artifacts  is straighforward. We configure a
 *  sequence of node.js 'module' objects, and we keep on calling
 * 'require' in each of them until one returns it. Eventually, we just use the
 *  local 'module', and throw an exception if our last chance didn't find it.
 *
 * Typically, the caller of this loader will setup that chain of modules by
 *  using its own and/or  parent modules. The goal is to mimic what a 'require'
 * in the application code would do, but also provide a meaningful default.
 *
 * Descriptions can also be fully resolved during loading. This is a four step
 *  process. For example, for a description 'foo.json':
 *
 *   1) Load foo.json and foo++.json as before, use foo.json as a template
 *  and merge-in the changes in foo++.json. See 'templateUtils.js' for  details.
 *
 *   2) Merge the resulting description with an optional 'spec' passed as an
 * argument to the 'load description' method.
 *
 *   3) Replace references to environment properties ("process.env.WHATEVER")
 * by their values.
 *
 *   4) Replace references to the env in the top level component by their values
 *   (for example,  '"foo" : "$._.env.bar"' in any component will assign to
 *  'foo' the same value as  the top level component assigns to 'bar'. We
 *  currently don't support linking to other components, and resolved values
 *  cannot be links themselves.
 *
 * Why so many steps?
 *
 * Most CAF applications target a cloud environment, and
 * they make small changes to a base configuration, e.g., add a new plugin.
 * Then, a PaaS, such as Cloud Foundry,  injects configuration via environment
 *  properties at deployment time. Finally, we may want to create many
 * components using that base+plugin+environment and customize each one somehow,
 *  e.g., change the name or how frequently they should update.
 *
 * In this scenario,  'foo++.json' adds the plugin, references to
 * process.env.WHATEVER read PaaS properties, and the spec passed as an
 * argument customizes each component. To provide a sensible encapsulation
 * most run-time customizable properties (by the environment or spec) are
 * declared at the top level component and linked by the inner components that
 * need them.
 *
 * @name gen_loader
 * @namespace
 * @augments gen_component
 *
 */
var path = require('path');
var genComponent = require('./gen_component');
var myUtils = require('./myUtils');
var templateUtils = require('./templateUtils');
var async = require('async');

/**
 * Constructor method for a generic loader component.
 *
 * @see gen_component
 *
 */
exports.constructor = function($, spec) {

    $ = $ || {_: {$: {} }};
    spec = spec || {name: 'loader', module: 'defaultLoader', env: {}};


    var that = genComponent.constructor($, spec);

    var modules = [];

    var cachedResources = {};

    /**
     *  Loads a description or component implementation using a sequence of
     *  module resolvers.
     *
     *  @param {string} artifact The name of the description or component
     *  implementation as it would be used in a node.js 'require' call.
     *
     * @return {Object} A description or loaded module.
     *
     * @throws {Error} When it cannot found the artifact anywhere.
     */
    var load = function(artifact) {
        var result = null;
        modules.some(function(mod) {
            try {
                result = mod.require(artifact);
                return true;
            } catch (err) {
                var msg = "Loader: can't load " + artifact +
                        ' with ' + mod.id +
                        ' error: ' + err.message;//myUtils.errToPrettyStr(err);
                if ($._.$.log) {
                    $._.$.log.debug(msg);
                } else {
                    // to display description errors before logger
                    /* eslint-disable */
                    console.log(msg);
                    /* eslint-enable */
                }
                return false;
            }
        });
        result = result || require(artifact);
        if (result) {
            var msg = 'Loader: load OK ' + artifact;
            if ($._.$.log) {
                $._.$.log.debug(msg);
            } else {
                /* eslint-disable */
                console.log(msg);
                /* eslint-enable */
            }
        }
        return result;
    };

    /**
     * Returns the file path of the top level module. Typically, where the
     * 'ca_methods.js' has been defined, e.g., <app_dir>/lib.
     *
     * @return {string} The file path of the top level module
     *
     */
    that.__ca_firstModulePath__ = function() {
        return path.resolve(modules[0].paths[0], '..');
    };

    /**
     * Register the logger component.
     *
     */
    that.__ca_registerLogger__ = function(logger) {
        $._.$.log = logger;
    };

    /**
     * Sets a list of modules that should be used in sequence to 'require'
     *  the descriptions and implementations.
     *
     * @param {Array.<Object>} modulesArray A list of node.js 'module' objects
     *  to 'require' descriptions and implementations.
     */
    that.__ca_setModules__ = function(modulesArray) {
        modules = myUtils.clone(modulesArray);
        cachedResources = {};
    };


    /**
     * Gets an arbitrary resource that can be loaded with 'require()'. It
     * keeps an internal cache that only clears when the searched modules list
     * changes.
     *
     * @param {string} resourceName The name of the resource to load.
     * @return {Object} A resource  that can be loaded with 'require()'.
     * @throws {Error} When it cannot find the resource
     *
     */
    that.__ca_loadResource__ = function(resourceName) {
        var result = cachedResources[resourceName];
        if (!result) {
            result = load(resourceName);
            cachedResources[resourceName] = result;
        }
        return result;
    };


    /**
     * Loads a JSON component description. It can also fully resolve it by
     * using templates, links, environment properties, and the 'spec' optional
     * argument. See the top header description for details.
     *
     * @param {string} fileName A file name with '.json' extension.
     * @param {boolean} resolve True if full resolution of the description is
     *  needed.
     * @param {caf.specType=} spec An optional description to be merged-in with
     * the result.
     * @return {Object} A parsed component description.
     *
     * @throws {Error} If it cannot find the description or parse it properly.
     *
     */
    that.__ca_loadDescription__ = function(fileName, resolve, spec) {
        if ((fileName.indexOf('.') !== 0) &&
            (fileName.indexOf('/') !== 0)) {
            fileName = './' + fileName;
        }
        if (fileName.indexOf('.json') !== (fileName.length - 5)) {
            var err = new Error("Loader:Description does not end in '.json'");
            err.fileName = fileName;
            throw err;
        }

        if (resolve) {
            // ignore the ++ suffix
            if (fileName.indexOf('++.json') === (fileName.length - 7)) {
                fileName = fileName.substring(0, fileName.length - 7) + '.json';
            }
            /*
             * 'require()' only caches modules not 'json' descriptions. To be
             * consistent, and avoid blocking, we also cache descriptions.
             * Otherwise, changing both descriptions and code will lead to
             * unpredictable results.
             *
             * This means no hot re-deploy, instead, just restart the process...
             *
             */
            var base = that.__ca_loadResource__(fileName);
            var delta = null;
            try {
                fileName = fileName.substring(0, fileName.length - 5) +
                    '++.json';
                delta = that.__ca_loadResource__(fileName);
            } catch (errDelta) {
                $._.$.log &&
                    $._.$.log.debug('WARNING: loadDescription:No delta file:' +
                                    fileName + ': ' + errDelta.message);
            }
            // 1. Merge template.
            var result = templateUtils.merge(base, delta); //always clones base

            // 2. Merge input spec.
            if (spec) {
                result = templateUtils.merge(result, spec, true);
            }
            // 3. Resolve process.env
            templateUtils.resolveEnv(result);

            // 4. Resolve links to top env.
            templateUtils.resolveLinks(result);

            return result;
        } else {
            return that.__ca_loadResource__(fileName);
        }

    };

    /**
     * Loads, initializes, and registers in a local context a component.
     *
     * It uses a convention for compSpec.module of the form
     * 'module_name#method1#method2' that implements the following constructor
     * 'require("module_name").method1.method2.newInstance()'
     *
     * @param{Object} comp$ A context to register the component with name
     * 'compSpec.name'.
     * @param {caf.specType} compSpec A description of the component.
     * @param {caf.cb} cb A callback to return the component or an error.
     *
     */
    that.__ca_loadComponent__ = function(comp$, compSpec, cb) {
        try {
            var name = compSpec.module.split('#');
            var comp = load(name.shift());
            while (name.length > 0) {
                var method = name.shift();
                comp = comp[method];
            }
            if (!comp || (typeof comp.newInstance !== 'function')) {
                var error = new Error('Cannot load component');
                error.module = compSpec.module;
                error.spec = compSpec;
                throw error;
            }
            var result = null;
            async.waterfall([
                function(cb1) {
                    var logF = function(err, val) {
                        $._.$.log &&
                            $._.$.log.trace('Ignoring call >1 err: ' +
                                            myUtils.errToPrettyStr(err) +
                                            ' data: ' + val);
                    };
                    var cbOnce = myUtils.callJustOnce(logF, cb1);
                    comp.newInstance(comp$, compSpec, cbOnce);
                },
                function(res, cb1) {
                    result = res;
                    res.__ca_checkup__(null, cb1);
                }
            ], function(err) {
                if (err) {
                    cb(err);
                } else {
                    comp$[compSpec.name] = result;
                    cb(err, result);
                }
            });
        } catch (err) {
            cb(err);
        }
    };

    return that;
};
