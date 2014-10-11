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
 * Default implementation of a supervisor.
 *
 * @name supervisor
 * @namespace
 * @augments gen_supervisor
 */

var gen_sup =  require('./gen_supervisor');;

/**
 * Factory method to create a supervisor component.
 *
 * @see supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = gen_sup.constructor($, spec);

        var notifyF = function(err, res) {
            if (err) {
                console.log('Fatal error:' + err);
            } else {
                //console.log('Check OK:' + JSON.stringify(res));
            }
        };

        that.__ca_start__(notifyF);
        cb(null, that);
    } catch (err) {
        console.log('got err' + err);
        cb(err);
    }
};
