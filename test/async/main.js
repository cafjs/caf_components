var caf_comp = require('../../index');

exports.load = function($, spec, name, modules, cb) {
    modules = modules || [];
    modules.push(module);

    caf_comp.load($, spec, name, modules, cb);
};

