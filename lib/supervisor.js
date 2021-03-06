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
 * Default implementation of a supervisor.
 *
 * It uses the `lazy` start mode.
 * See {@link module:caf_components/gen_supervisor}  for details.
 *
 * @module caf_components/supervisor
 * @augments module:caf_components/gen_supervisor
 */
// @ts-ignore: augments not attached to a class

const gen_sup = require('./gen_supervisor');
const myUtils = require('./myUtils');

/**
 * Factory method to create a supervisor component.
 *
 * @param {ctxType} $ A context containing references to other components.
 * @param {specType} spec Configuration data for this component.
 *
 * @return {Promise<Array.<any>>} A tuple array returning an optional `Error`
 * in the first argument, or the new component in the second.
 */
exports.newInstance = async function($, spec) {
    try {
        const that = gen_sup.create($, spec);

        const notifyF = function(err, res) {
            if (err) {
                $._.$.log && $._.$.log.error('Top error:' +
                                             myUtils.errToPrettyStr(err));
                /* eslint-disable */
                console.log('Top error:' + myUtils.errToPrettyStr(err));
                /* eslint-enable */
            } else {
                $._.$.log && $._.$.log.trace('Check OK:' +
                                             JSON.stringify(res));
            }
        };

        that.__ca_start__(notifyF);

        return [null, that];
    } catch (err) {
        /* eslint-disable */
        console.log('Got error:' + err);
        /* eslint-enable */
        return [err];
    }
};
