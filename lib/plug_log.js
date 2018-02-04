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
 * A logger component.
 *
 * Properties:
 *
 *        {logLevel: string}
 *
 * where `logLevel` sets the threshold for logging as one of
 * `OFF`, `FATAL`, `ERROR`, `WARN`, `INFO`, `DEBUG` and `TRACE` (in that order)
 *
 * @module caf_components/plug_log
 * @augments module:caf_components/gen_plug
 *
 */
// @ts-ignore: augments not attached to a class
var assert = require('assert');

var genPlug = require('./gen_plug');

/**
 * Factory method to create a log plug component.
 *
 * @param {ctxType} $ A context containing references to other components.
 * @param {specType} spec Configuration data for this component.
 * @param {cbType} cb A standard node.js callback returning an error or the
 * new component.
 */
exports.newInstance = function($, spec, cb) {

    try {

        var levels = {
            'OFF': -1, 'FATAL': 0, 'ERROR': 1, 'WARN': 2, 'INFO': 3, 'DEBUG': 4,
            'TRACE': 5
        };

        var levelNames = [
            'OFF', 'FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'
        ];

        var that = genPlug.constructor($, spec);

        assert.equal(typeof(spec.env.logLevel), 'string',
                     "'logLevel' is not an string");
        var currentLevel = levels[spec.env.logLevel];
        assert.equal(typeof(currentLevel), 'number',
                     "'currentLevel' is not a number");

        /**
         * Sets the threshold for logging events.
         *
         * @param {string} newLogLevel A new logging level.
         * @return {string} The previous logging level.
         *
         * @memberof! module:caf_components/plug_log#
         * @alias setLevel
         *
         */
        that.setLevel = function(newLogLevel) {
            assert.equal(typeof(newLogLevel), 'string',
                     "'newLogLevel' is not a string");
            var newLevel = levels[newLogLevel];
            assert.equal(typeof(newLevel), 'number',
                         "'newLevel' is not a number");
            var oldLevel = currentLevel;
            currentLevel = newLevel;
            return levelNames[oldLevel+1];
        };

        /**
         * Gets the current  threshold for logging events.
         *
         * @return {string} The current  threshold for logging events.
         *
         * @memberof! module:caf_components/plug_log#
         * @alias currentLevel
         */
        that.currentLevel = function() {
            return levelNames[currentLevel+1];
        };

        /**
         * Checks if a candidate level would log with current settings.
         *
         * @param {string} candidateLevel A candidate level.
         * @return {boolean} True if that level is logged.
         *
         * @memberof! module:caf_components/plug_log#
         * @alias isActive
         *
         */
        that.isActive = function(candidateLevel) {
            var candidate = (candidateLevel && levels[candidateLevel]);
            assert.equal(typeof(candidate), 'number',
                         "'candidate' is not a number");
            return (candidate <= currentLevel);
        };


        var log = function(level, msg) {
            /* eslint-disable */
            (level <= currentLevel) && console.log(msg);
            /* eslint-enable */
        };

        /**
         * Logs msg at FATAL level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_log#
         * @alias fatal
         *
         */
        that.fatal = function(msg) {
            log(0, msg);
        };

        /**
         * Logs msg at ERROR level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_log#
         * @alias error
         *
         */
        that.error = function(msg) {
            log(1, msg);
        };

        /**
         * Logs msg at WARN level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_log#
         * @alias warn
         *
         */
        that.warn = function(msg) {
            log(2, msg);
        };

        /**
         * Logs msg at INFO level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_log#
         * @alias info
         *
         */
        that.info = function(msg) {
            log(3, msg);
        };

        /**
         * Logs msg at DEBUG level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_log#
         * @alias debug
         *
         */
        that.debug = function(msg) {
            log(4, msg);
        };

        /**
         * Logs msg at TRACE level.
         *
         * @param  {string} msg A message to be logged.
         *
         * @memberof! module:caf_components/plug_log#
         * @alias trace
         *
         */
        that.trace = function(msg) {
            log(5, msg);
        };

        that.debug('New logger plug');
        // loader is created first but needs to log messages
        $._.$.loader && $._.$.loader.__ca_registerLogger__(that);

        cb(null, that);

    } catch (err) {
        cb(err);
    }
};
