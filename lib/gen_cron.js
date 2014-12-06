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
/**
 * Generic cron component.
 *
 * A cron is an active object that performs the same task every `interval`
 *  miliseconds.
 *
 * @name gen_cron
 * @namespace
 * @augments gen_component
 *
 */
var assert= require('assert');
var myUtils = require('./myUtils');

var genComponent = require('./gen_component');

/**
 * Constructor method for a generic cron component.
 *
 * @see gen_component
 */
exports.constructor = function($, spec) {

    $ = $ || {_ : {$ : {} }};

    var that = genComponent.constructor($, spec);

    assert.equal(typeof(spec.env.interval), 'number',
                 "'spec.env.interval' is not a number");

    var intervalId = null;

    /**
     * Run-time type information.
     *
     * @type {boolean}
     * @name gen_cron#__ca_isCron__
     */
    that.__ca_isCron__ = true;

    /**
     * Gets the time in miliseconds between tasks as defined in property
     * `env.interval`.
     *
     * @return The time in miliseconds between task
     *  invocations.
     *
     * @name gen_cron#__ca_getInterval__
     * @function
     */
    that.__ca_getInterval__ = function() {
        return spec.env.interval;
    };

    /**
     * Starts the cron.
     *
     * @param {function()} fun A task to be performed repeatedly.
     *
     *
     * @name gen_cron#__ca_start__
     * @function
     */
    that.__ca_start__ = function(fun) {
        var fun1 = function() {
            try {
                fun();
            } catch(err) {
                console.log('Exception in CRON'+ spec.name +
                            myUtils.errToPrettyStr(err));
                $._.$.log && $._.$.log.warn('Exception in cron '  + spec.name +
                                            myUtils.errToPrettyStr(err));
            }
        };
        intervalId = setInterval(fun1, that.__ca_getInterval__());
    };

    /**
     * Finishes the execution of periodic tasks.
     *
     * Shutting down a cron always stops it.
     *
     * @name gen_cron#__ca_stop__
     * @function
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
