var async = require('async');
var hello = require('./hello/main.js');
var bye = require('./bye/main.js');
var faulty = require('./faulty/main.js');

exports.helloworld = function (test) {
    test.expect(3);
    hello.load(null, null, 'hello1.json', null, function(err, $) {
                      test.ifError(err);
                      test.equal(typeof($.hello), 'object',
                                 'Cannot create hello');
                      test.equal($.hello.getMessage(), "hola mundo");
                      test.done();
                  });
};

exports.rename = function (test) {
    test.expect(3);
    hello.load(null, {name: 'newHello'}, 'hello1.json', null, function(err, $) {
                      test.ifError(err);
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
                   // top component
                   test.equal(typeof($.newHello), 'object',
                              'Cannot create hello');
                   test.equal($.newHello.getMessage(), 'hola mundo');
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

exports.properties = function(test) {
    test.expect(9);
    async.series([
                     function(cb) {
                         hello.load(null, {name: 'newHello'}, 'hello4.json',
                                    null, function(err, $) {
                                        test.ifError(err);
                                        test.equal(typeof($.newHello), 'object',
                                                   'Cannot create hello');
                                        var h1 = $.newHello.$.h1;
                                        test.equal(typeof(h1), 'object',
                                                   'Cannot create h1');
                                        test.equal(h1.getLanguage(), 'spanish');
                                        process.env['MY_LANGUAGE'] = 'french';
                                        cb(err, $);
                                    });
                     },
                      function(cb) {
                         hello.load(null, {name: 'newHello'}, 'hello4.json',
                                    null, function(err, $) {
                                        test.ifError(err);
                                        test.equal(typeof($.newHello), 'object',
                                                   'Cannot create hello');
                                        var h1 = $.newHello.$.h1;
                                        test.equal(typeof(h1), 'object',
                                                   'Cannot create h1');
                                        test.equal(h1.getLanguage(), 'french');
                                        cb(err, $);
                                    });
                      }
                 ], function(err, data) {
                     test.ifError(err);
                     delete process.env['MY_LANGUAGE'];
                     test.done();
                 });
};

var checkSup = function(test, err, $, waitMSec, cb) {
    //23 checks.
    test.ifError(err);
    setTimeout(function() {
                   // top component
                   test.equal(typeof($.newHello), 'object',
                              'Cannot create hello');
                   test.ok(!$.newHello.__ca_isShutdown__, 'newHello shutdown');

                   // first level
                   var h1 = $.newHello.$.h1;
                   var h2 = $.newHello.$.h2;
                   test.equal(typeof(h1), 'object', 'Cannot create h1');
                   test.equal(typeof(h2), 'object', 'Cannot create h2');
                   test.equal(h1.getMessage(), 'child1');
                   test.equal(h1.getNumber(), 8);
                   test.ok(!h1.__ca_isShutdown__, 'h1 shutdown');

                   test.equal(h2.getMessage(), 'child2');
                   test.equal(h2.getNumber(), 9);
                   test.ok(!h2.__ca_isShutdown__, 'h2 shutdown');

                   // second level
                   var h21 = h2.$.h21;
                   test.equal(typeof(h21), 'object', 'Cannot create h21');
                   test.equal(h21.getMessage(), 'child21');
                   test.equal(h21.getNumber(), 10);
                   test.ok(!h21.__ca_isShutdown__, 'h21 shutdown');

                   var h22 = h2.$.h22;
                   test.equal(typeof(h22), 'object', 'Cannot create h22');
                   test.equal(h22.getMessage(), 'child22');
                   test.equal(h22.getNumber(), 11);
                   test.ok(!h22.__ca_isShutdown__, 'h22 shutdown');

                   var h23 = h2.$.h23;
                   test.equal(typeof(h23), 'object', 'Cannot create h23');
                   test.equal(h23.getMessage(), 'child23');
                   test.equal(h23.getNumber(), 12);
                   test.ok(!h23.__ca_isShutdown__, 'h23 shutdown');

                   cb(null);
               }, waitMSec);
};
exports.supervisor = function(test) {
    test.expect(24);
//    test.expect(2);
    var context;
    async.series([
                     function(cb) {
                         faulty.load(null, {name: 'newHello'}, 'faulty1.json',
                                     null, function(err, $) {
                                         context = $;
                                         console.log(err);
                                         checkSup(test, err, $, 10000, cb);
//                                         cb(null);
                                     });
                     },
                     function(cb) {
                         context.newHello.__ca_shutdown__(null, cb);
                     }
                 ], function(err, data) {
                     test.ifError(err);
                     test.done();
                 });
};
