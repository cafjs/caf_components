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
 * Functions to process template descriptions.
 *
 *
 * @name templateUtils
 * @namespace
 */
var assert = require('assert');

var naming = require('./naming');
var myUtils = require('./myUtils');

/*
 *  Typedef for caf.specType is {{name: string, module: string,
 *                                description: string, env: Object,
 *                                components= : Array.<caf.specType>}}
 *
 */

/**
 * Merge two component arrays of matching components.
 *
 * @param {Array.<caf.specType>} template
 * @param {Array.<caf.specType>} delta
 * @return {Array.<caf.specType>} result
 */
var mergeComponents = function(template, delta) {

    assert.ok(Array.isArray(template), "'template' is not an array");
    assert.ok(Array.isArray(delta), "'delta' is not an array");

    /*
     *  This merge step is inefficient O(n*m) but we are assuming small arrays
     *  and 'delta' typically smaller than 'template'.
     *
     *  A 'delta' operation could merge with another component in 'template'
     *  with the same name, it could delete an existing entry if the 'module'
     *  key is null, or it could insert a new entry in the array.
     *  The insertion point of a new entry is just after the previous
     *  operation target. If the first operation in 'delta' is a new entry it
     *  becomes the first element.
     *
     *  Note that 'delta' is not sorted and it could contain duplicates. This
     * allow us to change the order in the original list. For example,
     *  if template is [A|B|...], and we want to swap B and A, we can add these
     * three operations in delta:
     *
     *     Remove A (assign null to A's module)
     *     Touch B (just have an entry with B's name that won't change B)
     *     Add A with the original A's values (inserted after B)
     *
     */

    var findEntry = function(result, name, lastOp) {
        return result.some(function(x, i) {
            if (x.name === name) {
                lastOp.index = i;
                return true;
            } else {
                return false;
            }
        });
    };

    var deleteEntry = function(result, name, lastOp) {
        if (findEntry(result, name, lastOp)) {
            result.splice(lastOp.index, 1);
            lastOp.index = lastOp.index -1;
        }
    };

    var insertEntry = function(result, entry, lastOp) {
        // splice prepends, and we want after
        lastOp.index = lastOp.index + 1;
        result.splice(lastOp.index, 0, entry);
    };

    var result = myUtils.deepClone(template);
    var lastOp = {index: -1};
    delta.forEach(function(x) {
        if (x.module === null) {
            deleteEntry(result, x.name, lastOp);
        } else if (findEntry(result, x.name, lastOp)) {
            result[lastOp.index] = mergeObj(result[lastOp.index],
                                            x);
        } else {
            insertEntry(result, myUtils.deepClone(x), lastOp);
        }
    });
    return result;
};

/**
 * Merge two environments of matching components.
 *
 * @param {Object} template
 * @param {Object} delta
 * @return {Object} result
 */
var mergeEnv = function(template, delta) {
    assert.equal(typeof(template), 'object', "'template' is not an object");
    assert.equal(typeof(delta), 'object', "'delta' is not an object");

    var result = myUtils.deepClone(template);
    Object.keys(delta).forEach(function(x) {
        result[x] = myUtils.deepClone(delta[x]);
    });
    return result;
};

/**
 * Merge two descriptions with the same name.
 *

 * @param {caf.specType} template
 * @param {caf.specType} delta
 * @param {boolean} overrideName
 * @return {caf.specType} result
 *
 */
var mergeObj = function(template, delta, overrideName) {
    var result = {};
    if (template.name !== delta.name) {
        if (!overrideName) {
            var err = new Error('mergeObj: description names do not match');
            err.template = template;
            err.delta = delta;
            err.result = result;
            throw err;
        }
    }
    result.name = delta.name || template.name;
    result.module = (delta.module ? delta.module : template.module);
    result.description = (delta.description ? delta.description :
                          template.description);
    result.env = mergeEnv(template.env, delta.env || {});
    if (template.components || delta.components) {
        result.components = mergeComponents(template.components || [],
                                            delta.components || []);
    }
    return result;
};

/**
 * Patches a template description with a delta description. It does not modify
 * the inputs, returning a cloned
 * description with the merged results.
 *
 * @param {caf.specType} template A target description
 * @param {caf.specType | null} delta Description with changes to apply to
 * template or null if we just want to clone the template.
 * @param {boolean} overrideName True if we allow changing the name of the
 * top level component, false if names in `template` and `delta` should match.
 *
 * @return {caf.specType} A patched description.
 *
 */
exports.merge = function(template, delta, overrideName) {
    // TODO: check inputs and the merged output.
    delta = delta || {name: template.name};
    return mergeObj(template, delta, overrideName);
};

/**
 *  Patches every environment in a description.
 *
 * @param {caf.specType} desc A description to patch.
 * @param {function(Object)} f A function to patch an environment.
 */
var patchEnv = function(desc, f) {
    if (typeof desc === 'object') {
        f(desc.env);
        if (Array.isArray(desc.components)) {
            desc.components.forEach(function(x) { patchEnv(x, f);});
        }
    } else {
        var err = new Error('patchEnv: not an object');
        err.desc = desc;
        throw err;
    }
};

/**
 * Returns a function that filters relevant values in an environment and
 * applies a transform to them.
 *
 * @param {string} prefix A matching prefix for selected values.
 * @param {function(string): Object} f A function that transforms matching
 *  values.
 *
 */
var patchOneEnv = function(prefix, f) {
    var retF = function(env) {
        Object.keys(env)
            .forEach(function(x) {
                var val = env[x];
                if ((typeof val === 'string') &&
                    (val.indexOf(prefix) === 0)) {
                    var propName = val.substring(prefix.length,
                                                 val.length);
                    env[x] = f(propName);
                } else if (Array.isArray(val)) {
                    retF(val);
                } else if (val && (typeof val === 'object')) {
                    retF(val);
                }
            });
    };
    return retF;
};

/**
 * Parses an string into an object or number or boolean or null...
 * If we fail we just leave it as it was.
 *
 * @param {string} x String to parse
 *
 * @return {number| boolean| string| null| object} A parsed object.
 */
var parseString = function(x) {
    try {
        return JSON.parse(x);
    } catch (err) {
        return x; // assume string with no double quotes
    }
};

/**
 * Patches values in a description linking to environment properties.
 *
 * A default value can be specified by using '||', for example,
 *
 * "location" : "process.env.MY_LOCATION || Palo Alto"
 *
 * @param {caf.specType} desc A description to be patched.
 */
exports.resolveEnv = function(desc) {
    var f = patchOneEnv(naming.ENV_PROPERTY_PREFIX, function(propName) {
        var p = propName.split('||');
        var prop = process.env[p[0].trim()];
        if (prop === undefined) {
            if (p.length === 2) {
                return parseString(p[1].trim());
            } else {
                return undefined;
            }
        } else {
            return parseString(prop);
        }
    });
    patchEnv(desc, f);
};


/**
 * Patches links to the top level environment;
 *
 * @param {caf.specType} desc A description to be patched.
 */
exports.resolveLinks = function(desc) {
    var topEnv = desc.env;
    var f = patchOneEnv(naming.ENV_LINK_PREFIX, function(propName) {
        return topEnv[propName];
    });
    patchEnv(desc, f);

};
