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
 * Top-level supervisor of a hierarchy of components.
 *
 * @name gen_supervisor
 * @namespace
 * @augments gen_container
 */

var genContainer = require('./gen_container');
var genCron = require('./gen_cron');
var myUtils = require('./myUtils');
var assert = require('assert');
var async = require('async');

/**
 * Constructor method for a generic top level supervisor.
 *
 * @see gen_component
 *
 */
exports.constructor = function($, spec) {
    assert.equal(typeof(spec.env.interval), 'number',
                 "'spec.env.interval' is not a number");
    var cronSpec = {name: spec.name + '_cron__',
                    module: './gen_cron',
                    env: {interval: spec.env.interval}};
    var cron = genCron.constructor(null, cronSpec);

    assert.equal(typeof(spec.env.dieDelay), 'number',
                 "'spec.env.dieDelay' is not a number");
    var dieDelay = spec.env.dieDelay;
    var die = function(msg, cb) {
        if (dieDelay >=0) {
            // leave enough time for console.log
            setTimeout(function() {
                           process.exit(1);
                       }, dieDelay);
        };
        var error = new Error(msg);
        cb(error);
    };


    var that = genContainer.constructor($, spec);

    /**
     * Starts the supervisor.
     *
     * @param {caf.cb=} notifyF An optional  task to inform of the status
     * of each health check.
     *
     *
     * @name gen_supervisor#__ca_start__
     * @function
     */
    that.__ca_start__ = function(notifyF) {
        var pending = false;
        cron.__ca_start__(function() {
                              var data = {};
                              var cb1 = function(err, res) {
                                  pending = false;
                                  if (notifyF) {
                                      notifyF(err, res);
                                  }
                              };
                              if (pending) {
                                  //checkup hanged, just die...
                                  die('Hang in checkup', cb1);
                              } else {
                                  pending = true;
                                  that.__ca_checkup__(data, cb1);
                              }
                          });
    };

    /**
     * Finishes the execution of periodic health checks.
     *
     * Shutting down a supervisor always stops it.
     *
     * @name gen_supervisor#__ca_stop__
     * @function
     */
    that.__ca_stop__ = function() {
        cron.__ca_stop__();
    };

    var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
    that.__ca_shutdown__ = function(data, cb) {
        var cb1 = function(err, res) {
            if (err) {
                die('Error shutting down cron' +
                    myUtils.errToStr(err), cb);
            } else {
                super__ca_shutdown__(data, cb);
            }
        };
        that.__ca_isShutdown__ = true; // block checkup() creating children
        that.__ca_stop__();
        cron.__ca_shutdown__(data, cb1);
    };

    return that;
};
