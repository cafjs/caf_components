// Modifications copyright 2020 Caf.js Labs and contributors
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
 * A transactional plug to manage internal state safely.
 *
 * CAF goal is to create and manage billions of long running, active, stateful
 * proxies, i.e., CAs, where "long running" means years. In order to tolerate
 *  -without human intervention- failures, upgrades, migration, or other errors,
 * the CA state has to be managed carefully.
 *
 * A complication is that CA state is not only application state, but state
 * associated with the plugins that the application uses.
 *
 * Also, CAF always ensures that CA state is consistent with
 * the externalized view of that state, i.e., CA actions that affect the
 * external world.
 *
 * For example, if a CA sends a message, and it keeps track of
 * sent messages in its internal state, even in the presence of failures
 * it should never forget that it sent that message.
 *
 * CAF approach assumes:
 *
 * 1. Operations that affect the external world are mediated by a
 *  plugin that makes them idempotent.
 *
 * 2. Plugins defer these operations until commit time, ensuring that, before
 *  execution, a persistent record of them has been checkpointed to an external
 *  service.
 *
 * 3. All plugins and application code coordinate using a two-phase commit
 * protocol, so that disaggregated state is managed consistently.
 *
 * 4. During recovery the last committed state is reloaded, and deferred
 * operations in the checkpoint are retried until they succeed.
 *
 * Methods `__ca_setLogActionsTarget__` and  `__ca_lazyApply__` defer methods.
 *
 * Methods `__ca_init__` and  `__ca_resume__` handle initialization and
 * recovery.
 *
 * Methods `__ca_begin__`,  `__ca_prepare__`, `__ca_commit__` and `__ca_abort__`
 * implement the two-phase commit protocol.
 *
 * Variable `that.state` is a JSON-serializable representation of this plugin
 * state. The contents of this variable are always checkpointed before
 * any state externalization, unless it is `null`.
 *
 * @module caf_components/gen_transactional
 * @augments module:caf_components/gen_container
 */
// @ts-ignore: augments not attached to a class
const genContainer = require('./gen_container');
const myUtils = require('./myUtils');
const async = require('async');

/**
 * Helper constructor method for a transactional component.
 *
 * Description of types in file `types.js`.
 *
 * @param {ctxType} $ A context containing references to other components.
 * @param {specType} spec Configuration data for this component.
 * @return {Object} A new generic component.
 *
 * @throws {Error} If inputs are invalid.
 */
exports.create = function($, spec) {

    const that = genContainer.create($, spec);

    /**
     * JSON-serializable representation of a plugin private state.
     *
     * The contents of this variable are always checkpointed before
     * any state externalization, unless it is `null`.
     *
     *
     * @type {Object}
     * @memberof! module:caf_ca/gen_transactional#
     * @alias state
     */
    that.state = null;

    /*
     * Backup state to provide transactional behavior for the handler.
     *
     */
    var stateBackup = '';

    var logActions = [];

    var logActionsTarget = that;

    const childrenSpec = that.__ca_getChildrenSpec__();

    var transChildrenObj = null;

    const applyFun = function(method, args) {
        return function(x, cb0) {
            try {
                const argsAll = (args || []).concat([cb0]);
                const wrappedMethod = myUtils.wrapAsyncFunction(x.obj[method],
                                                                x.obj);
                wrappedMethod.apply(x.obj, argsAll);
            } catch (err) {
                cb0(err);
            }
        };
    };


    const childrenSeriesTransF = function(f, cb) {
        const findTrans = function() {
            const result = {};
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
        const transSpec = childrenSpec.filter(function(x) {
            return transChildrenObj[x.name];
        });
        const transComp = [];
        transSpec.forEach(function(x) {
            const obj = that.$[x.name];
            if (obj) {
                transComp.push({obj: obj, name: x.name});
            }
        });
        async.mapSeries(transComp, f, function(err, res) {
            if (err) {
                cb(err, res);
            } else {
                const result = {};
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
     * @memberof! module:caf_components/gen_transactional#
     * @alias __ca_isTransactional__
     */
    that.__ca_isTransactional__ = true;

    const replayLog = function(cb) {
        async.eachSeries(logActions, function(x, cb0) {
            try {
                const args = (x.args && x.args.slice(0) || []);
                args.push(cb0);
                const wrappedMethod = myUtils.wrapAsyncFunction(
                    logActionsTarget[x.method],
                    logActionsTarget
                );
                wrappedMethod.apply(logActionsTarget, args);
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
     * Sets a receiver object implementing all the delayed methods.
     *
     * @param {Object} obj A receiver for delayed methods.
     *
     * @memberof! module:caf_components/gen_transactional#
     * @alias __ca_setLogActionsTarget__
     */
    that.__ca_setLogActionsTarget__ = function(obj) {
        logActionsTarget = obj;
    };

    /**
     * Queues an operation to be executed at commit time.
     *
     * Internally, operations are made asynchronous and executed serially by
     * adding an extra callback. The actual implementation of these operations
     * is delegated to the `logActionsTarget` object.
     *
     * Operations are assumed to be idempotent.
     *
     * @param {string} method A method name to execute.
     * @param {Array.<any>}  args An array of method arguments.
     *
     *
     * @memberof! module:caf_components/gen_transactional#
     * @alias __ca_lazyApply__
     */
    that.__ca_lazyApply__ = function(method, args) {
        logActions.push({method: method, args: args});
    };


    /**
     * Initializes the state of this plug from scratch.
     *
     * This method is called only once, when the plug is created.
     *
     * @param {cbType} cb A callback to continue after initialization.
     *
     * @memberof! module:caf_components/gen_transactional#
     * @alias __ca_init__
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
     * Reloads the state of this plug from a previous checkpoint.
     *
     * It also retries deferred operations in the checkpoint.
     *
     * This method is called many times, for example, after
     * recovering  from a failure or restarting after migration.
     *
     * @param {Object} cp The last checkpoint of the state of this plug.
     * @param {cbType} cb A callback to continue after resuming.
     *
     * @memberof! module:caf_components/gen_transactional#
     * @alias __ca_resume__
     */
    that.__ca_resume__ = function(cp, cb) {
        try {
            const cb0 = function(err, data) {
                if (err) {
                    cb(err, data);
                } else {
                    that.state = cp.state || that.state;
                    logActions = cp.logActions || [];
                    replayLog(cb);
                }
            };
            childrenSeriesTransF(function(x, cb1) {
                try {
                    const wrappedMethod = myUtils.wrapAsyncFunction(
                        x.obj.__ca_resume__,
                        x.obj
                    );
                    wrappedMethod.apply(x.obj, [cp[x.name], cb1]);
                } catch (err) {
                    cb1(err);
                }
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
     * @param {cbType} cb A callback to continue the transaction.
     *
     * @memberof! module:caf_components/gen_transactional#
     * @alias __ca_begin__
     *
     */
    that.__ca_begin__ = function(msg, cb) {
        try {
            if (that.state) {
                stateBackup = JSON.stringify(that.state);
            }
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
     * Then, CAF checkpoints this data structure using a remote service.
     *
     * To abort the transaction we return an error in the (node.js) callback.
     * This will abort all the transactional plugs associated with the CA.
     *
     * @param {cbType} cb A callback to continue or abort the transaction.
     *
     * @memberof! module:caf_components/gen_transactional#
     * @alias __ca_prepare__
     */
    that.__ca_prepare__ = function(cb) {
        try {
            const cb0 = function(err, data) {
                if (err) {
                    cb(err, data);
                } else {
                    if (that.state) {
                        data.state = that.state;
                    }
                    if (logActions.length > 0) {
                        data.logActions = logActions;
                    }
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
     * Called by CAF when all the `prepare` calls to transactional
     * plugs were successful, and the new state of those plugs has been
     * checkpointed using an external service.
     *
     * An error during commit will shutdown the CA since we cannot abort
     * committed transactions. See `__ca_resume__` for the recovery strategy.
     *
     * @param {cbType} cb A callback to continue after commiting.
     *
     * @memberof! module:caf_components/gen_transactional#
     * @alias __ca_commit__
     */
    that.__ca_commit__ = function(cb) {
        try {
            const cb0 = function(err, data) {
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
     * by the handler, or any transactional plugs propagated an error during
     *  `prepare`.
     *
     * Note that an error during remote checkpointing cannot
     * guarantee that the checkpoint was not made durable, and we need to
     * assume that it did. This means that we need to shutdown the CA.
     *
     * An implementation of this method should undo state changes and
     * ignore deferred operations.
     *
     * @param {cbType} cb A callback to continue after aborting.
     *
     * @memberof! module:caf_components/gen_transactional#
     * @alias __ca_abort__
     */
    that.__ca_abort__ = function(cb) {
        try {
            if (that.state && stateBackup) {
                that.state = JSON.parse(stateBackup);
            }
            logActions = [];
            childrenSeriesTransF(applyFun('__ca_abort__', []), cb);
        } catch (err) {
            cb(err);
        }
    };

    return that;
};
