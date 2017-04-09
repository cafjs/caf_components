'use strict';
/* eslint-disable  no-console */

exports.newInstance = function($, spec, cb) {
    $.log.debug('Initializing hello');
    console.log(spec.env.somethingElse.goo);
    cb(null, {
        hello: function() {
            console.log(spec.name + ':' + spec.env.msg);
        },
        __ca_checkup__: function(data, cb0) {
            cb0(null);
        },
        __ca_shutdown__: function(data, cb0) {
            cb0(null);
        }
    });
};