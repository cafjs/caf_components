var hello = require('./hello/main.js');

exports.helloworld1 = function (test) {
    console.log('helloworld1');
    test.expect(3);
    hello.load(null, null, 'hello1.json', null, function(err, $) {
                      test.ifError(err);
                      console.log($);
                      test.equal(typeof($.hello), 'object',
                                 'Cannot create hello');
                      console.log($.hello);
                      console.log($.hello.getMessage());
                      test.equal($.hello.getMessage(), "hola mundo");
                      test.done();
                  });
};

