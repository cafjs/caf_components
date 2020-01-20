var caf_comp = require('../../index');

var gen_sup =  caf_comp.gen_supervisor;

/**
 * Factory method to create a test component.
 *
 * @see supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = gen_sup.create($, spec);
        var count = 0;

        var notifyF = function(err, res) {
            if (err) {
                console.log('Fatal error:' + err);
            } else {
                //console.log('Check OK:' + JSON.stringify(res));
            }
        };

        that.newFault = function() {
            count = count + 1;
        };

        that.stillFaulty = function() {
//            console.log("StillFaulty count:" + count + " maxFailures:" +
//                        spec.env.numFailures);
            return (count < spec.env.numFailures);
        };

        that.__ca_start__(notifyF);
        cb(null, that);
    } catch (err) {
        console.log('got err' + err);
        cb(err);
    }
};
