'use strict';
/* eslint-disable  no-console */
var main = require('../../index.js');

main.load(null, {name: 'bar', env: {msg: 'Bye!'}}, 'hello.json', [module],
          function(err, $) {
              if (err) {
                  console.log(main.myUtils.errToPrettyStr(err));
              } else {
                  $.bar.hello();
              }
          });
