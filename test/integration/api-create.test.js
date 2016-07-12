/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016, Joyent, Inc.
 */

/*
 * Integration tests for `docker create` using the Remote API directly.
 */

var exec = require('child_process').exec;
var format = require('util').format;
var libuuid = require('libuuid');
var test = require('tape');
var util = require('util');
var vasync = require('vasync');

var configLoader = require('../../lib/config-loader.js');
var constants = require('../../lib/constants');

var h = require('./helpers');



// --- Globals
var BYTES_IN_MB = 1024 * 1024;
var ALICE;
var BOB;
var DOCKER_ALICE;
var DOCKER_BOB;
var STATE = {
    log: require('../lib/log')
};
var CONFIG = configLoader.loadConfigSync({log: STATE.log});
var VMAPI;
var NAPI;
var FABRICS = false;


// --- Tests


test('setup', function (tt) {

    tt.test('docker env', function (t) {
        h.initDockerEnv(t, STATE, {}, function (err, accounts) {
            t.ifErr(err);

            ALICE = accounts.alice;
            BOB   = accounts.bob;

            t.end();
        });
    });


    tt.test('docker client init', function (t) {
        vasync.parallel({ funcs: [
            function createAliceJson(done) {
                h.createDockerRemoteClient({user: ALICE},
                    function (err, client) {
                        t.ifErr(err, 'docker client init for alice');
                        done(err, client);
                    }
                );
            },
            function createBobJson(done) {
                h.createDockerRemoteClient({user: BOB},
                    function (err, client) {
                        t.ifErr(err, 'docker client init for bob');
                        return done(err, client);
                    }
                );
            }
        ]}, function allDone(err, results) {
            t.ifError(err, 'docker client init should be successful');
            DOCKER_ALICE = results.operations[0].result;
            DOCKER_BOB = results.operations[1].result;
            t.end();
        });
    });


    tt.test('vmapi client init', function (t) {
        h.createVmapiClient(function (err, client) {
            t.ifErr(err, 'vmapi client');
            VMAPI = client;
            t.end();
        });
    });

    // init the napi client to create a fabric to test against.
    tt.test('napi client init', function (t) {
        h.createNapiClient(function (err, client) {
            t.ifErr(err, 'napi client');
            NAPI = client;
            t.end();
        });
    });

    // tt.test('pull nginx image', function (t) {
    //     var url = '/images/create?fromImage=nginx%3Alatest';
    //     DOCKER_ALICE.post(url, function (err, req, res) {
    //         t.error(err, 'should be no error posting image create request');
    //         t.end();
    //     });
    // });

});

// test('api: create with non-string label values (DOCKER-737)', function (t) {
//     var payload = {
//         // Boilerplate
//         'Hostname': '',
//         'Domainname': '',
//         'User': '',
//         'Memory': 0,
//         'MemorySwap': 0,
//         'CpuShares': 0,
//         'Cpuset': '',
//         'AttachStdin': false,
//         'AttachStdout': false,
//         'AttachStderr': false,
//         'PortSpecs': null,
//         'ExposedPorts': {},
//         'Tty': false,
//         'OpenStdin': false,
//         'StdinOnce': false,
//         'Env': [],
//         'Cmd': null,
//         'Image': 'nginx',
//         'Volumes': {},
//         'WorkingDir': '',
//         'Entrypoint': null,
//         'NetworkDisabled': false,
//         'OnBuild': null,
//         'SecurityOpt': null,
//         'HostConfig': {
//             'Binds': null,
//             'ContainerIDFile': '',
//             'LxcConf': [],
//             'Privileged': false,
//             'PortBindings': {},
//             'Links': null,
//             'PublishAllPorts': false,
//             'Dns': null,
//             'DnsSearch': null,
//             'ExtraHosts': null,
//             'VolumesFrom': null,
//             'Devices': [],
//             'NetworkMode': 'bridge',
//             'CapAdd': null,
//             'CapDrop': null,
//             'RestartPolicy': {
//                 'Name': '',
//                 'MaximumRetryCount': 0
//             }
//         },

//         // The interesting data we are actually testing in this test case:
//         Labels: {
//             foo: true,
//             anum: 3.14
//         }
//     };
//     var apiVersion = 'v' + constants.API_VERSION;
//     DOCKER_ALICE.post(
//         '/' + apiVersion + '/containers/create',
//         payload,
//         function (err, req, res) {
//             t.ok(err, 'expect err from container create');
//             /* JSSTYLED */
//             var errRe = /^\(Validation\) invalid labels: label "foo" value is not a string: true; label "anum" value is not a string: 3.14/;
//             t.ok(errRe.exec(err.message), format('err.message matches %s: %j',
//                 errRe, err.message));
//             t.end();
//         });
// });


// test('api: create', function (tt) {

//     var created;

//     tt.test('docker create', function (t) {
//         h.createDockerContainer({
//             vmapiClient: VMAPI,
//             dockerClient: DOCKER_ALICE,
//             test: t
//         }, oncreate);

//         function oncreate(err, result) {
//             t.ifErr(err, 'create container');
//             created = result;
//             t.end();
//         }
//     });

//     tt.test('docker rm', function (t) {
//         DOCKER_ALICE.del('/containers/' + created.id, ondel);

//         function ondel(err, res, req, body) {
//             t.ifErr(err, 'rm container');
//             t.end();
//         }
//     });

//     tt.test('docker create without approved_for_provisioning', function (t) {
//         h.createDockerContainer({
//             vmapiClient: VMAPI,
//             dockerClient: DOCKER_BOB,
//             // we expect errors here, so stub this out
//             test: {
//                 deepEqual: stub,
//                 equal: stub,
//                 error: stub,
//                 ok: stub
//             }
//         }, oncreate);

//         function oncreate(err, result) {
//             t.ok(err, 'should not create without approved_for_provisioning');
//             t.equal(err.statusCode, 403);

//             var expected = BOB.login + ' does not have permission to pull or '
//                 + 'provision';
//             t.ok(err.message.match(expected));

//             t.end();
//         }

//         function stub() {}
//     });

//     tt.test('docker create without memory override', function (t) {
//         h.createDockerContainer({
//             vmapiClient: VMAPI,
//             dockerClient: DOCKER_ALICE,
//             test: t
//         }, oncreate);

//         function oncreate(err, result) {
//             t.ifErr(err, 'create container');
//             created = result;
//             t.equal(created.vm.ram, CONFIG.defaultMemory,
//                     'VM with default memory specs should be created with '
//                     + CONFIG.defaultMemory + ' MBs of RAM');
//             t.end();
//         }
//     });

//     tt.test('docker rm', function (t) {
//         DOCKER_ALICE.del('/containers/' + created.id, ondel);

//         function ondel(err, res, req, body) {
//             t.ifErr(err, 'rm container');
//             t.end();
//         }
//     });

//     tt.test('docker create with 2GB memory', function (t) {
//         var MEMORY_IN_MBS = CONFIG.defaultMemory * 2;
//         var memory = MEMORY_IN_MBS * BYTES_IN_MB;

//         h.createDockerContainer({
//             vmapiClient: VMAPI,
//             dockerClient: DOCKER_ALICE,
//             test: t,
//             extra: { 'HostConfig.Memory': memory }
//         }, oncreate);

//         function oncreate(err, result) {
//             t.ifErr(err, 'create container');
//             created = result;
//             t.equal(created.vm.ram, MEMORY_IN_MBS,
//                     'VM should be created with ' + MEMORY_IN_MBS
//                     + 'MBs of RAM');
//             t.end();
//         }
//     });

//     tt.test('docker rm', function (t) {
//         DOCKER_ALICE.del('/containers/' + created.id, ondel);

//         function ondel(err, res, req, body) {
//             t.ifErr(err, 'rm container');
//             t.end();
//         }
//     });

//     tt.test('docker create with invalid memory',
//             function (t) {
//         h.createDockerContainer({
//             vmapiClient: VMAPI,
//             dockerClient: DOCKER_ALICE,
//             test: t,
//             extra: { 'HostConfig.Memory': 'Foo' }
//         }, oncreate);

//         function oncreate(err, result) {
//             t.ifErr(err, 'create container');
//             created = result;
//             t.equal(created.vm.ram, CONFIG.defaultMemory,
//                     'VM should be created with ' + CONFIG.defaultMemory
//                     + 'MBs of RAM');
//             t.end();
//         }
//     });

//     tt.test('docker rm', function (t) {
//         DOCKER_ALICE.del('/containers/' + created.id, ondel);

//         function ondel(err, res, req, body) {
//             t.ifErr(err, 'rm container');
//             t.end();
//         }
//     });
// });


// test('api: create with env var that has no value (DOCKER-741)', function (tt) {
//     tt.test('create empty-env-var container', function (t) {
//         h.createDockerContainer({
//             vmapiClient: VMAPI,
//             dockerClient: DOCKER_ALICE,
//             test: t,
//             extra: { 'Env': ['ENV_NO_VALUE'] },
//             start: true  // Will start the container after creating.
//         }, oncreate);

//         function oncreate(err, result) {
//             t.ifErr(err, 'create empty-env-var container');
//             t.equal(result.vm.state, 'running', 'Check container running');
//             DOCKER_ALICE.del('/containers/' + result.id + '?force=1', ondelete);
//         }

//         function ondelete(err) {
//             t.ifErr(err, 'delete empty-env-var container');
//             t.end();
//         }
//     });
// });

test('ensure fabrics enabled', function (tt) {
    tt.test('fabric configuration', function (t) {
        var listOpts = {};
        var listParams = {};
        NAPI.listFabricVLANs(ALICE.account.uuid, listOpts, listParams,
            function (err, vlans) {
                if (err) {
                    FABRICS = false;
                    if (err.code !== 'PreconditionRequiredError') {
                        t.ifErr(err);
                    }
                } else {
                    FABRICS = true;
                }
                t.end();
        });
    });
});


/*
 * Creates two fabric networks, with the second named using the uuid of the
 * first, used to test HostConfig.NetworkMode handling.
 */
test('fabric setup', function (tt) {
    // set fabric status

    var fVlan;
    var fNetwork1;
    var fNetwork2;

    if (!FABRICS) {
        tt.end();
        return;
    }

    tt.test('fabric vlan setup', function (t) {
        // create a new one.
        var fabricParams = {
            name: 'alicetest',
            description: 'integration test fixture',
            vlan_id: 4
        };
        h.getOrCreateFabricVLAN(NAPI, ALICE.account.uuid, fabricParams,
            function (err, vlan) {
                t.ifErr(err, 'create fabric vlan');
                fVlan = vlan;
                t.end();
                return;
            }
        );
    });

    tt.test('fabric network setup', function (t) {
        var nw1uuid = libuuid.create();
        var nw2uuid = nw1uuid.replace(/-/g, '').substr(0, 12);

        var nw1params = {
            name: 'alicetest1',
            subnet: '10.0.8.0/24',
            provision_start_ip: '10.0.8.2',
            provision_end_ip: '10.0.8.254',
            uuid: nw1uuid,
            gateway: '10.0.8.1',
            resolvers: ['8.8.8.8', '8.8.4.4']
        };

        // Must ignore the common naming convenetion for the sake of testing.
        var nw2params = {
            name: nw2uuid,
            subnet: '10.0.9.0/24',
            provision_start_ip: '10.0.9.2',
            provision_end_ip: '10.0.9.254',
            gateway: '10.0.9.1',
            resolvers: ['8.8.8.8', '8.8.4.4']
        };

        vasync.pipeline({
            funcs: [
                function fnw1(_, cb) {
                    h.getOrCreateFabricNetwork(NAPI, ALICE.account.uuid,
                        fVlan.vlan_id, nw1params, function (err, network) {
                            if (err) {
                                return cb(err);
                            }
                            nw2params.name =
                                network.uuid.replace(/-/g, '').substr(0, 12);
                            return cb(null, network);
                        }
                    );
                },
                function fnw2(_, cb) {
                    h.getOrCreateFabricNetwork(NAPI, ALICE.account.uuid,
                        fVlan.vlan_id, nw2params, cb);
                }
            ]
        }, function (err, results) {
            t.ifErr(err, 'create networks');
            if (err) {
                t.end();
                return;
            }
            fNetwork1 = results.operations[0].result;
            fNetwork2 = results.operations[1].result;
            t.end();
        });
    });

    // attempt a create with a name.
    tt.test('create with a network name', function (t) {
        h.createDockerContainer({
            vmapiClient: VMAPI,
            dockerClient: DOCKER_ALICE,
            test: t,
            extra: { 'HostConfig.NetworkMode': fNetwork1.name },
            start: true
        }, oncreate);

        function oncreate(err, result) {
            t.ifErr(err, 'create NetworkMode: networkName');
            var nics = result.vm.nics;
            t.equal(nics[0].network_uuid, fNetwork1.uuid, 'correct network');
            DOCKER_ALICE.del('/containers/' + result.id + '?force=1', ondelete);
        }

        function ondelete(err) {
            t.ifErr(err, 'delete network testing container');
            t.end();
        }
    });

    tt.test('create with a complete network id', function (t) {
        var fullId = (fNetwork1.uuid + fNetwork1.uuid).replace(/-/g, '');

        h.createDockerContainer({
            vmapiClient: VMAPI,
            dockerClient: DOCKER_ALICE,
            test: t,
            extra: { 'HostConfig.NetworkMode': fullId },
            start: true
        }, oncreate);

        function oncreate(err, result) {
            var nics = result.vm.nics;
            t.equal(nics.length, 1, 'only one nic');
            t.equal(nics[0].network_uuid, fNetwork1.uuid, 'correct network');
            DOCKER_ALICE.del('/containers/' + result.id + '?force=1', ondelete);
        }

        function ondelete(err) {
            t.ifErr(err, 'delete network testing container');
            t.end();
        }
    });

    tt.test('create with partial network id', function (t) {
        var partialId = (fNetwork1.uuid + fNetwork1.uuid).replace(/-/g, '');
        partialId = partialId.substr(0, 10);

        h.createDockerContainer({
            vmapiClient: VMAPI,
            dockerClient: DOCKER_ALICE,
            test: t,
            extra: { 'HostConfig.NetworkMode': partialId },
            start: true
        }, oncreate);

        function oncreate(err, result) {
            var nics = result.vm.nics;
            t.equal(nics.length, 1, 'only one nic');
            t.equal(nics[0].network_uuid, fNetwork1.uuid, 'correct network');
            DOCKER_ALICE.del('/containers/' + result.id + '?force=1', ondelete);
        }

        function ondelete(err) {
            t.ifErr(err, 'delete network testing container');
            t.end();
        }
    });

    tt.test('create with ambiguous name/network id', function (t) {
        // we named fNetwork2 after the uuid of fNetwork1.

        h.createDockerContainer({
            vmapiClient: VMAPI,
            dockerClient: DOCKER_ALICE,
            test: t,
            extra: { 'HostConfig.NetworkMode': fNetwork2.name },
            start: true
        }, oncreate);

        function oncreate(err, result) {
            var nics = result.vm.nics;
            t.equal(nics.length, 1, 'only one nic');
            t.equal(nics[0].network_uuid, fNetwork2.uuid, 'correct network');
            DOCKER_ALICE.del('/containers/' + result.id + '?force=1', ondelete);
        }

        function ondelete(err) {
            t.ifErr(err, 'delete network testing container');
            t.end();
        }
    });

    tt.test('create with a network that doesn\'t exist', function (t) {
        h.createDockerContainer({
            vmapiClient: VMAPI,
            dockerClient: DOCKER_ALICE,
            test: t,
            extra: { 'HostConfig.NetworkMode': 'netmodefoobar' },
            expectedErr: 'unable to find network matching netmodefoobar',
            start: true
        }, oncreate);

        function oncreate(err, result) {
            t.ok(err, 'should err on create');
            t.end();
        }
    });

    // XXX - can't delete the network without deleting the NAT zone.
    // how can we grab the nat zone to clean up?
});

test('cleanup', function (tt) {
    tt.test('delete nginx image', function (t) {
        DOCKER_ALICE.del('/images/nginx', ondel);
        function ondel(err, req, res) {
            t.error(err, 'should be no error deleting nginx');
            t.end();
        }
    });
});
