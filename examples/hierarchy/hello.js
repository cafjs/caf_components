'use strict';
/* eslint-disable  no-console */

exports.newInstance = async function($, spec) {
    let isShutdown = false;

    $.log.debug('Initializing hello');

    const that = {
        hello() {
            !isShutdown && $.log.debug(spec.name + ':' + spec.env.msg);
        },
        /* eslint-disable  no-unused-vars */
        async __ca_checkup__(data) {
            return isShutdown ? [new Error('Shutdown')] : [];
        },
        /* eslint-disable  no-unused-vars */
        async __ca_shutdown__(data) {
            isShutdown = true;
            $ && ($[spec.name] === that) && delete $[spec.name];
            return [];
        }
    };
    return [null, that];
};
