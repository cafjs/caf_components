# Caf.js

Co-design permanent, active, stateful, reliable cloud proxies with your web app and gadgets.

See https://www.cafjs.com

## Library for Building Caf.js Components

[![Build Status](https://travis-ci.org/cafjs/caf_components.svg?branch=master)](https://travis-ci.org/cafjs/caf_components)

In `Caf.js` **everything** is built with components.

This library configures and manages a hierarchy of asynchronously created components. Asynchronous constructors allow components to read configuration data from an external service, such as Redis, without blocking the main loop.

Asynchronous constructors are called serially using a deterministic order. When this ordering respects the natural dependencies between components, an already created component can be used to bootstrap the creation of other components. A clean shut down of the hierarchy reverses that order.

A parent component periodically monitors the health of its children and takes a recovery action if needed. When this recovery action keeps failing, the error bubles up until the process exits. At that point Kubernetes takes control and restarts the container somewhere else.

A description language is used to configure the hierarchy. Templating, linking, parameter passing, and system properties, are used to simplify the creation of complex hierarchies of components. Decoupling configuration from implementation eliminates hard dependencies between components, relying instead on dependency injection with dynamic imports. In `Caf.js` **anything** can be replaced by changing a few lines of JSON.

This library was inspired by the SmartFrog (Java) framework https://en.wikipedia.org/wiki/SmartFrog and Erlang/OTP supervision trees.

### Hello World

We use JSON to describe components. For example, the file `hello.json` in the directory `examples/helloworld` is:

```
    {
        "module": "./hello",
        "name" : "foo",
        "description" : "My first component",
        "env" : {
            "msg" : "Hello World!"
        }
    }
```
where:

- `module` an implementation for the component.
- `name` a key to register the new component in a local context.
- `description` a comment describing the component.
- `env` a set of properties to configure the component.

Implementations export an asynchronous factory method called `newInstance`. This method takes two arguments, a local context `$` to register the new component, and a configuration map typically derived from the parsed JSON description.

For example, the implementation file `hello.js` looks like this:

```
exports.newInstance = async function($, spec) {
    let isShutdown = false;
    const that = {
        hello() {
            !isShutdown && console.log(spec.name + ':' + spec.env.msg);
        },
        async __ca_checkup__(data) {
            return isShutdown ? [new Error('Shutdown')] : [];
        },
        async __ca_shutdown__(data) {
            isShutdown = true;
            $ && ($[spec.name] === that) && delete $[spec.name];
            return [];
        }
    };
    return [null, that];
};
```

Components always implement two asynchronous methods:

- `__ca_checkup__` returns an error if there is something wrong with the component.
- `__ca_shutdown__` sets the component in a disabled state and removes it from the context. This function should be idempotent and irrecoverable.

Methods return **handled**  errors in the first argument of an array tuple. In `Caf.js` application-level errors are managed differently from thrown exceptions, or unrecoverable system errors, and this approach gives us more flexibility.

See {@link module:caf_components/gen_component} for a discussion of checkup and shutdown.

To link the JSON description with the component implementation:

```
const main = require('caf_components');
try {
    const $ = await main.load(null, null, 'hello.json', [module]);
    $.foo.hello();
} catch (err) {
    console.log(main.myUtils.errToPrettyStr(err));
}
```

The method `main.load` loads and parses the JSON description, and uses that description to instantiate and register a component in the `$` context. Since the first argument, i.e., the initial local context, was `null`, a fresh context will be created.

Why do we need to provide `module`? The method `main.load` needs the directory paths of `hello.json` and `hello.js`, and in this case they are all assumed to be in the same directory. In a complex setup an array of `module` objects could provide alternative locations for these resources. See {@link module:caf_components/gen_loader} for details.

To create another instance with a different configuration:

```
const main = require('caf_components');
try {
    const $ = await main.load(null, {name: 'bar', env: {msg: 'Bye!'}},
                              'hello.json', [module]);
    $.bar.hello();
} catch (err) {
    console.log(main.myUtils.errToPrettyStr(err));
}
```

and the configuration passed in the second argument will get merged with the contents of `hello.json`.

### Hierarchy

Let's create a hierarchy of components. Note that one package can provide factory methods for several components by using the separator `#`. For example, the factory method `newInstance` for `caf_components#supervisor` is found with `require("caf_components").supervisor`.

```
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
```

Initialization of a hierarchy is always sequential, respecting array order, and ensuring that a parent component only registers after its children are properly initialized. The exception is the topmost component that is always available. During shutdown we do the opposite, unregistering the parent component asap, and reversing array order.

This means that we can respect initialization dependencies by ordering components in the description. For example, `hello.js` can safely use the logging component at initialization time:

```
exports.newInstance = async function($, spec) {
    let isShutdown = false;
    $.log.debug('Initializing hello'); // SAFE!!
    const that = {
        hello() {
            !isShutdown && $.log.debug(spec.name + ':' + spec.env.msg);
        },
        async __ca_checkup__(data) {
            return isShutdown ? [new Error('Shutdown')] : [];
        },
        async __ca_shutdown__(data) {
            isShutdown = true;
            $ && ($[spec.name] === that) && delete $[spec.name];
            return [];
        }
    };
    return [null, that];
};
```

What if there are more than two levels in the hierarchy?

Each parent component (see {@link module:caf_components/gen_container} and {@link module:caf_components/gen_dynamic_container}) creates a fresh `$` context for its children that includes a reference `_` to the topmost component.  Using that reference any component can find the logging component with `$._.$.log`.

The main program is similar but the supervision tree is explicitly shutdown during a clean exit.

```
const main = require('caf_components');
try {
    const $ = await main.load(null, null, 'hello.json', [module]);
    $.top.$.foo.hello();
    $._.$.foo.hello(); // same result, `$._` is an alias to `$.top`
    await $.top.__ca_shutdown__(null);
} catch (err) {
    console.log(main.myUtils.errToPrettyStr(err));
}
```


### Component Description Transforms

Most cloud service deployments have a common pattern for component configuration:

1. Start with a base template that defines a standard hierarchy of components for the service.
2. Modify the template by adding, removing, or patching components.
3. Create several instances with the modified template by passing different arguments.
4. Propagate instance arguments to internal components.
5. Fill in missing values by reading properties from the environment.

We have already described how to provide instance arguments to `main.load`. Let's describe how to modify templates, propagate arguments with linking, and specify environment properties with defaults.

#### Templates

Assuming the previous `hello.json` description as a template, to swap the component `foo` by a new component `bar` we just create a file with name `<fileNameBase>++.json`, e.g., `hello++.json`, and contents:

```
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
```

and this description merges with the template by following a few simple rules:

* Use `name` to identify matching components.
* Assign `null` to `module` to delete a component.
* Components like `bar` that do not match existing ones are inserted just after the last one that was accessed, i.e., `foo`.

See {@link module:caf_components/templateUtils} for details.

#### Linking

We want to parameterize descriptions without knowing the internal component structure. Our approach is to just change properties of the top level component with argument passing, and then specify links to properties of this component with the `$._.env.` prefix. For example, in `hello++.json`:

```
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
```

and now we can change the logging level with:

```
    main.load(null, {env: {myLogLevel: 'WARN'}}, 'hello.json', ...
```

#### Properties

We use the reserved `process.env.` prefix for values that come  from the environment. We can also provide default values using the string separator `||`, and any characters after it will be parsed as JSON. If parsing fails, we default to a simple string, avoiding the JSON requirement of quoting all strings. For example:

```
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
```

and now we can change the logging level by setting the environment variable `MY_LOG_LEVEL`
