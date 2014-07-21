var caf_comp = require('../../index');

var genComponent =  caf_comp.gen_component;


/**
 * Factory method to create a logger component.
 *
 * @see supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {

        console.log("www");
        console.log($);
        var that = genComponent.constructor($, spec);

        that.getMessage = function() {
            return spec.env.message;
        };
        console.log(that);
        cb(null, that);
    } catch (err) {
        console.log('got err' + err);
        cb(err);
    }
};
