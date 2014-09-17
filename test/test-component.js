var async = require('async');
var hello = require('./hello/main.js');
var bye = require('./bye/main.js');

exports.helloworld = function (test) {
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

exports.hierarchy = function(test) {
    test.expect(16);
    hello.load(null, {name: 'newHello'}, 'hello3.json', null, function(err, $) {
                   test.ifError(err);
                   console.log($);
                   // top component
                   test.equal(typeof($.newHello), 'object',
                              'Cannot create hello');
                   test.equal($.newHello.getMessage(), "hola mundo");
                   test.equal($.newHello.getNumber(), 7);

                   // first level
                   var h1 = $.newHello.$.h1;
                   var h2 = $.newHello.$.h2;
                   test.equal(typeof(h1), 'object', 'Cannot create h1');
                   test.equal(typeof(h2), 'object', 'Cannot create h2');
                   test.equal(h1.getMessage(), 'child1');
                   test.equal(h1.getNumber(), 8);
                   test.equal(h1.getLanguage(), 'spanish');
                   test.equal(h2.getMessage(), 'child2');
                   test.equal(h2.getNumber(), 9);
                   test.equal(h2.getLanguage(), 'spanish');

                   // second level
                   var h21 = h2.$.h21;
                   test.equal(typeof(h21), 'object', 'Cannot create h21');
                   test.equal(h21.getMessage(), 'child21');
                   test.equal(h21.getNumber(), 10);
                   test.equal(h21.getLanguage(), 'spanish');

                   test.done();
               });
};

exports.shutdown = function(test) {
    test.expect(7);
    hello.load(null, {name: 'newHello'}, 'hello3.json', null, function(err, $) {
                   test.ifError(err);
                   var hello = $.newHello;
                   var h1 = $.newHello.$.h1;
                   var h2 = $.newHello.$.h2;
                   var h21 = h2.$.h21;
                   async.series([
                                    function(cb) {
                                        $.newHello.__ca_checkup__(null, cb);
                                    },
                                    function(cb) {
                                        $.newHello.__ca_shutdown__(null, cb);
                                    },
                                    function(cb) {
                                        //idempotent
                                        hello.__ca_shutdown__(null, cb);
                                    }
                                ], function(err, data) {
                                    test.ifError(err);
                                    test.equal($.newHello, undefined);
                                    test.equal(hello.__ca_isShutdown__,
                                               true);
                                    test.equal(h1.__ca_isShutdown__, true);
                                    test.equal(h2.__ca_isShutdown__, true);
                                    test.equal(h21.__ca_isShutdown__, true);
                                    test.done();
                                });
               });
};

exports.manyDirs = function(test) {
    var byeModule = bye.getModule();
    test.expect(8);
    hello.load(null, {name: 'newHello'}, 'hello3.json', [byeModule],
               function(err, $) {
                   test.ifError(err);
                   // top component
                   test.equal(typeof($.newHello), 'object',
                              'Cannot create hello');
                   test.equal($.newHello.getMessage(), "hola mundo");
                   test.equal($.newHello.getNumber(), 7);
                   // modified component
                   var h1 = $.newHello.$.h1;
                   test.equal(typeof(h1), 'object', 'Cannot create h1');
                   test.equal(h1.getMessage(), 'BYE:byeChild1');
                   test.equal(h1.getNumber(), 8);
                   test.equal(h1.getLanguage(), 'spanish');
                   test.done();
               });
};
