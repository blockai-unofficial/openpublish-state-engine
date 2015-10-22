var test = require('tape')
var rpcCommonBlockchain = require('rpc-common-blockchain')
var openpublish = require('openpublish')
var testCommonWallet = require('test-common-wallet')
var fs = require('fs')
var File = require('file-api').File

var createOpenPublishStore = function () {
  var __validOpenpublishOperations = []
  return {
    put: function (openpublishOperation, callback) {
      __validOpenpublishOperations.push(openpublishOperation)
      callback(false, true)
    },
    findTransfers: function (options, callback) {
      var matchingOperations = []
      __validOpenpublishOperations.forEach(function (openpublishOperation) {
        if (openpublishOperation && openpublishOperation.op === 't') {
          if (options.sha1 && options.sha1 === openpublishOperation.sha1) {
            matchingOperations.push(openpublishOperation)
          } else if (options.assetAddress && options.assetAddress === openpublishOperation.assetAddress) {
            matchingOperations.push(openpublishOperation)
          } else {
            matchingOperations.push(openpublishOperation)
          }
        }
      })
      callback(false, matchingOperations)
    },
    findRegistration: function (options, callback) {
      var registration
      if (__validOpenpublishOperations.length === 0) {
        return callback(false, registration)
      }
      __validOpenpublishOperations.forEach(function (openpublishOperation) {
        if (openpublishOperation && openpublishOperation.op && openpublishOperation.op === 'r' && options.sha1 === openpublishOperation.sha1) {
          registration = openpublishOperation
        }
      })
      return callback(false, registration)
    },
    all: function (callback) {
      callback(false, __validOpenpublishOperations)
    }
  }
}

var RpcClient = require('bitcoind-rpc')
// var bitcoin = require('bitcoinjs-lib')
var env = require('node-env-file')
env('./.env', { raise: false })

var rpcuser = process.env.rpcuser
var rpcpassword = process.env.rpcpassword

var config = {
  protocol: 'http',
  user: rpcuser,
  pass: rpcpassword,
  host: '127.0.0.1',
  port: '18332'
}

var rpc = new RpcClient(config)

var commonBlockchain = rpcCommonBlockchain({
  rpc: rpc
})

var createRandomString = function (length) {
  var characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'
  var output = ''
  for (var i = 0; i < length; i++) {
    var r = Math.floor(Math.random() * characters.length)
    output += characters.substring(r, r + 1)
  }
  return output
}

var createRandomFile = function (options, callback) {
  var fileName = options.fileName
  var string = options.string
  var path = './' + fileName
  fs.writeFile(path, string, function (err) {
    if (err) { } // TODO
    callback(path)
  })
}

test('scanFrom', function (t) {
  var memOpenpublishOperationsStore = createOpenPublishStore()
  var openpublishStateEngine = require('./')({
    commonBlockchain: commonBlockchain,
    openpublishOperationsStore: memOpenpublishOperationsStore
  })
  openpublishStateEngine.scanFrom({
    blockHeight: 572949,
    toBlockHeight: 572953
  }, function (err, validOpenpublishOperations) {
    if (err) { } // TODO
    t.equal(validOpenpublishOperations.length, 1)
    t.end()
  })
})

test('getBlock', function (t) {
  var memOpenpublishOperationsStore = createOpenPublishStore()
  var openpublishStateEngine = require('./')({
    commonBlockchain: commonBlockchain,
    openpublishOperationsStore: memOpenpublishOperationsStore
  })
  openpublishStateEngine.getBlock('0000000000003585e8d4a23ec784dc845f28cc8bc0950fc68a6bc5863a10f578', function (err, validOpenpublishOperations) {
    if (err) { } // TODO
    t.equal(validOpenpublishOperations.length, 1)
    t.end()
  })
})

test('Alice registers and then Bob registers the same sha1', function (t) {
  var memCommonBlockchain = require('mem-common-blockchain')()

  var memAliceWallet = testCommonWallet({
    seed: 'test',
    network: 'testnet',
    commonBlockchain: memCommonBlockchain
  })

  var memBobWallet = testCommonWallet({
    seed: 'test1',
    network: 'testnet',
    commonBlockchain: memCommonBlockchain
  })

  var memOpenpublishOperationsStore = createOpenPublishStore()

  var memOpenpublishStateEngine = require('./')({
    commonBlockchain: memCommonBlockchain,
    openpublishOperationsStore: memOpenpublishOperationsStore
  })

  var randomBufferSize = 48
  var randomString = createRandomString(randomBufferSize)

  createRandomFile({string: randomString, fileName: 'random.txt'}, function (path) {
    var randomFile = new File(path)
    randomFile.size = randomBufferSize

    openpublish.register({
      file: randomFile,
      commonWallet: memAliceWallet,
      commonBlockchain: memCommonBlockchain
    }, function (err, receipt) {
      if (err) { } // TODO

      createRandomFile({string: randomString, fileName: 'random.txt'}, function (path) {
        var randomFile = new File(path)
        randomFile.size = randomBufferSize

        openpublish.register({
          file: randomFile,
          commonWallet: memBobWallet,
          commonBlockchain: memCommonBlockchain
        }, function (err, receipt) {
          if (err) { } // TODO
          memCommonBlockchain.Blocks.mine()

          memOpenpublishStateEngine.scanFrom({
            blockHeight: 0,
            toBlockHeight: 2
          }, function (err, validOpenpublishOperations) {
            if (err) { } // TODO
            var registration = validOpenpublishOperations[0]
            t.equal(registration.addr, memAliceWallet.address, 'Alice registered first')
            t.end()
          })
        })
      })
    })
  })
})

test('Alice registers, makes a valid transfer to Bob and then tries to transfer more than she has', function (t) {
  var assetValue = 50000
  var overValue = 100000000
  var bitcoinValue = 12345

  var memCommonBlockchain = require('mem-common-blockchain')()

  var memAliceWallet = testCommonWallet({
    seed: 'test',
    network: 'testnet',
    commonBlockchain: memCommonBlockchain
  })

  var memBobWallet = testCommonWallet({
    seed: 'test1',
    network: 'testnet',
    commonBlockchain: memCommonBlockchain
  })

  var memOpenpublishOperationsStore = createOpenPublishStore()

  var memOpenpublishStateEngine = require('./')({
    commonBlockchain: memCommonBlockchain,
    openpublishOperationsStore: memOpenpublishOperationsStore
  })

  var randomBufferSize = 48
  var randomString = createRandomString(randomBufferSize)

  createRandomFile({string: randomString, fileName: 'random.txt'}, function (path) {
    var randomFile = new File(path)
    randomFile.size = randomBufferSize

    openpublish.register({
      file: randomFile,
      commonWallet: memAliceWallet,
      commonBlockchain: memCommonBlockchain
    }, function (err, receipt) {
      if (err) { } // TODO
      var registerData = receipt.data
      var sha1 = registerData.sha1

      openpublish.transfer({
        assetValue: assetValue,
        bitcoinValue: bitcoinValue,
        ttl: 365,
        sha1: sha1,
        assetWallet: memAliceWallet,
        bitcoinWallet: memBobWallet,
        commonBlockchain: memCommonBlockchain
      }, function (err, receipt) {
        if (err) { } // TODO

        openpublish.transfer({
          assetValue: overValue,
          bitcoinValue: bitcoinValue,
          ttl: 365,
          sha1: sha1,
          assetWallet: memAliceWallet,
          bitcoinWallet: memBobWallet,
          commonBlockchain: memCommonBlockchain
        }, function (err, receipt) {
          if (err) { } // TODO
          memCommonBlockchain.Blocks.mine()

          memOpenpublishStateEngine.scanFrom({
            blockHeight: 0,
            toBlockHeight: 2
          }, function (err, validOpenpublishOperations) {
            // console.log(err, validOpenpublishOperations)
            t.equal(validOpenpublishOperations.length, 2, 'should only have 2 valid operations')
            if (err) { } // TODO
            var registration = validOpenpublishOperations[0]
            var transfer = validOpenpublishOperations[1]
            t.equal(registration.sha1, transfer.sha1, 'registration and transfer refer to same sha1')
            t.end()
          })
        })
      })
    })
  })
})

test('Alice registers and then transfers to Bob, who then transfers to Charlie, and then Bob tries to transfer more than he has to Alice', function (t) {
  var aliceToBobAssetValue = 50000
  var bobToCharlieAssetValue = 30000
  var bobToAliceOverValue = 4000000
  var bitcoinValue = 12345

  var memCommonBlockchain = require('mem-common-blockchain')()

  var memAliceWallet = testCommonWallet({
    seed: 'test',
    network: 'testnet',
    commonBlockchain: memCommonBlockchain
  })

  var memBobWallet = testCommonWallet({
    seed: 'test1',
    network: 'testnet',
    commonBlockchain: memCommonBlockchain
  })

  var memCharlieWallet = testCommonWallet({
    seed: 'test2',
    network: 'testnet',
    commonBlockchain: memCommonBlockchain
  })

  var memOpenpublishOperationsStore = createOpenPublishStore()

  var memOpenpublishStateEngine = require('./')({
    commonBlockchain: memCommonBlockchain,
    openpublishOperationsStore: memOpenpublishOperationsStore
  })

  var randomBufferSize = 48
  var randomString = createRandomString(randomBufferSize)

  createRandomFile({string: randomString, fileName: 'random.txt'}, function (path) {
    var randomFile = new File(path)
    randomFile.size = randomBufferSize

    openpublish.register({
      file: randomFile,
      commonWallet: memAliceWallet,
      commonBlockchain: memCommonBlockchain
    }, function (err, receipt) {
      if (err) { } // TODO
      var registerData = receipt.data
      var sha1 = registerData.sha1

      openpublish.transfer({
        assetValue: aliceToBobAssetValue,
        bitcoinValue: bitcoinValue,
        ttl: 365,
        sha1: sha1,
        assetWallet: memAliceWallet,
        bitcoinWallet: memBobWallet,
        commonBlockchain: memCommonBlockchain
      }, function (err, receipt) {
        // console.log(receipt)
        if (err) { } // TODO

        openpublish.transfer({
          assetValue: bobToCharlieAssetValue,
          bitcoinValue: bitcoinValue,
          ttl: 365,
          sha1: sha1,
          assetWallet: memBobWallet,
          bitcoinWallet: memCharlieWallet,
          commonBlockchain: memCommonBlockchain
        }, function (err, receipt) {
          if (err) { } // TODO

          openpublish.transfer({
            assetValue: bobToAliceOverValue,
            bitcoinValue: bitcoinValue,
            ttl: 365,
            sha1: sha1,
            assetWallet: memBobWallet,
            bitcoinWallet: memAliceWallet,
            commonBlockchain: memCommonBlockchain
          }, function (err, receipt) {
            if (err) { } // TODO
            memCommonBlockchain.Blocks.mine()

            memOpenpublishStateEngine.scanFrom({
              blockHeight: 0,
              toBlockHeight: 2
            }, function (err, validOpenpublishOperations) {
              if (err) { } // TODO

              t.equal(validOpenpublishOperations.length, 3, 'should only have 3 valid operations')
              var registration = validOpenpublishOperations[0]
              var transferAliceToBob = validOpenpublishOperations[1]
              var transferBobToCharlie = validOpenpublishOperations[2]
              t.equal(registration.sha1, transferAliceToBob.sha1, 'registration and transfer refer to same sha1')
              t.equal(registration.sha1, transferBobToCharlie.sha1, 'registration and transfer refer to same sha1')
              t.end()
            })
          })
        })
      })
    })
  })
})

test('Alice registers and then transfers to Bob, who then transfers to Charlie, and then Bob transfers some back to Alice', function (t) {
  var aliceToBobAssetValue = 50000
  var bobToCharlieAssetValue = 30000
  var bobToAliceOverValue = 10000
  var bitcoinValue = 12345

  var memCommonBlockchain = require('mem-common-blockchain')()

  var memAliceWallet = testCommonWallet({
    seed: 'test',
    network: 'testnet',
    commonBlockchain: memCommonBlockchain
  })

  var memBobWallet = testCommonWallet({
    seed: 'test1',
    network: 'testnet',
    commonBlockchain: memCommonBlockchain
  })

  var memCharlieWallet = testCommonWallet({
    seed: 'test2',
    network: 'testnet',
    commonBlockchain: memCommonBlockchain
  })

  var memOpenpublishOperationsStore = createOpenPublishStore()

  var memOpenpublishStateEngine = require('./')({
    commonBlockchain: memCommonBlockchain,
    openpublishOperationsStore: memOpenpublishOperationsStore
  })

  var randomBufferSize = 48
  var randomString = createRandomString(randomBufferSize)

  createRandomFile({string: randomString, fileName: 'random.txt'}, function (path) {
    var randomFile = new File(path)
    randomFile.size = randomBufferSize

    openpublish.register({
      file: randomFile,
      commonWallet: memAliceWallet,
      commonBlockchain: memCommonBlockchain
    }, function (err, receipt) {
      if (err) { } // TODO
      var registerData = receipt.data
      var sha1 = registerData.sha1

      openpublish.transfer({
        assetValue: aliceToBobAssetValue,
        bitcoinValue: bitcoinValue,
        ttl: 365,
        sha1: sha1,
        assetWallet: memAliceWallet,
        bitcoinWallet: memBobWallet,
        commonBlockchain: memCommonBlockchain
      }, function (err, receipt) {
        // console.log(receipt)
        if (err) { } // TODO

        openpublish.transfer({
          assetValue: bobToCharlieAssetValue,
          bitcoinValue: bitcoinValue,
          ttl: 365,
          sha1: sha1,
          assetWallet: memBobWallet,
          bitcoinWallet: memCharlieWallet,
          commonBlockchain: memCommonBlockchain
        }, function (err, receipt) {
          if (err) { } // TODO

          openpublish.transfer({
            assetValue: bobToAliceOverValue,
            bitcoinValue: bitcoinValue,
            ttl: 365,
            sha1: sha1,
            assetWallet: memBobWallet,
            bitcoinWallet: memAliceWallet,
            commonBlockchain: memCommonBlockchain
          }, function (err, receipt) {
            if (err) { } // TODO
            memCommonBlockchain.Blocks.mine()

            // the issue is that these transactions that are being created don't have the correct inputs...
            // they all seem to come from the same place...

            memOpenpublishStateEngine.scanFrom({
              blockHeight: 0,
              toBlockHeight: 2
            }, function (err, validOpenpublishOperations) {
              if (err) { } // TODO

              t.equal(validOpenpublishOperations.length, 4, 'should only have 4 valid operations')
              var registration = validOpenpublishOperations[0]
              var sha1 = registration.sha1
              var transferAliceToBob = validOpenpublishOperations[1]
              var transferBobToCharlie = validOpenpublishOperations[2]
              var transferBobToAlice = validOpenpublishOperations[3]
              memOpenpublishStateEngine.getCurrentAssetBalance({
                assetAddress: memAliceWallet.address,
                sha1: sha1
              }, function (err, aliceBalance) {
                if (err) { } // TODO

                memOpenpublishStateEngine.getCurrentAssetBalance({
                  assetAddress: memBobWallet.address,
                  sha1: sha1
                }, function (err, bobBalance) {
                  if (err) { } // TODO

                  memOpenpublishStateEngine.getCurrentAssetBalance({
                    assetAddress: memCharlieWallet.address,
                    sha1: sha1
                  }, function (err, charlieBalance) {
                    if (err) { } // TODO

                    t.equal(aliceBalance + bobBalance + charlieBalance, 100000000, 'should all add up to 100,000,000')
                    t.equal(transferAliceToBob.sha1, sha1, 'registration and transfer refer to same sha1')
                    t.equal(transferBobToCharlie.sha1, sha1, 'registration and transfer refer to same sha1')
                    t.equal(transferBobToAlice.sha1, sha1, 'registration and transfer refer to same sha1')
                    t.end()
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
