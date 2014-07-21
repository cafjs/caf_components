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
 * @name supervisor
 * @namespace
 * @augments gen_container
 */

var genContainer = require('./gen_container');
var genCron = require('./gen_cron');
var myUtils = require('./myUtils');

var TIME_BEFORE_DYING = 1000;


/**
 * Factory method to create a top level supervisor.
 *
 *
 */
exports.newInstance = function($, spec, cb) {
    try {
        var counter = 0;
        var cbHealthAll = {};

        var that = genContainer.constructor($, spec);
        var cronSpec = {env: {interval: spec.env.interval}};
        var cron = genCron.constructor(null, cronSpec);

        that.__ca_register__ = function(cbHealth) {
            var name = 'cbHealth__' + counter;
            counter = counter + 1;
            cbHealthAll[name]= cbHealth;
            return name;
        };

        that.__ca_unregister__ = function(name) {
            delete cbHealthAll[name];
        };

        var notifyAll = function (err, res) {
            cbHealthAll.forEach(function(f) {
                                    var resF = function() {
                                        f(err, res);
                                    };
                                    process.nextTick(resF);
                                });
        };

        var die = function(msg) {
            var error = new Error(msg);
            notifyAll(error);
            // leave enough time for console.log
            setTimeout(function() {
                           process.exit(1);
                       }, TIME_BEFORE_DYING);
        };

        var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb) {
            that.__ca_isShutdown__ = true; // block checkup() creating children
            async.series([
                             function(cb1) {
                                 cron.__ca_shutdown__(data, cb1);
                             }
                         ], function(err, res) {
                             if (err) {
                                 die('Error shutting down cron' +
                                     myUtils.errToStr(err));
                             } else {
                                 super__ca_shutdown__(data, cb);
                             }
                         });

        };

        var pending = false;
        cron.__ca__start__(function() {
                               var data = {};
                               var cb1 = function(err, res) {
                                   pending = false;
                                   notifyAll(err, res);
                               };
                               if (pending) {
                                   //checkup hanged, just die...
                                   die('Hang in checkup');
                               } else {
                                   pending = true;
                                   that.__ca_checkup__(data, cb1);
                               }
                           });

        cb(null, that);
    } catch(err) {
        cb(err);
    }
};
