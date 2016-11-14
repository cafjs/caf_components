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
 * The strategy for finding these artifacts is straighforward. We configure a
 *  sequence of `module` objects, and we keep on calling the method
 * `require` in each of them until one returns it.
 *
 * If none succeeds, we default to the standard `require` that throws an
 * exception if not found.
 *
 * How to obtain `module` objects? Packages export them in a static method,
 * for example:
 *
 *       exports.getModule = function() {
 *           return module;
 *       }
 *
 * The goal is to allow the application to override anything, but at the same
 * time provide sensible defaults. These defaults may be hidden in the
 * directories of other packages, and packages should export their own `module`
 * to make them accessable.
 *
 * A package can export many resources using the `#` qualifier. For example,
 * `caf_components#async` first resolves `caf_components` as above, and then
 * reads the property `async` on the resolved object.
 *
 *
 * @module caf_components/gen_loader
 * @augments module:caf_components/gen_component
 *
 */
var path = require('path');
var genComponent = require('./gen_component');
var myUtils = require('./myUtils');
var templateUtils = require('./templateUtils');
var async = require('async');

exports.constructor = function($, spec) {

    $ = $ || {_: {$: {} }};
    spec = spec || {name: 'loader', module: 'defaultLoader', env: {}};


    var that = genComponent.constructor($, spec);

    var modules = [];

    var cachedResources = {};

    /*
     *  Loads a description or component implementation using a sequence of
     *  `module` resolvers.
     *
     *  @param {string} artifact The name of the description or component
     *  implementation as it would be used in a node.js `require` call.
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
     * Returns the file path of the top level module.
     *
     * In a typical CAF application this path shows where the
     * `ca_methods.js` has been defined, e.g., `<app_dir>/lib`.
     *
     * @return {string} The file path of the top level module.
     *
     * @memberof! module:caf_components/gen_loader#
     * @alias __ca_firstModulePath__
     */
    that.__ca_firstModulePath__ = function() {
        return path.resolve(modules[0].paths[0], '..');
    };

    /**
     * Register the logger component.
     *
     * The loader is typically the first component that is loaded, i.e., before
     * the logger, but we want the loader to log error messages. Therefore, a
     * explicit late registration is needed.
     *
     * @param {Object} logger A logger component.
     *
     * @memberof! module:caf_components/gen_loader#
     * @alias __ca_registerLogger__
     */
    that.__ca_registerLogger__ = function(logger) {
        $._.$.log = logger;
    };

    /**
     * Sets a list of `module` resolvers that should be used in sequence to
     * `require` descriptions and implementations.
     *
     * @param {Array.<Object>} modulesArray A sequence of `module` objects
     *  to `require` descriptions and implementations.
     *
     * @memberof! module:caf_components/gen_loader#
     * @alias __ca_setModules__
     */
    that.__ca_setModules__ = function(modulesArray) {
        modules = myUtils.clone(modulesArray);
        cachedResources = {};
    };


    /**
     * Loads a resource that could be loaded with `require`, e.g., a JSON
     * description or a class module.
     *
     * It keeps an internal cache of resources that clears when the
     * `module` list changes. See `__ca_setModules__ `.
     *
     * @param {string} resourceName The name of the resource to load.
     * @return {Object} A loaded resource.
     * @throws {Error} When it cannot find the resource
     *
     * @memberof! module:caf_components/gen_loader#
     * @alias __ca_loadResource__
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
     * Loads a JSON component description.
     *
     * If needed, it also resolves the description by applying
     * templates, following links, reading environment properties, and
     * passing `spec` optional  arguments.
     *
     * @param {string} fileName A file name with a '.json' extension.
     * @param {boolean} resolve True if a fully resolved description is
     *  needed.
     * @param {caf.specType=} spec An optional description to be merged-in with
     * the result.
     * @return {Object} A parsed component description.
     *
     * @throws {Error} If it cannot find the description or parsing error.
     *
     * @memberof! module:caf_components/gen_loader#
     * @alias __ca_loadDescription__
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
     * Loads, initializes, and registers a new component.
     *
     * It uses a convention for `compSpec.module` of the form
     * `module_name#method1#method2` that resolves to the following constructor
     * `require("module_name").method1.method2.newInstance()`
     *
     * @param{Object} comp$ A context to register the component using name
     * `compSpec.name`.
     * @param {caf.specType} compSpec A description of the component.
     * @param {caf.cb} cb A callback to return the component or an error.
     *
     * @memberof! module:caf_components/gen_loader#
     * @alias __ca_loadComponent__
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
