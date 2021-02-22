#!/usr/bin/env node
'use strict';
/* eslint-disable  no-console */

const main = require('../../index.js');

(async function() {
    try {
        const $ = await main.load(null, {env: {myLogLevel: 'WARN'}},
                                  'hello.json', [module]);
        $._.$.log.warn('see this');
        $._.$.log.debug('but not this');
        $._.$.foo.hello();
        await $.top.__ca_shutdown__(null);
    } catch (err) {
        console.log(main.myUtils.errToPrettyStr(err));
    }
})();
