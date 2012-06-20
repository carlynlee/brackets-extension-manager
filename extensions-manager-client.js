/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window */

define(function (require, exports, module) {
    'use strict';

    // The extensions folder
    var extensionDir = "extensions/user/";
    var moduleName = "extensions-manager";

    // Brackets modules
    var ExtensionLoader         = brackets.getModule("utils/ExtensionLoader");
    var client = require("client");

    // Monkey-patch the extension loader
    ExtensionLoader.unloadExtension = function (name, config, entryPoint) {
        console.log("[Extension] Unloading " + name + " (in " + config.baseUrl + ")");
        var libRequire = brackets.libRequire;
        
        var extensionRequire = libRequire.config({
            context: name,
            baseUrl: config.baseUrl,
            // GET failing isn't enough for requirejs, it just waits for a timeout
            // But if there is no unload.js, we don't want to wait a long time
            waitSeconds: 1
        });
        
        // Evil hack to make requirejs forget it ever loaded this extension
        var forgetExtension = function () {
            delete libRequire.s.contexts[name];
        };
        
        var result = new $.Deferred();
        
        function moduleUnloaded(err) {
            forgetExtension();
            if (err) {
                console.log("[Extension] Error while unloading " + name + ": " + err.message);
                result.reject(err);
            } else {
                console.log("[Extension] Successfully unloaded " + name);
                result.resolve();
            }
        }
        
        var module = libRequire.s.contexts[name].defined.main;
        
        if (module && module.unload) {
            console.log("[Extension] Unloading " + name + " with its module's unload method");
            try {
                if (module.unload.length > 0) {
                    console.log("[Extension] Waiting for callback to be called");
                    module.unload(moduleUnloaded);
                } else {
                    console.log("[Extension] Unloading sequentially");
                    module.unload();
                    moduleUnloaded();
                }
            } catch (err) {
                moduleUnloaded(err);
            }
        }
        else {
            console.log("[Extension] Unloading " + name + " by requiring its unload.js");
            // Hook into require.js to get some errors.
            // Would be easier with RequireJS 2.0
            var originalErrorHandler = libRequire.onError;
            libRequire.onError = function (err) {
                libRequire.onError = originalErrorHandler;
                moduleUnloaded(err);
            };
            
            // Require unload.js
            extensionRequire([entryPoint], function () {
                moduleUnloaded();
            });
        }
        
        return result.promise();
    };
    
    // load an extension
    function _load(name) {
        ExtensionLoader.loadExtension(name, { baseUrl: extensionDir + name }, "main");
    }

    // unload an extension
    function _unload(name) {
        return ExtensionLoader.unloadExtension(name, { baseUrl: extensionDir + name }, "unload");
    }


    // list extensions
    function list(callback) {
        client.send(moduleName, "list", callback);
    }

    // install an extension
    function install(name, callback) {
        client.send(moduleName, "install", name, function (res) {
            _load(name);
            if (callback) { callback(); }
        });
    }

    // uninstall an extension
    function uninstall(name, callback) {
        client.send(moduleName, "uninstall", name, function (res) {
            if (callback) { callback(); }
        });
    }

    // enable an extension
    function enable(name, callback) {
        client.send(moduleName, "enable", name, function (res) {
            _load(name);
            if (callback) { callback(); }
        });
    }
    
    // disable an extension
    function disable(name, callback) {
        var fn = function () {
            client.send(moduleName, "disable", name, callback);
        };
        // Wait for unload to complete or fail before disabling
        _unload(name).done(fn).fail(fn);
    }

    // update an extension
    function update(name, callback) {
        client.send(moduleName, "update", name, function (res) {
            if (callback) { callback(); }
        });
    }
    
    // update all extensions
    function updateAll(callback) {
        client.send(moduleName, "updateAll", function (res) {
            if (callback) { callback(); }
        });
    }

    // open a URL
    function openUrl(url) {
        client.send(moduleName, "openUrl", url);
    }
    
    // init the extension client
    function init(callback) {
        client.connect(callback);
    }

    exports.list = list;
    exports.install = install;
    exports.uninstall = uninstall;
    exports.enable = enable;
    exports.disable = disable;
    exports.update = update;
    exports.updateAll = updateAll;
    exports.openUrl = openUrl;
    exports.init = init;
});
