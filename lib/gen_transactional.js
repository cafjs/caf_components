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
"use strict";
/**
 * A transactional plug provides ACID guarantees to its internal state.
 *
 * It is recommended that plugs that keep state across message invocations
 * should be made transactional.
 *
 * In CAF transactional plugs participate in a two-phase commit protocol with
 *  other local transactional plugs.
 *
 * @name gen_transactional
 * @namespace
 * @augments gen_container
 */
var genContainer = require('./gen_container');
var async = require('async');

/**
 * Constructor method for a generic transactional plug.
 *
 * @see gen_component
 *
 */
exports.constructor = function($, spec) {

    var that = genContainer.constructor($, spec);

    var logActions = [];

    var logActionsTarget = that;

    var childrenSpec = that.__ca_getChildrenSpec__();

    var transChildrenObj = null;

    var applyFun = function(method, args) {
        return function(x, cb0) {
            try {
                var argsAll = (args || []).concat([cb0]);
                x.obj[method].apply(x.obj, argsAll);
            } catch (err) {
                cb0(err);
            }
        };
    };


    var childrenSeriesTransF = function(f, cb) {
        var findTrans = function() {
            var result = {};
            childrenSpec.forEach(function(x) {
                if (!that.$[x.name]) {
                    throw new Error('Missing child ' + x.name);
                } else if (that.$[x.name].__ca_isTransactional__) {
                    result[x.name] = x;
                }
            });
            return result;
        };
        transChildrenObj = findTrans(); // throw if any child missing
        var transSpec = childrenSpec
            .filter(function(x) { return transChildrenObj[x.name];});
        var transComp = [];
        transSpec.forEach(function(x) {
            var obj = that.$[x.name];
            if (obj) {
                transComp.push({obj: obj, name: x.name});
            }
        });
        async.mapSeries(transComp, f, function(err, res) {
            if (err) {
                cb(err, res);
            } else {
                var result = {};
                transComp.forEach(function(x, i) {
                    result[x.name] = res[i];
                });
                cb(err, result);
            }
        });
    };


    /**
     * Run-time type information.
     *
     * @type {boolean}
     * @name gen_transactional#__ca_isTransactional__
     */
    that.__ca_isTransactional__ = true;

    var replayLog = function(cb) {
        async.eachSeries(logActions, function(x, cb0) {
            try {
                var args = (x.args && x.args.slice(0) || []);
                args.push(cb0);
                logActionsTarget[x.method].apply(logActionsTarget, args);
            } catch (ex) {
                ex.method = x.method;
                ex.args = x.args;
                cb0(ex);
            }
        }, function(err, data) {
            if (err) {
                cb(err);
            } else {
                logActions = [];
                cb(err, data);
            }
        });
    };

    /**
     * Sets a receiver for all the delayed methods.
     *
     * @param {Object} obj A receiver for delayed methods.
     * @name gen_transactional#__ca_setLogActionsTarget__
     * @function
     */
    that.__ca_setLogActionsTarget__ = function(obj) {
        logActionsTarget = obj;
    };

    /**
     * Queues an operation to be executed at commit time. Operations are
     *  asynchronous, with a callback internally provided.
     *
     * @param {string} method A method name to execute.
     * @param {Array.<Any>}  args An array of method arguments without
     *  including the final callback.
     *
     * @name gen_transactional#__ca_lazyApply__
     * @function
     */
    that.__ca_lazyApply__ = function(method, args) {
        logActions.push({method: method, args: args});
    };


    /**
     * Initializes the state of this plug from scratch.
     *
     * This method is called by CAF only once, i.e.,  when the plug is created.
     *
     * The default implementation does nothing.
     *
     * @param {caf.cb} cb A callback to continue after initialization.
     *
     * @name gen_transactional#__ca_init__
     * @function
     */
    that.__ca_init__ = function(cb) {
        try {
            logActions = [];
            childrenSeriesTransF(applyFun('__ca_init__', []), cb);
        } catch (err) {
            cb(err);
        }
    };

    /**
     * Initializes the state of this plug from a previous checkpoint.
     *
     * This method can be called by CAF many times, for example, after
     * recovering  from a failure or to enable migration.
     *
     * @param {Object} cp The last checkpoint of the state of this plug.
     * @param {caf.cb} cb A callback to continue after resuming.
     *
     * @name gen_transactional#__ca_resume__
     * @function
     */
    that.__ca_resume__ = function(cp, cb) {
        try {
            var cb0 = function(err, data) {
                if (err) {
                    cb(err, data);
                } else {
                    logActions = cp.logActions || [];
                    replayLog(cb);
                }
            };
            childrenSeriesTransF(function(x, cb1) {
                                     x.obj.__ca_resume__(cp[x.name], cb1);
                                 }, cb0);
        } catch (err) {
            cb(err);
        }
    };

    /**
     * Begins a two phase commit transaction.
     *
     * CAF calls this method before the application handler processes
     * a message. A read-only copy of the message is passed as an argument
     * to facilitate configuration.
     *
     * @param {Object} msg The message to be processed.
     * @param {caf.cb} cb A callback to continue the transaction.
     *
     * @name gen_transactional#__ca_begin__
     * @function
     *
     */
    that.__ca_begin__ = function(msg, cb) {
        try {
            logActions = [];
            childrenSeriesTransF(applyFun('__ca_begin__', [msg]), cb);
        } catch (err) {
            cb(err);
        }
    };

    /**
     * Prepares to commit the transaction.
     *
     * CAF calls this method after the handler has succesfully
     * processed the message.
     *
     * If ready to commit, it returns in the callback a JSON
     * serializable data structure reflecting the new state after
     * processing the message.
     *
     * To abort the transaction we return an error in the (node.js) callback.
     * This will abort all the transactional plugs associated with the CA.
     *
     * @param {caf.cb} cb A callback to continue or abort the transaction.
     *
     * @name gen_transactional#__ca_prepare__
     * @function
     */
    that.__ca_prepare__ = function(cb) {
        try {
            var cb0 = function(err, data) {
                if (err) {
                    cb(err, data);
                } else {
                    data.logActions = logActions;
                    cb(err, data);
                }
            };
            childrenSeriesTransF(applyFun('__ca_prepare__', []), cb0);
        } catch (err) {
            cb(err);
        }
    };

    /**
     * Commits the transaction.
     *
     * Called by CAF when all the`prepare` calls to transactional
     * plugs were
     * successful, and the new state  of those plugs has been
     * checkpointed using an external service (e.g., Redis).
     *
     * An error during commit shutdowns the CA since we cannot abort
     * committed transactions. When the
     * shutdown CA gets recreated, possibly in a different server, all
     * the commit operations are retried. It is the responsability of
     * the plug implementation to make commit operations idempotent.
     *
     *
     * @param {caf.cb} cb A callback to continue after commiting.
     *
     * @name gen_transactional#__ca_commit__
     * @function
     */
    that.__ca_commit__ = function(cb) {
        try {
            var cb0  = function(err, data) {
                if (err) {
                    cb(err, data);
                } else {
                    replayLog(cb);
                }
            };
            childrenSeriesTransF(applyFun('__ca_commit__', []), cb0);
        } catch (err) {
            cb(err);
        }
    };

    /**
     * Aborts the transaction.
     *
     * CAF calls this method when an error was returned
     * by the handler, or any transactional plug did not 'prepare'
     * OK.
     *
     * Note that an error during (remote) checkpointing cannot
     * guarantee that the checkpoint was not made durable, and we need to
     * assume that it did; this means that we need to shutdown the CA.
     *
     * An implementation of this method should undo state changes and
     * ignore deferred  external interactions.
     *
     * @param {caf.cb} cb A callback to continue after aborting.
     *
     * @name gen_transactional#__ca_abort__
     * @function
     */
    that.__ca_abort__ = function(cb) {
        try {
            logActions = [];
            childrenSeriesTransF(applyFun('__ca_abort__', []), cb);
        } catch (err) {
            cb(err);
        }
    };

    return that;
};
