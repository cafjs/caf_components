'use strict';
/* eslint-disable  no-console */

exports.newInstance = async function($, spec) {
    var that = {
        hello() {
            console.log(spec.name + ':' + spec.env.msg);
        },
        __ca_checkup__(data, cb0) {
            cb0(null);
        },
        __ca_shutdown__(data, cb0) {
            cb0(null);
        }
    };
    return [null, that];
};
