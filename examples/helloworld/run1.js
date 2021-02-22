#!/usr/bin/env node
'use strict';
/* eslint-disable  no-console */

const main = require('../../index.js');

(async function() {
    try {
        const $ = await main.load(null, null, 'hello.json', [module]);
        $.foo.hello();
    } catch (err) {
        console.log(main.myUtils.errToPrettyStr(err));
    }
})();
