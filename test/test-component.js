var async = require('async');
var hello = require('./hello/main.js');
var helloAsync = require('./async/main.js');
var bye = require('./bye/main.js');
var faulty = require('./faulty/main.js');
var dynamic = require('./dynamic/main.js');
var proxy =  require('./proxy/main.js');
var transac =  require('./transac/main.js');
var myUtils = require('../index').myUtils;

exports.helloworld = function (test) {
    test.expect(3);
    hello.load(null, null, 'hello1.json', null, function(err, $) {
        test.ifError(err);
        test.equal(typeof($.hello), 'object', 'Cannot create hello');
        test.equal($.hello.getMessage(), "hola mundo");
        test.done();
    });
};

exports.helloworldAsync = function (test) {
    test.expect(3);
    helloAsync.load(null, null, 'hello1.json', null, function(err, $) {
        test.ifError(err);
        if (!err) {
            test.equal(typeof($.hello), 'object', 'Cannot create hello');
            test.equal($.hello.getMessage(), "hola mundo");
        }
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
    test.expect(11);
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
                   // added component
                   var h3 = $.newHello.$.h3;
                   test.equal(typeof(h3), 'object', 'Cannot create h3');
                   test.equal(h3.getMessage(), 'BYE:child3');
                   // add and delete component
                   var h4 = $.newHello.$.h4;
                   test.ok(h4 === undefined, 'added and deleted but still' +
                           ' there');
                   test.done();
               });
};

exports.properties = function(test) {
    test.expect(11);
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
                                        var env = h1.getSpecEnv();
                                        test.equal(env.someArray[0]
                                                   .language, 'french');
                                        test.equal(env.someArray[1], 'french');
                                        cb(err, $);
                                    });
                      }
                 ], function(err, data) {
                     test.ifError(err);
                     delete process.env['MY_LANGUAGE'];
                     test.done();
                 });
};

var checkTop = function(test, $) {
    //10 checks
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

};
var checkSup = function(test, err, $, waitMSec, cb) {
    //23 checks.
    test.ifError(err);
    setTimeout(function() {
                   checkTop(test, $);
                   var h1 = $.newHello.$.h1;
                   var h2 = $.newHello.$.h2;

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
    var context;
    async.series([
                     function(cb) {
                         faulty.load(null, {name: 'newHello'}, 'faulty1.json',
                                     null, function(err, $) {
                                         context = $;
                                         checkSup(test, err, $, 10000, cb);
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


exports.unrecoverableChild = function(test) {
    test.expect(1);
    faulty.load(null, {name: 'newHello'}, 'faulty2.json', null,
                function(err, $) {
                    test.ok(err && (typeof err === 'object'),
                            'no error detected in unrecoverableChild');
                    test.done();
                });
};


var MTBF = 500;

var specBaseDyn = function(name) {
    return {
        module: "./dynamicImpl",
        name: name,
        env : {
            message: name + '_msg',
            number:42,
            MTBF: MTBF
        }
    };
};

var specTempDyn = function(name) {
    var res = specBaseDyn(name);
    res.env.__ca_temporary__= true;
    return res;
};


var specDyn = function(name) {
    return ((name.indexOf('temp_') === 0) ?
            specTempDyn(name) : specBaseDyn(name));
};

var DYN_ADD = ['temp_comp1', 'comp2', 'comp3', 'temp_comp4', 'temp_comp5',
               'comp6',  'comp7', 'temp_comp8','comp9', 'comp10'];

var DYN_RM = ['temp_comp5', 'comp6', 'comp9'];

var DYN_LEFT = {'comp2': true, 'comp3': true, 'comp7': true, 'comp10': true};

var checkDyn = function(test, err, $, waitMSec, cb) {
    //13 checks.
    test.ifError(err);
    setTimeout(function() {
                   checkTop(test, $);
                   var h2 = $._.$.h2;
                   var expected = Object.keys(DYN_LEFT).sort();
                   var actual = Object.keys(h2.$)
                       .filter(function(x) { return x !== '_';})
                       .sort();
                   test.deepEqual(actual, expected,
                                  'Unexpected dynamic components');
                   var errorKey = null;
                   actual.forEach(function(x) {
                                      if (typeof(h2.$[x]) !== 'object') {
                                          console.log('error:not an object');
                                          errorKey = x;
                                      } else if (h2.$[x].getMessage() !==
                                                 x + '_msg') {
                                          console.log('error:wrong msg ' +
                                                     h2.$[x].getMessage());
                                          errorKey = x;
                                      } else if (h2.$[x].__ca_isShutdown__) {
                                          console.log('error:shutdown');
                                          errorKey = x;
                                      }
                                  });
                   test.ok(errorKey === null, 'Error with dyn comp ' +
                           errorKey);
                   cb(null);
               }, waitMSec);
};


exports.dynamic = function(test) {
    test.expect(15);
    var context;
    var h2;
    async.series([
        function(cb) {
            dynamic.load(null, {name: 'newHello'}, 'dynamic1.json', null,
                         function(err, $) {
                             if (err) {
                                 cb(err);
                             } else {
                                 context = $;
                                 h2 = $._.$.h2;
                                 var ind = $._.$.loader.__ca_getModuleIndex__();
                                 var res = ind['./dynamicSup'].id.split('/');
                                 test.equal(res[res.length-1], 'main.js');
                                 cb(err, $);
                             }
                         });
        },
        function(cb) {
            async.eachSeries(DYN_ADD, function(x, cb1) {
                h2.__ca_instanceChild__(null, specDyn(x), cb1);
            }, cb);
        },
        function(cb) {
            async.eachSeries(DYN_RM, function(x, cb1) {
                h2.__ca_deleteChild__(null, x, cb1);
            }, cb);
        },
        function(cb) {
            checkDyn(test, null, context, 10000, cb);
        },
        function(cb) {
            context.newHello.__ca_shutdown__(null, cb);
        }
    ], function(err, data) {
        test.ifError(err);
        test.done();
    });
};

exports.proxy = function (test) {
    test.expect(3);
    proxy.load(null, {name: 'newHello'}, 'proxy1.json', null, function(err, $) {
                   test.ifError(err);
                   var pr = $.newHello.$.h2.$.plugCA.$.proxy;
                   test.equal(typeof(pr), 'object',
                              'Cannot create proxy');
                   test.equal(pr.getMessage(), "whatever:child1");
                   test.done();
               });
};

exports.transac = function (test) {
    test.expect(15);
    transac.load(null, {name: 'newHello'}, 'transac1.json', null,
                 function(err, $) {
                     test.ifError(err);
                     var pr = $.newHello;
                     test.equal(typeof(pr), 'object',
                                'Cannot create transaction object');
                     test.equal(pr.getMessage(), "hola mundo");
                     test.equal(pr.getNumber(), 7);
                     test.equal(pr.getLanguage(), 'spanish');
                     var cp = null;
                     async.series([
                                      function(cb) {
                                          pr.__ca_init__(cb);
                                      },
                                      function(cb) {
                                          pr.__ca_begin__(null, cb);
                                      },
                                      function(cb) {
                                          pr.__ca_lazyApply__("setLanguage",
                                                              ["french"]);
                                          pr.__ca_lazyApply__("setMessage",
                                                              ["Bonjour Le Monde"]);
                                          test.equal(pr.getMessage(),
                                                     "hola mundo");
                                          test.equal(pr.getLanguage(),
                                                     'spanish');
                                          pr.__ca_commit__(cb);
                                      },
                                      function(cb) {
                                          test.equal(pr.getMessage(),
                                                     'Bonjour Le Monde');
                                          test.equal(pr.getLanguage(),
                                                     'french');
                                          cb(null);
                                      },
                                      function(cb) {
                                          pr.__ca_begin__(null, cb);
                                      },
                                      function(cb) {
                                          pr.__ca_lazyApply__("setLanguage",
                                                              ["spanish"]);
                                          pr.__ca_lazyApply__("setMessage",
                                                              ["hola mundo"]);
                                          var cb0 = function(err, data) {
                                              cp = data;
                                              cb(err, data);
                                          };
                                          pr.__ca_prepare__(cb0);
                                      },
                                      function(cb) {
                                          pr.__ca_abort__(cb);
                                      },
                                      function(cb) {
                                          test.equal(pr.getMessage(),
                                                     'Bonjour Le Monde');
                                          test.equal(pr.getLanguage(),
                                                     'french');
                                          cb(null);
                                      },
                                      function(cb) {
                                          pr.__ca_resume__(cp, cb);
                                      },
                                      function(cb) {
                                          test.equal(pr.getMessage(),
                                                     "hola mundo");
                                          test.equal(pr.getLanguage(),
                                                     'spanish');
                                          cb(null);
                                      },
                                      function(cb) {
                                          pr.__ca_begin__(null, cb);
                                      },
                                      function(cb) {
                                          pr.__ca_lazyApply__("setLanguage",
                                                              ["french"]);
                                          pr.__ca_lazyApply__("die", []);
                                          pr.__ca_prepare__(cb);
                                      },
                                      function(cb) {
                                          var cb0 = function(err) {
                                              test.ok(err,
                                                      "commit did not fail");
                                              cb(null);
                                          };
                                          pr.__ca_commit__(cb0);
                                      }
                                  ], function(err, data) {
                                      test.ifError(err);
                                      test.done();
                                  });
                 });
};

exports.delay = function (test) {
    test.expect(2);
    var f = function(cb) {/* wait forever*/};
    var g = function(cb) { setTimeout(function() {cb(null, 'ok');}, 100);};
    var f1 = myUtils.wrapWithTimeout(f, 1000);
    var g1 = myUtils.wrapWithTimeout(g, 1000);
    f1(function(err) {
        test.equal(err.timeout, true, 'No timeout');
        g1(function(err, data) {
            test.equal(data, 'ok', 'Unwanted timeout');
            test.done();
        });
    });
};
