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
 * Generic cron component.
 *
 * A cron is an active object that performs the same task every `interval`
 *  miliseconds.
 *
 * @module caf_components/gen_cron
 * @augments module:caf_components/gen_component
 *
 */
var assert= require('assert');
var myUtils = require('./myUtils');

var genComponent = require('./gen_component');

exports.constructor = function($, spec) {

    $ = $ || {_: {$: {} }};

    var that = genComponent.constructor($, spec);

    assert.equal(typeof(spec.env.interval), 'number',
                 "'spec.env.interval' is not a number");

    var intervalId = null;

    /**
     * Run-time type information.
     *
     * @type {boolean}
     * @memberof! module:caf_components/gen_cron#
     * @alias __ca_isCron__
     */
    that.__ca_isCron__ = true;

    /**
     * Gets time in miliseconds between task invocations.
     *
     * @return {number} Time in miliseconds between task invocations.
     *
     * @memberof! module:caf_components/gen_cron#
     * @alias __ca_getInterval__
     */
    that.__ca_getInterval__ = function() {
        return spec.env.interval;
    };

    /**
     * Starts the cron.
     *
     * @param {function()} fun A task to be performed repeatedly. Its type is
     * `function()`.
     *
     * @memberof! module:caf_components/gen_cron#
     * @alias __ca_start__
     */
    that.__ca_start__ = function(fun) {
        var fun1 = function() {
            try {
                fun();
            } catch (err) {
                $._.$.log && $._.$.log.warn('Exception in cron ' + spec.name +
                                            myUtils.errToPrettyStr(err));
            }
        };
        intervalId = setInterval(fun1, that.__ca_getInterval__());
    };

    /**
     * Stops executing periodic tasks.
     *
     * Shutting down a cron always stops it.
     *
     * @memberof! module:caf_components/gen_cron#
     * @alias __ca_stop__
     */
    that.__ca_stop__ = function() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    };

    var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
    that.__ca_shutdown__ = function(data, cb) {
        that.__ca_stop__();
        super__ca_shutdown__(data, cb);
    };

    return that;
};
