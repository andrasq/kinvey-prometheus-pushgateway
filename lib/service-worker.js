/**
 * Copyright (C) 2018 Kinvey, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * forkable createService() called from ../index.js
 * Accepts the service config via an IPC message, and replies once listening.
 */

'use strict';

var pkg = require('../package');
var child_process = require('child_process');
var Gateway = require('./gateway');
var serviceModule = require('./service');


// how long to wait after the parent dies before exiting
var DISCONNECT_TIMEOUT = 10000;

// process.send not available inside the unit tests
process.send = process.send || function(){};


process.on('message', function(msg) {
    if (!msg || !msg.n) return;
    if (msg.n === 'createServer') {
        try {
            delete msg.m.gateway;

            serviceModule.createServer(msg.m, function(err, info) {
                if (err) return process.send({ n: 'error', m: { message: err.message, stack: err.stack } });
                // cannot return objects to parent process, only return minimal info
                process.send({ n: 'ready', m: { pid: info.pid, port: info.port } });
            })

            process.on('disconnect', function() {
// TODO: should checkpoint stats to journal upon receipt, and exit without delay when parent dies
// This would not interfere with a restart

                var timeout = msg.m.timeout || DISCONNECT_TIMEOUT;
                Gateway.trace('%s: parent exited, pid #%d quitting in %d seconds', pkg.name, process.pid, timeout/1000);
                // if the parent process dies, exit after 12 seconds
                var timer = setTimeout(function() {
                    Gateway.trace('%s: pid #%d exiting', pkg.name, process.pid);
                    process.kill(0, 'SIGHUP');
                }, timeout);
                process.on('ignore_disconnect', function() {
                    clearTimeout(timer);
                })
            })

        } catch (err) {
            process.send({ n: 'error', m: { message: err.message, stack: err.stack } });
            // NOTE: this line is a no-op, what was it originally intended for?
            // Tests break if the process actually exits, even if after waiting 2000 ms.
            setTimeout(function() { return process.exit }, 10);
        }
    }
})
