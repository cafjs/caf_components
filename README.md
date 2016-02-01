# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app.

See http://www.cafjs.com 

## CAF Components

[![Build Status](http://ci.cafjs.com/api/badges/cafjs/caf_components/status.svg)](http://ci.cafjs.com/cafjs/caf_components)


This library creates and manages a hierarchy of asynchronous components. It has no dependencies with CAF core or libs, so that it can easily integrate with other Javascript frameworks. It was inspired by the SmartFrog (Java) framework http://www.smartfrog.org .

### Basics

A component exports an asynchronous factory method called `newInstance`. For example, in a file called `sandwich.js`, we have:

    /**
     * Makes a sandwich.
     *
     * @param {Object.<string, Object>} $ A local context containing references
     * to other resources needed to make sandwiches.
     * @param {Object} spec A map with attributes to configure our sandwich.
     * @param {function(?Error=, Sandwich=)} cb A callback to return a new,
     * fully initialized sandwich.
     */
    exports.newInstance = function($, spec, cb) {
        var sandwich = new Sandwich($, spec) // or your synchronous constructor
        // asynchronously initialize 'sandwich'
        ...
        // and *after* initialization
        if (err) { 
           cb(err);
        } else {
          cb(null, sandwich);
        }           
    }

In most cases `newInstance` is not directly called by your code. Instead, a JSON description file (`sandwich.json`) describes your components, and CAF does the rest. For example, `sandwich.json` contains:

    {
      "module" : "./sandwich",
      "name" : "defaultNameForSandwich",
      "description": "An item of food consisting of two pieces of bread with meat, cheese, or other filling between them, eaten as a light meal.\n Properties:\n  <bread> {string} Type of bread.\n  <fillings> {Array.<string>} Ingredients.\n"
      "env" : {
          bread : "rye",
          fillings: [ "ham", "cheese"] 
      }
    }

`name` is a default name to register a new sandwich in the local context `$`.

`module` is the name of the module that provides `newInstance`, i.e., the factory implementation for sandwiches. 

Sometimes a module defines many factory methods. We select one with a `#` so `sandwich#rubin` refers to `require("sandwich").rubin.newInstance()`

`env` is an object with properties to configure our sandwich. 

and in the same directory, `main.js`:

    var caf_comp = require('caf_components');
    var $ = null; //  or an already initialized context
    caf_comp.load($, {name: 'mySandwich'}, 'sandwich.json', [module], function(err, $) {
          if (!err) {
              console.log("Got a sandwich " + JSON.stringify($.mySandwich));
          }
    }
    
where the `load` method takes as arguments:

* A `$` local context (or `null` if we want to create a fresh one) to register the new sandwich.

* A spec overriding default values in the description. In this case we just 
bind our sandwich in `$` with the name `mySandwich`.

* A JSON description to create sandwiches.

* A node.js module to load the description and code. Node.js module loading system binds a variable called `module` to the object representing the current module. We use the `require` method on that object to load resources in the same directory as `main.js`.

* A callback that returns the original (or newly created) `$` context that contains the new sandwich.


### Hierarchy

How to create a hierarchy of components?  For example, in file `lunchBox.json`:

     {
        "module": "lunch",
        "name": "myLunch",
        "description": "Today's lunch.\n Properties:\n",
         "env" : {         
         },
         "components" : [
             {
                "module": "woodBox",
                "name": "myBox",
                ...
             },
             {
                "module": "banana",
                "name": "myBanana",
                ...
             },              
             {
                "module" : "./sandwich",
                "name" : "myFirstSandwich",
                ...
             },
             {
                "module" : "./sandwich",
                "name" : "anotherSandwich",
                ...
             },
             ...
         ]
     }

Initialization is always sequential, respecting array order and tree dependencies (a parent component finishes initialization after its children). During shutdown we reverse that order. 

Components with children create a fresh local context `$` for them. They also register the top level component (using `$._`) in that context. This allows any component to navigate the hierarchy of ready components. For example, `anotherSandwich` can refer to `myBox` as `$.myBox` or `$._.$.myBox` since `$._` refers to `myLunch`. 

### Templates

We can use any description as a template and, for example, override the `module` attribute for one component. We use the convention `<file_name>++.json` to specify the source template, so if `lunchBox++.json` contains:

       {
         "module" : "restaurantLunch",
         "name" : "myLunch"
       }

the resulting description just modifies the top component implementation.

What about ordering?

Existing components are always patched in-place, without changing order. New ones are inserted just after the last patched (or inserted) component. We can also delete components by setting `module` to null. 

This allow us to re-order components or add a new one in a particular position. For example, when `lunchBox++.json` is:

      {
         "name" : "myLunch"
         "components": [
             {
               "name" : "myBanana"
             },
             {  
               "module" : "./sandwich"
               "name" : "reallyTheFirst"
              ...
             },
             {
              "module": null,
              "name" :"myFirstSandwich"
             }
         ]
      }
      
the final description will be:

    {
        "module": "lunch",
        "name": "myLunch",
        "description": "Today's lunch.\n Properties:\n",
         "env" : {         
         },
         "components" : [
             {
                "module": "woodBox",
                "name": "myBox",
                ...
             },
             {
                "module": "banana",
                "name": "myBanana",
                ...
             },              
             {
                "module" : "./sandwich",
                "name" : "reallyTheFirst",
                ...
             },
             {
                "module" : "./sandwich",
                "name" : "anotherSandwich",
                ...
             },
             ...
         ]
     }

### Linking

In many cloud deployments configuration settings are specified using environment variables. We use the reserved `process.env.` prefix in a string to highlight a value in `env` that comes from the environment:

      {
        "module": "lunch",
        "name": "myLunch"
        "description": "Today's lunch.\n Properties:\n"
         "env" : {
            "location" : "process.env.MY_LOCATION"
         },
         ...
         
We can add a default value for undefined properties:

     {
        "module": "lunch",
        "name": "myLunch"
        "description": "Today's lunch.\n Properties:\n"
         "env" : {
            "location" : "process.env.MY_LOCATION ||Palo Alto"
         },
         ...
 


Also, we can refer to a value already defined in the topmost `env` by using  the prefix `$._.env.`. This value can be a `process.env.`, but not another symbolic link.

       {       
        "module": "lunch",
        "name": "myLunch"
        "description": "Today's lunch.\n Properties:\n"
         "env" : {
            "location" : "process.env.MY_LOCATION"
         },
         "components" : [
             {
                "module": "woodBox"
                "name": "myBox"
                "env" : {
                   "boxLocation" : "$._.env.location"
                }
             },
             ...
 
  

### Component Methods

Components implement two methods:

    /**
    *  Checks the health of this component.
    *
    *  @param {Object=} data An optional hint on how to perform the checkup.
    *  @param {function(?Error=, Object=)} A callback invoked after the check,
    *  with an error if component faulty, or optional info to bubble up.
    *  
    * @name  gen_component#__ca_checkup__
    * @function
    */
    __ca_checkup__ = function(data, cb) {    
    }
    
    
    /**
    *  Forces this component to shutdown. This action is non-recoverable and 
    * idempotent. After a successful shutdown, a component  is deregistered
    * from the original local context '$'. If failures occur, the
    * parent component should also take a recovery action to clean-up (e.g.,  
    * shutdown the  node.js process).
    *
    *  @param {Object=} data An optional hint on how to perform the shutdown.
    *  @param {function(?Error=)} A callback invoked after the
    * shutdown, with an error if it failed.
    *
    * @name  gen_component#__ca_shutdown__
    * @function
    */
    __ca_shutdown__ = function(data, cb) {
    }

### Supervisor

Similar to an Erlang/OTP supervisor, components with children periodically check their health and take recovery actions when they fail. When recovery actions do not work, the failure bubbles up until it reaches the root component. This component typically just logs an error message and exits with an error code. At that point an external recovery mechanism should take over.
