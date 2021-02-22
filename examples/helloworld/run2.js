#!/usr/bin/env node
'use strict';
/* eslint-disable  no-console */
var main = require('../../index.js');

(async function() {
    try {
        const $ = await main.load(null, {name: 'bar', env: {msg: 'Bye!'}},
                                  'hello.json', [module]);
        $.bar.hello();
    } catch (err) {
        console.log(main.myUtils.errToPrettyStr(err));
    }
})();
