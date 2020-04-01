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
 * Functions to process template descriptions.
 *
 * A parsed description has a type `specType`:
 *
 *      { name: string, module: string | null, description=: string,
 *        env: Object, components=: Array.<specType>}
 *
 * Merging template `B` into `A` starts at the top and uses the following
 *  rules:
 *
 * 1. If we are merging the top component and `A.name !== B.name`, throw
 * an error if `overrideName` is disabled, otherwise change `A.name`.
 *
 * 2. To merge two components with the same name, if `B.module === null`
 * then delete `A`. Otherwise, change `A.module`,
 * merge the `env` properties, and finally, merge array `B.components` into
 * `A.components`.
 *
 * 3. To merge array `B.components` into `A.components`
 * iterate on each element `X` of `B.components` applying the following
 * ordering rules:
 *      1. If `X.name` matches any `Y.name` then merge with `Y` in place,
 * and remember `Y` position in the array.
 *      2. if `X.name` does not match any component, and `X.module !== null`,
 * insert `X` after the
 *  last remembered position. If none was remembered, `X` becomes the first
 *  element in the array. In both cases, remember the new `X` position.
 *
 * Merge always clones first, leaving the original descriptions unmodified.
 *
 * @module caf_components/templateUtils
 */
const assert = require('assert');

const naming = require('./naming');
const myUtils = require('./myUtils');

/**
 * Merge two component arrays of matching components.
 *
 * @param {Array.<specType>} template
 * @param {Array.<specDeltaType>} delta
 * @return {Array.<specType>} result
 */
const mergeComponents = function(template, delta) {

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

    const findEntry = function(result, name, lastOp) {
        return result.some(function(x, i) {
            if (x.name === name) {
                lastOp.index = i;
                return true;
            } else {
                return false;
            }
        });
    };

    const deleteEntry = function(result, name, lastOp) {
        if (findEntry(result, name, lastOp)) {
            result.splice(lastOp.index, 1);
            lastOp.index = lastOp.index -1;
        }
    };

    const insertEntry = function(result, entry, lastOp) {
        // splice prepends, and we want after
        lastOp.index = lastOp.index + 1;
        result.splice(lastOp.index, 0, entry);
    };

    const result = myUtils.deepClone(template);
    const lastOp = {index: -1};
    delta.forEach(function(x) {
        if (x.module === null) {
            deleteEntry(result, x.name, lastOp);
        } else if (findEntry(result, x.name, lastOp)) {
            result[lastOp.index] = mergeObj(result[lastOp.index], x, false);
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
const mergeEnv = function(template, delta) {
    assert.equal(typeof(template), 'object', "'template' is not an object");
    assert.equal(typeof(delta), 'object', "'delta' is not an object");

    const result = myUtils.deepClone(template);
    Object.keys(delta).forEach(function(x) {
        result[x] = myUtils.deepClone(delta[x]);
    });
    return result;
};

/**
 * Merge two descriptions with the same name.
 *

 * @param {specType} template
 * @param {specDeltaType} delta
 * @param {boolean} overrideName
 * @return {specType} result
 *
 */
const mergeObj = function(template, delta, overrideName) {
    if (template.name !== delta.name) {
        if (!overrideName) {
            const err = new Error('mergeObj: description names do not match');
            err['template'] = template;
            err['delta'] = delta;
            throw err;
        }
    }

    /** @type specType*/
    const result = {
        name: delta.name || template.name,
        module: (delta.module ? delta.module : template.module),
        description: delta.description ?
            delta.description :
            template.description,
        env: mergeEnv(template.env, delta.env || {})
    };

    if (template.components || delta.components) {
        result.components = mergeComponents(template.components || [],
                                            delta.components || []);
    }
    return result;
};

/**
 * Patches a template description with a delta description.
 *
 * Merge rules are described in a module-level comment in this file.
 *
 * It does not modify the inputs, returning a cloned
 * description with the merged results.
 *
 * @param {specType} template A target parsed description.
 * @param {specDeltaType=} delta Description with changes to apply to
 * `template`. A missing `delta` just clones `template`.
 * @param {boolean} overrideName True if we allow changing the name of the
 * top level component, false if names in `template` and `delta` should match.
 *
 * @return {specType} A patched description.
 *
 * @throws {Error} if invalid inputs, or `overrideName` is false and we have
 * different names for the top component.
 *
 * @memberof! module:caf_components/templateUtils
 * @alias merge
 */
exports.merge = function(template, delta, overrideName) {
    delta = delta || {name: template.name};
    return mergeObj(template, delta, overrideName);
};

/**
 *  Patches every environment in a description.
 *
 * @param {specType} desc A description to patch.
 * @param {function(Object):void} f A function to patch an environment.
 */
const patchEnv = function(desc, f) {
    if (typeof desc === 'object') {
        f(desc.env);
        if (Array.isArray(desc.components)) {
            desc.components.forEach(function(x) { patchEnv(x, f);});
        }
    } else {
        const err = new Error('patchEnv: not an object');
        err['desc'] = desc;
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
const patchOneEnv = function(prefix, f) {
    const retF = function(env) {
        Object.keys(env)
            .forEach(function(x) {
                const val = env[x];
                if ((typeof val === 'string') &&
                    (val.indexOf(prefix) === 0)) {
                    const propName = val.substring(prefix.length,
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
const parseString = function(x) {
    try {
        return JSON.parse(x);
    } catch (err) {
        return x; // assume string with no double quotes
    }
};

/**
 * Patches in place `env` values  that link to environment properties.
 *
 * We use the reserved `process.env.` prefix for values that come  from
 *  the environment.
 *
 * We can also provide default values using the string separator `||`, and any
 *  characters after it will be parsed as JSON.
 *
 * If parsing fails, we default to a simple string, avoiding the JSON
 * requirement of quoting all strings. For example:
 *
 * `env: {"location" : "process.env.MY_LOCATION||Palo Alto"}`
 *
 * @param {specType} desc A description to be patched.
 *
 * @memberof! module:caf_components/templateUtils
 * @alias resolveEnv
 */
exports.resolveEnv = function(desc) {
    const f = patchOneEnv(naming.ENV_PROPERTY_PREFIX, function(propName) {
        const p = propName.split('||');
        const prop = process.env[p[0].trim()];
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
 * Patches in place links to the top level environment.
 *
 * We use the prefix  `$._.env.`. For example:
 *
 * `env: {"location" : "$._.env.location"}`
 *
 * @param {specType} desc A description to be patched.
 *
 * @memberof! module:caf_components/templateUtils
 * @alias resolveLinks
 */
exports.resolveLinks = function(desc) {
    const topEnv = desc.env;
    const f = patchOneEnv(naming.ENV_LINK_PREFIX, function(propName) {
        return topEnv[propName];
    });
    patchEnv(desc, f);

};
