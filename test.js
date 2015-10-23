var test = require('tape')
var rpcCommonBlockchain = require('rpc-common-blockchain')
var openpublish = require('openpublish')
var testCommonWallet = require('test-common-wallet')
var fs = require('fs')
var File = require('file-api').File

var sum = function (a, b) { return a + b }

var createOpenPublishStore = function () {
  var __validOpenpublishOperations = []
  var __validOpenTips = []
  return {
    pushOp: function (openpublishOperation, callback) {
      var exists
      __validOpenpublishOperations.forEach(function (op) {
        if (openpublishOperation.txid === op.txid) {
          exists = true
        }
      })
      if (!exists) {
        __validOpenpublishOperations.push(openpublishOperation)
      }
      callback(false, exists)
    },
    pushTip: function (tip, callback) {
      var exists
      __validOpenTips.forEach(function (t) {
        if (tip.txid === t.txid) {
          exists = true
        }
      })
      if (!exists) {
        __validOpenTips.push(tip)
      }
      callback(false, exists)
    },
    findTips: function (options, callback) {
      var matchingTips = []
      __validOpenTips.forEach(function (tip) {
        if (options.sha1 && options.sha1 === tip.openpublishSha1) {
          matchingTips.push(tip)
        } else if (options.destinationAddress && tip.tipDestinationAddresses.indexOf(options.destinationAddress) > -1) {
          matchingTips.push(tip)
        } else if (options.sourceAddress && tip.tipSourceAddresses.indexOf(options.sourceAddress) > -1) {
          matchingTips.push(tip)
        } else {
          matchingTips.push(tip)
        }
      })
      callback(false, matchingTips)
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
    latest: function (callback) {
      callback(false, __validOpenpublishOperations[__validOpenpublishOperations.length - 1])
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

test('testnet scanFrom', function (t) {
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

test('testnet getBlock', function (t) {
  var memOpenpublishOperationsStore = createOpenPublishStore()
  var openpublishStateEngine = require('./')({
    commonBlockchain: commonBlockchain,
    openpublishOperationsStore: memOpenpublishOperationsStore
  })
  openpublishStateEngine.getBlock({blockId: '0000000000003585e8d4a23ec784dc845f28cc8bc0950fc68a6bc5863a10f578'}, function (err, validOpenpublishOperations) {
    if (err) { } // TODO
    t.equal(validOpenpublishOperations.length, 1)
    t.end()
  })
})

test('testnet scanFrom callbacks', function (t) {
  var memOpenpublishOperationsStore = createOpenPublishStore()
  var openpublishStateEngine = require('./')({
    commonBlockchain: commonBlockchain,
    openpublishOperationsStore: memOpenpublishOperationsStore
  })
  var registrationCount = 0
  var tipCount = 0
  openpublishStateEngine.scanFrom({
    blockHeight: 574900,
    toBlockHeight: 575000,
    onBlock: function (err, blockInfo) {
      if (err) { } // TODO
      var blockHeight = blockInfo.blockHeight
      if (blockHeight % 100 === 0) {
        process.stdout.write(blockHeight.toString())
      }
      process.stdout.write('.')
    },
    onFound: function (err, validOpenpublishOperations, blockInfo) {
      if (err) { } // TODO
      validOpenpublishOperations.forEach(function (op) {
        if (op.op === 'r') {
          registrationCount++
        }
        process.stdout.write(op.op)
      })
    },
    onTip: function (err, tip) {
      if (err) { } // TODO
      tipCount++
      process.stdout.write('t')
    }
  }, function (err, status) {
    if (err) { } // TODO
    t.equal(registrationCount, 19)
    memOpenpublishOperationsStore.findTips({}, function (err, tips) {
      t.equal(tips.length, tipCount, 'has one tip')
      t.end()
    })
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
      var registerData = receipt.data
      var sha1 = registerData.sha1

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
            memOpenpublishStateEngine.getBatchAssetBalances({
              assetAddresses: [memAliceWallet.address, memBobWallet.address],
              sha1: sha1
            }, function (err, assetBalances) {
              if (err) { } // TODO

              var aliceBalance = assetBalances[0]
              var bobBalance = assetBalances[1]
              t.equal(aliceBalance, 100000000, 'Alice should have 100,000,000')
              t.equal(bobBalance, 0, 'Bob should have 0')
              var assetBalancesSum = assetBalances.reduce(sum)
              t.equal(assetBalancesSum, 100000000, 'should all add up to 100,000,000')
              t.end()
            })
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

            memOpenpublishStateEngine.getBatchAssetBalances({
              assetAddresses: [memAliceWallet.address, memBobWallet.address],
              sha1: sha1
            }, function (err, assetBalances) {
              if (err) { } // TODO

              var aliceBalance = assetBalances[0]
              var bobBalance = assetBalances[1]
              t.equal(aliceBalance, 99950000, 'Alice should have 99,950,000')
              t.equal(bobBalance, 50000, 'Bob should have 50,000')
              var assetBalancesSum = assetBalances.reduce(sum)
              t.equal(assetBalancesSum, 100000000, 'should all add up to 100,000,000')
              t.end()
            })
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

              memOpenpublishStateEngine.getBatchAssetBalances({
                assetAddresses: [memAliceWallet.address, memBobWallet.address, memCharlieWallet.address],
                sha1: sha1
              }, function (err, assetBalances) {
                if (err) { } // TODO

                var aliceBalance = assetBalances[0]
                var bobBalance = assetBalances[1]
                var charlieBalance = assetBalances[2]
                t.equal(aliceBalance, 99950000, 'Alice should have 99,950,000')
                t.equal(bobBalance, 20000, 'Bob should have 20,000')
                t.equal(charlieBalance, 30000, 'Charlie should have 30,000')
                var assetBalancesSum = assetBalances.reduce(sum)
                t.equal(assetBalancesSum, 100000000, 'should all add up to 100,000,000')
                t.end()
              })
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
        memCommonBlockchain.Blocks.mine()
        memOpenpublishStateEngine.scanFrom({ blockHeight: 0, toBlockHeight: 1 }, function (err, validOpenpublishOperations) {
          t.equal(validOpenpublishOperations.length, 2, 'should only have 2 valid operations')

          openpublish.tip({
            destination: memAliceWallet.address,
            sha1: sha1,
            amount: 10000,
            commonWallet: memCharlieWallet,
            commonBlockchain: memCommonBlockchain
          }, function (err, tipTx) {
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
                  toBlockHeight: 3
                }, function (err, validOpenpublishOperations) {
                  if (err) { } // TODO

                  t.equal(validOpenpublishOperations.length, 2, 'should only have 2 valid operations')

                  memOpenpublishStateEngine.getBatchAssetBalances({
                    assetAddresses: [memAliceWallet.address, memBobWallet.address, memCharlieWallet.address],
                    sha1: sha1
                  }, function (err, assetBalances) {
                    if (err) { } // TODO

                    var aliceBalance = assetBalances[0]
                    var bobBalance = assetBalances[1]
                    var charlieBalance = assetBalances[2]
                    t.equal(aliceBalance, 99960000, 'Alice should have 99,960,000')
                    t.equal(bobBalance, 10000, 'Bob should have 10,000')
                    t.equal(charlieBalance, 30000, 'Charlie should have 30,000')
                    var assetBalancesSum = assetBalances.reduce(sum)
                    t.equal(assetBalancesSum, 100000000, 'should all add up to 100,000,000')

                    memOpenpublishOperationsStore.findTips({}, function (err, tips) {
                      t.equal(tips.length, 1, 'has one tip')
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
})
