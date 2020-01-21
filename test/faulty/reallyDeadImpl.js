var caf_comp = require('../../index');

var genComponent =  caf_comp.gen_component;
var myUtils = caf_comp.myUtils;

/**
 * Factory method to create a test component.
 *
 * @see supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {

        var that = genComponent.create($, spec);
        var uuid = Math.floor(Math.random() *10000000000000000);

        var time2Die = Math.floor(Math.random() * spec.env.MTBF);

        that.getMessage = function() {
            return spec.env.message;
        };

        that.getNumber = function() {
            return spec.env.number;
        };


        that.getUUID = function() {
            return uuid;
        };
/*
        setTimeout(function() {
                       var dummyF = function() {
                           console.log("Dying " + uuid);
                       };
                       $._.newFault();
                       if ($._.stillFaulty()) {
                           that.__ca_shutdown__(null, dummyF);
                       }
                   }, time2Die);
*/
        var super__ca_checkup__ =  myUtils.superior(that, '__ca_checkup__');
        that.__ca_checkup__ = function(data, cb) {
            var cb1 = function(err, res) {
                super__ca_checkup__(err, cb);
            };
            const f = myUtils.wrapAsyncFunction(that.__ca_shutdown__, that);
            f(data, cb1);
        };

        cb(null, that);
    } catch (err) {
        console.log('got err' + err);
        cb(err);
    }
};
