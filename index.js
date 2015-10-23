var openpublish = require('openpublish')
var opentip = require('openpublish/src/opentip')
var async = require('async')

module.exports = function (options) {
  var commonBlockchain = options.commonBlockchain
  var openpublishOperationsStore = options.openpublishOperationsStore

  var blockcastStateEngine = options.blockcastStateEngine || require('blockcast-state-engine')({ commonBlockchain: commonBlockchain })

  var getAssetBalance = function (options, callback) {
    openpublishOperationsStore.findTransfers({sha1: options.sha1}, function (err, existingValidTransfers) {
      if (err) { } // TODO
      openpublishOperationsStore.findRegistration(options, function (err, existingRegistration) {
        if (err) { } // TODO
        var currentAssetBalance = 0
        if (existingRegistration && existingRegistration.addr === options.assetAddress) {
          currentAssetBalance += 100000000 // || existingRegistration.value
        }
        existingValidTransfers.forEach(function (transfer) {
          if (transfer.bitcoinAddress === options.assetAddress) {
            currentAssetBalance += transfer.assetValue
          }
          if (transfer.assetAddress === options.assetAddress) {
            currentAssetBalance -= transfer.assetValue
          }
        })
        callback(false, currentAssetBalance)
      })
    })
  }

  var getBatchAssetBalances = function (options, callback) {
    var assetBalances = []
    var assetAddresses = options.assetAddresses
    async.each(assetAddresses, function (assetAddress, next) {
      getAssetBalance({assetAddress: assetAddress, sha1: options.sha1}, function (err, assetBalance) {
        if (err) { } // TODO
        assetBalances.push(assetBalance)
        next()
      })
    }, function (err) {
      if (err) { } // TODO
      callback(false, assetBalances)
    })
  }

  var validateOpenpublishOperation = function (obj, tx, callback) {
    // As between two conflicting transfers, the one executed first prevails. - http://copyright.gov/title17/92chap2.html
    if (!obj || !obj.op) {
      return callback(false)
    }
    if (obj.op === 'r' && obj.sha1) {
      // Registration
      var newRegistration = openpublish.processRegistration(obj, tx)
      openpublishOperationsStore.findRegistration({sha1: newRegistration.sha1}, function (err, existingRegistration) {
        if (err) { } // TODO
        // only the first registration is valid
        var valid = !existingRegistration
        return callback(valid)
      })
    } else if (obj.op === 't' && obj.sha1 && obj.value > 0) {
      // Transfer
      var newTransfer = openpublish.processTransfer(obj, tx)
      getAssetBalance({assetAddress: newTransfer.assetAddress, sha1: newTransfer.sha1}, function (err, currentAssetBalance) {
        if (err) { } // TODO
        var valid = currentAssetBalance > newTransfer.assetValue
        return callback(valid)
      })
    } else {
      return callback(false)
    }
  }

  var processBlockcasts = function (blockcasts, callback) {
    var validOpenpublishOperations = []
    async.each(blockcasts, function (blockcast, next) {
      var tx = blockcast.tx
      var obj
      try {
        obj = JSON.parse(blockcast.data)
      } catch (e) {
        obj = false
        return next()
      }
      validateOpenpublishOperation(obj, tx, function (valid) {
        if (obj && valid) {
          obj.blockId = blockcast.blockId
          obj.blockTxIndex = blockcast.index
          obj.txid = tx.txid
          openpublishOperationsStore.pushOp(obj, function (err, exists) {
            if (!err && !exists) {
              validOpenpublishOperations.push(obj)
            }
            return next()
          })
        } else {
          return next()
        }
      })
    }, function (err) {
      if (err) { } // TODO
      callback(false, validOpenpublishOperations)
    })
  }

  var scanFrom = function (options, callback) {
    blockcastStateEngine.scanFrom({
      blockHeight: options.blockHeight,
      toBlockHeight: options.toBlockHeight,
      onBlock: function (err, blockInfo) {
        if (options.onBlock) {
          options.onBlock(err, blockInfo)
        }
      },
      onFound: function (err, blockInfo) {
        if (err) { } // TODO
        if (options.onFound) {
          var blockcasts = blockInfo.blockcasts
          processBlockcasts(blockcasts, function (err, validOpenpublishOperations) {
            if (err) { } // TODO
            options.onFound(err, validOpenpublishOperations, blockInfo)
          })
        }
      },
      onTransaction: function (tx, next) {
        opentip.scanSingle({
          tx: tx
        }, function (err, tip) {
          if (!err && tip) {
            var sha1 = tip.openpublishSha1
            var tipDestinationAddress = tip.tipDestinationAddresses[0]
            // console.log('tip', sha1, tipDestinationAddress)
            openpublishOperationsStore.findRegistration({sha1: sha1}, function (err, existingRegistration) {
              // console.log(existingRegistration)
              if (err) { } // TODO
              if (existingRegistration && existingRegistration.addr === tipDestinationAddress) {
                openpublishOperationsStore.pushTip(tip, function (err, exists) {
                  if (options.onTip && !err && !exists) {
                    options.onTip(false, tip)
                  }
                  next()
                })
              } else {
                next()
              }
            })
          } else {
            next()
          }
        })
        if (options.onTx) {
          options.onTx(false, tx)
        }
      }
    }, function (err, blockcasts) {
      if (err) { } // TODO
      processBlockcasts(blockcasts, function (err, validOpenpublishOperations) {
        if (err) { } // TODO
        callback(err, validOpenpublishOperations)
      })
    })
  }

  var getBlock = function (blockId, callback) {
    blockcastStateEngine.getBlock(blockId, function (err, blockInfo) {
      if (err) { } // TODO
      var blockcasts = blockInfo.blockcasts
      processBlockcasts(blockcasts, function (err, validOpenpublishOperations) {
        callback(err, validOpenpublishOperations)
      })
    })
  }

  return {
    scanFrom: scanFrom,
    getBlock: getBlock,
    getAssetBalance: getAssetBalance,
    getBatchAssetBalances: getBatchAssetBalances
  }
}
