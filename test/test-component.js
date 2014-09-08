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

exports.rename = function (test) {
    test.expect(3);
    hello.load(null, {name: 'newHello'}, 'hello1.json', null, function(err, $) {
                      test.ifError(err);
                      console.log($);
                      test.equal(typeof($.newHello), 'object',
                                 'Cannot create hello');
                      test.equal($.newHello.getMessage(), "hola mundo");
                      test.done();
                  });
};

exports.extend = function (test) {
    test.expect(5);
    hello.load(null, {name: 'newHello'}, 'hello2.json', null, function(err, $) {
                   test.ifError(err);
                   console.log($);
                   test.equal(typeof($.newHello), 'object',
                              'Cannot create hello');
                   // changed
                   test.equal($.newHello.getMessage(), "adios mundo");
                   test.equal($.newHello.getNumber(), null);
                   // added
                   test.equal($.newHello.getOtherMessage(), "hello mundo");
                   test.done();
               });



};


