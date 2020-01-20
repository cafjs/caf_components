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
 * A plug object that manages the log for a CA.
 *
 * @module caf_components/plug_ca_log
 * @augments module:caf_components/gen_plug_ca
 *
 */
// @ts-ignore: augments not attached to a class
const genPlugCA = require('./gen_plug_ca');

/**
 * Factory method to create a log plug CA component.
 *
 * @param {ctxType} $ A context containing references to other components.
 * @param {specType} spec Configuration data for this component.
 *
 * @return {Promise<Array.<any>>} A tuple array returning an optional `Error`
 *  in the first argument, or the new component in the second.
 */
exports.newInstance = async function($, spec) {
    try {
        const that = genPlugCA.create($, spec);
        const log = $._.$.log;
        const name = ($.ca && $.ca.__ca_getName__()) || spec.name;
        const prefix = '<<' + name + '>>';

        log && log.debug(prefix + 'New Log Manager plug');

        /*
         * Checks if a candidate level would log with current settings.
         *
         * @param {string} candidateLevel A candidate level.
         * @return {boolean} True if that level is logged.
         *
         * @memberof! module:caf_components/plug_ca_log#
         * @alias isActive
         */
        that.isActive = function(candidateLevel) {
            return log && log.isActive(candidateLevel);
        };

        /*
         * Logs msg at FATAL level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_ca_log#
         * @alias fatal
         */
        that.fatal = function(msg) {
            log && log.fatal(prefix + msg);
        };

        /*
         * Logs msg at ERROR level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_ca_log#
         * @alias error
         */
        that.error = function(msg) {
            log && log.error(prefix + msg);
        };

        /*
         * Logs msg at WARN level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_ca_log#
         * @alias warn
         */
        that.warn = function(msg) {
            log && log.warn(prefix + msg);
        };

        /*
         * Logs msg at INFO level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_ca_log#
         * @alias info
         */
        that.info = function(msg) {
            log && log.info(prefix + msg);
        };

        /*
         * Logs msg at DEBUG level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_ca_log#
         * @alias debug
         */
        that.debug = function(msg) {
            log && log.debug(prefix + msg);
        };

        /*
         * Logs msg at TRACE level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_ca_log#
         * @alias trace
         */
        that.trace = function(msg) {
            log && log.trace(prefix + msg);
        };

        return [null, that];
    } catch (err) {
        return [err];
    }
};
