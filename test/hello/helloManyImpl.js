var caf_comp = require('../../index');

var genContainer =  caf_comp.gen_container;

/**
 * Factory method to create a test component.
 *
 * @see supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genContainer.constructor($, spec);
        that.getMessage = function() {
            return spec.env.message;
        };
        that.getNumber = function() {
            return spec.env.number;
        };

        that.getLanguage = function() {
            return spec.env.language;
        };
        cb(null, that);
    } catch (err) {
        console.log('got err' + err);
        cb(err);
    }
};
