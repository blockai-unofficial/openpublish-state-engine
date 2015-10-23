var openpublish = require('openpublish')
var opentip = require('openpublish/src/opentip')
var async = require('async')

var ONE_HUNDRED_MILLION = 100000000

module.exports = function (options) {
  var commonBlockchain = options.commonBlockchain
  var openpublishOperationsStore = options.openpublishOperationsStore

  var blockcastStateEngine = options.blockcastStateEngine || require('blockcast-state-engine')({ commonBlockchain: commonBlockchain })

  var getAssetBalance = function (options, callback) {
    var sha1 = options.sha1
    openpublishOperationsStore.findTransfers({sha1: sha1}, function (err, existingValidTransfers) {
      if (err) { } // TODO
      openpublishOperationsStore.findRegistration({sha1: sha1}, function (err, existingRegistration) {
        if (err) { } // TODO
        var assetBalance = 0
        if (existingRegistration && existingRegistration.addr === options.assetAddress) {
          assetBalance += ONE_HUNDRED_MILLION // || existingRegistration.value
        }
        existingValidTransfers.forEach(function (transfer) {
          if (transfer.bitcoinAddress === options.assetAddress) {
            assetBalance += transfer.assetValue
          }
          if (transfer.assetAddress === options.assetAddress) {
            assetBalance -= transfer.assetValue
          }
        })
        callback(false, assetBalance)
      })
    })
  }

  var getCapitalizationTable = function (options, callback) {
    var sha1 = options.sha1
    var capTable = {}
    var modifyTable = function (address, value) {
      if (!capTable[address]) {
        capTable[address] = value
      } else {
        capTable[address] += value
      }
    }
    openpublishOperationsStore.findTransfers({sha1: sha1}, function (err, existingValidTransfers) {
      if (err) { } // TODO
      openpublishOperationsStore.findRegistration({sha1: sha1}, function (err, existingRegistration) {
        if (err) { } // TODO
        modifyTable(existingRegistration.addr, ONE_HUNDRED_MILLION)
        existingValidTransfers.forEach(function (transfer) {
          var tip = options.tip
          if (tip && transfer.blockHeight >= tip.blockHeight) {
            return
          }
          modifyTable(transfer.bitcoinAddress, transfer.assetValue)
          modifyTable(transfer.assetAddress, -transfer.assetValue)
        })
        callback(err, capTable)
      })
    })
  }

  var getBatchAssetBalances = function (options, callback) {
    var assetBalances = []
    var assetAddresses = options.assetAddresses
    async.each(assetAddresses, function (assetAddress, next) {
      getAssetBalance({sha1: options.sha1, assetAddress: assetAddress}, function (err, assetBalance) {
        if (err) { } // TODO
        assetBalances.push(assetBalance)
        next()
      })
    }, function (err) {
      if (err) { } // TODO
      callback(false, assetBalances)
    })
  }

  var getOpenTipDividendsPayableTable = function (options, callback) {
    var dividendsPayableTable = {}
    var sha1 = options.sha1
    var modifyTable = function (address, value) {
      if (!dividendsPayableTable[address]) {
        dividendsPayableTable[address] = value
      } else {
        dividendsPayableTable[address] += value
      }
    }
    openpublishOperationsStore.findRegistration({sha1: sha1}, function (err, existingRegistration) {
      if (err) { } // TODO
      openpublishOperationsStore.findTips({sha1: sha1}, function (err, tips) {
        if (err) { } // TODO
        async.each(tips, function (tip, next) {
          getCapitalizationTable({sha1: sha1, tip: tip}, function (err, capTable) {
            if (err) { } // TODO
            var tipAmount = tip.tipAmount
            for (var address in capTable) {
              var percentage = capTable[address] / ONE_HUNDRED_MILLION
              var dividendPayable = parseFloat((tipAmount * percentage).toFixed(10))
              if (existingRegistration.addr === address) {
                modifyTable(address, -dividendPayable)
              } else {
                modifyTable(address, dividendPayable)
              }
            }
            next()
          })
        }, function (err) {
          if (err) { } // TODO
          openpublishOperationsStore.findDividendPayments({sha1: sha1}, function (err, payments) {
            payments.forEach(function (payment) {
              var address = payment.tipDestinationAddresses[0]
              modifyTable(address, -payment.tipAmount)
              modifyTable(existingRegistration.addr, payment.tipAmount)
            })
            callback(err, dividendsPayableTable)
          })
        })
      })
    })
  }

  var validateOpenpublishOperation = function (operation, tx, callback) {
    // As between two conflicting transfers, the one executed first prevails. - http://copyright.gov/title17/92chap2.html
    if (!operation || !operation.op) {
      return callback(false, false)
    }
    if (operation.op === 'r' && operation.sha1) {
      // Registration
      var newRegistration = openpublish.processRegistration(operation, tx)
      openpublishOperationsStore.findRegistration({sha1: newRegistration.sha1}, function (err, existingRegistration) {
        // only the first registration is valid
        var valid = !existingRegistration
        return callback(err, valid)
      })
    } else if (operation.op === 't' && operation.sha1 && operation.value > 0) {
      // Transfer
      var newTransfer = openpublish.processTransfer(operation, tx)
      getAssetBalance({sha1: newTransfer.sha1, assetAddress: newTransfer.assetAddress}, function (err, assetBalance) {
        var valid = assetBalance > newTransfer.assetValue
        return callback(err, valid)
      })
    } else {
      return callback(false, false)
    }
  }

  var validateOpenTip = function (tip, tx, callback) {
    if (!tip) {
      callback(false, false)
    }
    var sha1 = tip.openpublishSha1
    var tipDestinationAddress = tip.tipDestinationAddresses[0]
    if (!sha1 || !tipDestinationAddress) {
      callback(false, false)
    }
    openpublishOperationsStore.findRegistration({sha1: sha1}, function (err, existingRegistration) {
      var valid = existingRegistration && existingRegistration.addr === tipDestinationAddress
      callback(err, valid)
    })
  }

  var validateOpenTipDividendPayment = function (tip, tx, callback) {
    if (!tip) {
      callback(false, false)
    }
    var sha1 = tip.openpublishSha1
    var tipSourceAddress = tip.tipSourceAddresses[0]
    var tipDestinationAddress = tip.tipDestinationAddresses[0]
    if (!sha1 || !tipSourceAddress || !tipDestinationAddress) {
      callback(false, false)
    }
    openpublishOperationsStore.findRegistration({sha1: sha1}, function (err, existingRegistration) {
      var validSource = existingRegistration && existingRegistration.addr === tipSourceAddress
      if (!validSource) {
        return callback(err, validSource)
      }
      getCapitalizationTable({sha1: sha1}, function (err, capTable) {
        var valid = capTable[tipDestinationAddress] && capTable[tipDestinationAddress] > 0
        callback(err, valid)
      })
    })
  }

  var processBlockcasts = function (blockcasts, callback) {
    var validOpenpublishOperations = []
    async.each(blockcasts, function (blockcast, next) {
      var tx = blockcast.tx
      var operation
      try {
        operation = JSON.parse(blockcast.data)
      } catch (e) {
        operation = false
        return next()
      }
      validateOpenpublishOperation(operation, tx, function (err, valid) {
        if (!err && operation && valid) {
          operation.blockId = blockcast.blockId
          operation.blockTxIndex = blockcast.index
          operation.blockHeight = blockcast.blockHeight
          operation.txid = tx.txid
          openpublishOperationsStore.pushOp(operation, function (err, exists) {
            if (!err && !exists) {
              validOpenpublishOperations.push(operation)
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
        if (options.onOperation) {
          var blockcasts = blockInfo.blockcasts
          processBlockcasts(blockcasts, function (err, validOpenpublishOperations) {
            if (err) { } // TODO
            options.onOperation(err, validOpenpublishOperations, blockInfo)
          })
        }
      },
      onTransaction: function (tx, next) {
        opentip.scanSingle({
          tx: tx
        }, function (err, tip) {
          if (!err && tip) {
            validateOpenTip(tip, tx, function (err, valid) {
              if (!err && valid) {
                tip.blockHeight = tx.blockHeight
                tip.blockId = tx.blockId
                tip.txid = tx.txid
                openpublishOperationsStore.pushTip(tip, function (err, exists) {
                  if (options.onTip && !exists) {
                    options.onTip(err, tip, tx)
                  }
                  next()
                })
              } else {
                var payment = tip
                validateOpenTipDividendPayment(payment, tx, function (err, valid) {
                  if (!err && valid) {
                    payment.blockHeight = tx.blockHeight
                    payment.blockId = tx.blockId
                    payment.txid = tx.txid
                    openpublishOperationsStore.pushDividendPayment(payment, function (err, exists) {
                      if (options.onDividendPayment && !exists) {
                        options.onDividendPayment(err, payment, tx)
                      }
                      next()
                    })
                  } else {
                    next()
                  }
                })
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
    getBatchAssetBalances: getBatchAssetBalances,
    getCapitalizationTable: getCapitalizationTable,
    getOpenTipDividendsPayableTable: getOpenTipDividendsPayableTable,
    validateOpenpublishOperation: validateOpenpublishOperation,
    validateOpenTip: validateOpenTip,
    validateOpenTipDividendPayment: validateOpenTipDividendPayment
  }
}
