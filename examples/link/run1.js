'use strict';
/* eslint-disable  no-console */

var main = require('../../index.js');

main.load(null, {env: {myLogLevel: 'WARN'}}, 'hello.json', [module],
          function(err, $) {
              if (err) {
                  console.log(main.myUtils.errToPrettyStr(err));
              } else {
                  $._.$.log.warn('see this');
                  $._.$.log.debug('but not this');
                  $._.$.foo.hello();
              }
          });
