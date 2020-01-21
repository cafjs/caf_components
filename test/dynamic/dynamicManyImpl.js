var caf_comp = require('../../index');

var genContainer =  caf_comp.gen_dynamic_container;
var myUtils = caf_comp.myUtils;

/**
 * Factory method to create a test component.
 *
 * @see supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genContainer.create($, spec);
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

        if (!spec.env.doNotDie) {
            setTimeout(function() {
                var dummyF = function() {
                    console.log("Dying " + uuid);
                };
                $._.newFault();
                if ($._.stillFaulty()) {
                    const f = myUtils.wrapAsyncFunction(that.__ca_shutdown__,
                                                        that);
                    f(null, dummyF);
                }
            }, time2Die);
        }
        cb(null, that);
    } catch (err) {
        console.log('got err' + err);
        cb(err);
    }
};
