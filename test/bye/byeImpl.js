var caf_comp = require('../../index');

var genComponent =  caf_comp.gen_component;


/**
 * Factory method to create a test component.
 *
 * @see supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {

        var that = genComponent.create($, spec);

        that.getMessage = function() {
            return 'BYE:' + spec.env.message;
        };

        that.getOtherMessage = function() {
            return spec.env.otherMessage || "";
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
