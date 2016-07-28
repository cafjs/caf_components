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

    assert.equal(typeof(spec.env.maxHangRetries), 'number',
                 "'spec.env.maxHangRetries' is not a number");
    var maxHangRetries = spec.env.maxHangRetries;

    var that = genContainer.constructor($, spec);

    var die = function(msg, cb) {
        var debugError = new Error('Dying');
        debugError.msg = msg;
        $._.$.log && $._.$.log.fatal('Platform Dying: ' +
                                     myUtils.errToPrettyStr(debugError));
        if (dieDelay >=0) {
            // leave enough time for console.log and shutdown
            setTimeout(function() {
                process.exit(1);
            }, dieDelay);
        }
        that.__ca_shutdown__(null, function(err) {
            var error = new Error(msg);
            if (err) {
                error.shutdownError = err;
            }
            cb(error);
        });
    };


    /**
     * Starts the supervisor.
     *
     * Passing an optional callback 'cb' forces an initial checkup
     * that guarantees the whole hierarchy is active after 'cb' is called.
     * In case of an error the cron is not started, delegating
     * error handling to the caller.
     *
     * Otherwise, internal components are lazily instantiated as part of the
     * periodic checkups. The optional 'notifyF' is used to inform of errors
     * or progress for each checkup.
     *
     *
     * @param {caf.cb=} notifyF An optional  task to inform of the status
     * of each health check.
     * @param {caf.cb=} cb An optional callback invoked once after the first
     * initialization attempt.
     *
     * @name gen_supervisor#__ca_start__
     * @function
     */
    that.__ca_start__ = function(notifyF, cb) {
        var pending = false;
        var numRetries = 0;
        var f = function(cb1) {
            var data = {};
            async.series([
                function(cb0) {
                    if (pending) {
                        if (numRetries <= maxHangRetries) {
                            numRetries++;
                            var err = new Error('Hang, retrying');
                            err.checkingForHang = true;
                            cb0(err);
                        } else {
                            die('Hang in checkup', cb0);
                        }
                    } else {
                        pending = true;
                        that.__ca_checkup__(data, cb0);
                    }
                }
            ], function (err, res) {
                var resOne = Array.isArray(res) ? res[0] : res;
                if (err && err.checkingForHang) {
                    $._.$.log &&
                        $._.$.log.trace('Checking hang:' +
                                        myUtils
                                        .errToPrettyStr(err));
                } else {
                    numRetries = 0;
                    pending = false;
                }
                if (cb1) {
                    cb1(err, resOne);
                } else if (notifyF) {
                    notifyF(err, resOne);
                }
            });
        };
        if (cb) {
            f(function(err, data) {
                if (!err) {
                    cron.__ca_start__(f);
                }
                cb(err, data);
            });
        } else {
            cron.__ca_start__(f);
        }
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


    var super__ca_checkup__ = myUtils.superior(that, '__ca_checkup__');
    that.__ca_checkup__ = function(data, cb) {
        super__ca_checkup__(data, function(err, res) {
            if (err) {
                die('Unrecoverable checkup:' +
                    myUtils.errToPrettyStr(err), cb);
            } else {
                cb(err, res);
            }
        });
    };

    var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
    that.__ca_shutdown__ = function(data, cb) {
        var cb1 = function(err) {
            if (err) {
                die('Error shutting down cron' +
                    myUtils.errToPrettyStr(err), cb);
            } else {
                $._.$.log && $._.$.log.debug('Shutting down supervisor ' +
                                             spec.name);
                super__ca_shutdown__(data, cb);
            }
        };
        that.__ca_isShutdown__ = true; // block checkup() creating children
        that.__ca_stop__();
        cron.__ca_shutdown__(data, cb1);
    };

    return that;
};
