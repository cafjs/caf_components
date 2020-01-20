var caf_comp = require('../../index');

var genProxy =  caf_comp.gen_proxy;

/**
 * Factory method to create a test proxy.
 *
 * @see supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genProxy.create($, spec);
        that.getMessage = function() {
            return that.__ca_getCAName__() + ":" + $._.getMessage();
        };
        that.getNumber = function() {
            return $._.getNumber();
        };
        that.getLanguage = function() {
            return $._.getLanguage();
        };
        Object.freeze(that);
        cb(null, that);
    } catch (err) {
        console.log('got err' + err);
        cb(err);
    }
};
