var caf_comp = require('../../index');

var genComponent =  caf_comp.gen_component;
var util = require('util');

/**
 * Factory method to create a test component.
 *
 * @see supervisor
 */
exports.newInstance = async function($, spec) {
    var that = genComponent.create($, spec);

    Object.assign(that, {
        getMessage()  {
            return spec.env.message;
        },

        getOtherMessage() {
            return spec.env.otherMessage || "";
        },

        getNumber() {
            return spec.env.number;
        },

        getLanguage() {
            return spec.env.language;
        },

        getSpecEnv() {
            return spec.env;
        }
    });

    var setTimeoutPromise = util.promisify(setTimeout);
    console.log('starting');
    await setTimeoutPromise(5000);
    console.log('ending');

    return [null, that];
};
