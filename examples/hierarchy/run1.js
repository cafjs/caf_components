#!/usr/bin/env node
'use strict';
/* eslint-disable  no-console */

const main = require('../../index.js');

(async function() {
    try {
        const $ = await main.load(null, null, 'hello.json', [module]);
        $.top.$.foo.hello();
        $._.$.foo.hello(); // same result, `$._` is an alias to `$.top`
        await $.top.__ca_shutdown__(null);
    } catch (err) {
        console.log(main.myUtils.errToPrettyStr(err));
    }
})();
