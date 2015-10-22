var openpublish = require('openpublish')
var async = require('async')

module.exports = function (options) {
  var commonBlockchain = options.commonBlockchain
  var openpublishOperationsStore = options.openpublishOperationsStore

  var blockcastStateEngine = options.blockcastStateEngine || require('blockcast-state-engine')({ commonBlockchain: commonBlockchain })

  var getCurrentAssetBalance = function (options, callback) {
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
      getCurrentAssetBalance({assetAddress: newTransfer.assetAddress, sha1: newTransfer.sha1}, function (err, currentAssetBalance) {
        if (err) { } // TODO
        var valid = currentAssetBalance > newTransfer.assetValue
        return callback(valid)
      })
    } else {
      return callback(false)
    }
  }

  var processBlockcasts = function (blockcasts, callback) {
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
          openpublishOperationsStore.put(obj, function () {
            return next()
          })
        } else {
          return next()
        }
      })
    }, function (err) {
      if (err) { } // TODO
      openpublishOperationsStore.all(function (err, validOpenpublishOperations) {
        if (err) { } // TODO
        callback(false, validOpenpublishOperations)
      })
    })
  }

  var scanFrom = function (options, callback) {
    blockcastStateEngine.scanFrom(options, function (err, blockcasts) {
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
    getCurrentAssetBalance: getCurrentAssetBalance
  }
}
