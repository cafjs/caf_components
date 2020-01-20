var caf_comp = require('../../index');

var genTrans =  caf_comp.gen_transactional;


/**
 * Factory method to create a test component.
 *
 * @see supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {

        var that = genTrans.create($, spec);
        var message =  spec.env.message;
        var number = spec.env.number;
        var language = spec.env.language;

        var target = {
            setMessage: function(msg, cb0) {
                message = msg;
                cb0(null);
            },
            setNumber: function(n, cb0) {
                number = n;
                cb0(null);
            },
            setLanguage: function(lang, cb0) {
                language = lang;
                cb0(null);
            },
            die: function(cb0) {
                cb0(new Error());
            }
        };

        that.__ca_setLogActionsTarget__(target);

        that.getMessage = function() {
            return message;
        };

        that.getNumber = function() {
            return number;
        };

        that.getLanguage = function() {
            return language;
        };
        cb(null, that);
    } catch (err) {
        console.log('got err' + err);
        cb(err);
    }
};
