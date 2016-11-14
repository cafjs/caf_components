# CAF.js (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app and gadgets.

See http://www.cafjs.com

## CAF Components

[![Build Status](http://ci.cafjs.com/api/badges/cafjs/caf_components/status.svg)](http://ci.cafjs.com/cafjs/caf_components)

This library configures and manages a hierarchy of asynchronously created components. Asynchronous constructors are useful when components need configuration data from an external service, and we do not want to block the main loop.

It has no dependencies with other CAF.js packages, and we hope that it will be useful to other frameworks. In CAF.js **everything** is built with components.

This library was inspired by the SmartFrog (Java) framework https://en.wikipedia.org/wiki/SmartFrog and Erlang/OTP supervision trees.

### Hello World

We use JSON to describe components. For example, file `hello.json` contains:

    {
        "module": "./hello",
        "name" : "foo",
        "env" : {
            "msg" : "Hello World!"
        }
    }

where `env` is a set of properties to configure the component, `name` is a key to register the new component in a local context, and `module` an implementation for the component. In particular, the `hello.js` implementation file looks like this:

    exports.newInstance = function($, spec, cb) {
        cb(null, {
            hello: function() {
                console.log(spec.name + ':' + spec.env.msg);
            },
            __ca_checkup__: function(data, cb0) {
                cb0(null);
            },
            __ca_shutdown__: function(data, cb0) {
                cb0(null);
            }
        });
    };

An implementation exports an asynchronous factory method called `newInstance`. This method takes a local context `$`, a parsed configuration description `spec`, and a callback `cb` that returns the new component or an error.

The component needs to implement two methods:

- `__ca_checkup__` returns a callback error if there is something wrong with the component.
- `__ca_shutdown__` sets the component in a disabled state. This function should be idempotent and irrecoverable.

See {@link module:caf_components/gen_component} for a discussion of checkup and shutdown.

What we need now is a way to link the JSON description with the implementation:

    var main = require('caf_components');
    main.load(null, null, 'hello.json', [module], function(err, $) {
        if (err) {
            console.log(main.myUtils.errToPrettyStr(err));
        } else {
            $.foo.hello();
        }
    });

The method `main.load` is loading and parsing the json description, and using that description to instantiate and register a component in the `$` context. Since the first argument, i.e., the initial local context, was `null`, it will create a fresh `$` context.

Why do we need to provide `module`? The method `main.load` will execute a command like `require('./hello').newInstance(...)`, and it needs to know the directory paths to look for `hello.json` and `hello.js`. In this case, we assume that they are all in the same directory, but we can pass an array of `module` objects to provide alternative locations. See {@link module:caf_components/gen_loader} for details.

If we want to create another instance with a different configuration:

    var main = require('caf_components');
    main.load(null, {name: 'bar', env: {msg: 'Bye!'}}, 'hello.json', [module],
        function(err, $) {
            if (err) {
                console.log(main.myUtils.errToPrettyStr(err));
            } else {
                $.bar.hello();
            }
    });

and, before creating the component, `main.load` merges the configuration in the second argument with the contents of `hello.json`.


### Hierarchy

Let's add a hierarchy of components to `hello.json`:

    {
        "module": "caf_components#supervisor",
        "name" : "top",
        "env" : {
            "maxRetries" : 10,
            "retryDelay" : 1000,
            "dieDelay" : 100,
            "maxHangRetries" : 1,
            "interval" : 1000
        },
        "components": [
            {
                "module": "caf_components#plug_log",
                "name" : "log",
                "env" : {
                    "logLevel" : "DEBUG"
                }
            },
            {
                "module": "./hello",
                "name" : "foo",
                "env" : {
                    "msg" : "Hello World!"
                }
            }
        ]
    }

A package can provide factory methods for different component types. We add an access indirection by using the separator `#`. For example, `caf_components#supervisor` is loaded as `require("caf_components").supervisor.newInstance(..)`.

Initialization of a hierarchy is always sequential, respecting array order, and ensuring that a parent component only registers after its children are properly initialized. During shutdown we do the opposite, unregistering the parent component asap, and reversing array order.

This means that we can respect initialization dependencies by ordering components in the description. For example, `hello.js` can safely use the logging component at initialization time:

    exports.newInstance = function($, spec, cb) {
        $.log.debug('Initializing hello');
        cb(null, {
            hello: function() {
                console.log(spec.name + ':' + spec.env.msg);
            },
            __ca_checkup__: function(data, cb0) {
                cb0(null);
            },
            __ca_shutdown__: function(data, cb0) {
                cb0(null);
            }
        });
    };

What if we have more than two levels? Each parent component (see {@link module:caf_components/gen_container} and {@link module:caf_components/gen_dynamic_container}) creates a fresh `$` context for its children, but it also registers a reference `_` in that context to the top component. This top reference helps them to navigate the hierarchy. For example, we can also refer to the logging component as `$._.$.log` since its parent is the top component.

The calling program is modified slightly to use the top reference:

    var main = require('caf_components');
    main.load(null, null, 'hello.json', [module], function(err, $) {
        if (err) {
            console.log(main.myUtils.errToPrettyStr(err));
        } else {
            $._.$.foo.hello(); // or $.top.$.foo.hello()
        }
    });

The top level supervisor (see {@link module:caf_components/supervisor}) forces components with children to periodically check their health, and take local recovery actions when they fail. When local recovery actions do not work, the failure bubbles up until it reaches the root component. This component typically just logs an error message, and exits the process with an error code. At that point an external recovery mechanism should take over.

### Component Description Transforms

In a cloud deployment scenario the usage model of component descriptions is fairly predictable:

1. Start with a base template that defines a standard hierarchy of components for the service.
2. Modify the template by adding, removing, or patching components.
3. Create several instances of the modified template by passing different arguments.
4. Propagate instance arguments to internal components.
5. Fill in missing values by reading properties from the environment.

We have already described how to provide instance arguments to `main.load`. Let's describe how to modify templates, propagate arguments with linking, and specify environment properties with defaults.

#### Templates

If we want to use the previous `hello.json` description as a template, and swap
component `foo` by a new component `bar`, we just create a file with name `<fileNameBase>++.json`, i.e., `hello++.json`:

    {
        "name" : "top",
         "components": [
             {
                 "module": null,
                 "name" : "foo"
             },
             {
                 "module": "./hello",
                 "name" : "bar",
                 "env" : {
                     "msg" : "Bye!"
                 }
             }
         ]
    }

and this description merges with the original by following simple rules:

* Use `name` to identify matching components.
* Assign `null` to `module` to delete a component.
* Components like `bar` that do not match existing ones are inserted just after the last changed one, i.e., `foo`.

See {@link module:caf_components/templateUtils} for details.

#### Linking

We want to parameterize descriptions without knowing the configuration details of internal components. Arguments only modify the top level component, and we specify links to properties of this component with the `$._.env.` prefix. For example, in `hello++.json`:

    {
        "name" : "top",
        "env": {
            "myLogLevel": "DEBUG"
        },
        "components": [
             {
                 "name" : "log",
                 "env" : {
                     "logLevel" : "$._.env.myLogLevel"
                 }
             }
         ]
    }

and now we can change the logging level with:

    main.load(null, {env: {myLogLevel: 'WARN'}}, 'hello.json', ...

#### Properties

We use the reserved `process.env.` prefix for values that come  from the environment. We can also provide default values using the string separator `||`, and any characters after it will be parsed as JSON. If parsing fails, we default to a simple string, avoiding the JSON requirement of quoting all strings. For example:

    {
        "name" : "top",
        "env": {
            "myLogLevel": "process.env.MY_LOG_LEVEL||DEBUG",
            "somethingElse": "process.env.SOMETHING_ELSE||{\"goo\":2}"
        },
        "components": [
             {
                 "name" : "log",
                 "env" : {
                     "logLevel" : "$._.env.myLogLevel"
                 }
             }
         ]
    }

and now we can change the logging level by setting the environment variable `MY_LOG_LEVEL`
