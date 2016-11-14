'use strict';
/* eslint-disable  no-console */

var main = require('../../index.js');

process.env['MY_LOG_LEVEL'] = 'WARN';

main.load(null, null, 'hello.json', [module],
          function(err, $) {
              if (err) {
                  console.log(main.myUtils.errToPrettyStr(err));
              } else {
                  $._.$.log.warn('see this');
                  $._.$.log.debug('but not this');
                  $._.$.foo.hello();
              }
          });
