var caf_comp = require('../../index');

var genPlugCA =  caf_comp.gen_plug_ca;

/**
 * Factory method to create a test plug CA.
 *
 * @see supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genPlugCA.create($, spec);
        that.getMessage = function() {
            return $._.$.plug.getMessage();
        };
        that.getNumber = function() {
            return $._.$.plug.getNumber();
        };
        that.getLanguage = function() {
            return $._.$.plug.getLanguage();
        };
        cb(null, that);
    } catch (err) {
        console.log('got err' + err);
        cb(err);
    }
};
