/*!
Copyright 2013 Hewlett-Packard Development Company, L.P.

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
 * Proxy to access the system logger from application code.
 *
 * @module caf_components/proxy_log
 * @augments module:caf_components/gen_proxy
 */
// @ts-ignore: augments not attached to a class
const genProxy = require('./gen_proxy');

/**
 * Factory method to create a proxy to a logger service.
 *
 * @param {ctxType} $ A context containing references to other components.
 * @param {specType} spec Configuration data for this component.
 *
 * @return {Promise<Array.<any>>} A tuple array returning an optional `Error`
 * in the first argument, or the new component in the second.
 */
exports.newInstance = async function($, spec) {

    try {
        const that = genProxy.constructor($, spec);

        /**
         * Checks if a candidate level would log with current settings.
         *
         * @param {string} candidateLevel A candidate level.
         * @return {boolean} True if that level is logged.
         *
         * @memberof! module:caf_components/proxy_log#
         * @alias isActive
         */
        that.isActive = function(candidateLevel) {
            return $._.isActive(candidateLevel);
        };

        /**
         * Logs msg at FATAL level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/proxy_log#
         * @alias fatal
         */
        that.fatal = function(msg) {
            $._.fatal(msg);
        };

        /**
         * Logs msg at ERROR level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/proxy_log#
         * @alias error
         */
        that.error = function(msg) {
            $._.error(msg);
        };

        /**
         * Logs msg at WARN level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/proxy_log#
         * @alias warn
         */
        that.warn = function(msg) {
            $._.warn(msg);
        };

        /**
         * Logs msg at INFO level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/proxy_log#
         * @alias info
         *
         */
        that.info = function(msg) {
            $._.info(msg);
        };

        /**
         * Logs msg at DEBUG level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/proxy_log#
         * @alias debug
         */
        that.debug = function(msg) {
            $._.debug(msg);
        };

        /**
         * Logs msg at TRACE level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/proxy_log#
         * @alias trace
         */
        that.trace = function(msg) {
            $._.trace(msg);
        };

        Object.freeze(that);
        return [null, that];
    } catch (err) {
        return [err];
    }
};
