module.exports = function () {
  var __validOpenpublishOperations = []
  var __validOpenTips = []
  var __validOpenTipDividendPayments = []
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
    pushDividendPayment: function (payment, callback) {
      var exists
      __validOpenTipDividendPayments.forEach(function (p) {
        if (payment.txid === p.txid) {
          exists = true
        }
      })
      if (!exists) {
        __validOpenTipDividendPayments.push(payment)
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
    findDividendPayments: function (options, callback) {
      var matchingPayments = []
      __validOpenTipDividendPayments.forEach(function (payment) {
        if (options.sha1 && options.sha1 === payment.openpublishSha1) {
          matchingPayments.push(payment)
        } else if (options.destinationAddress && payment.tipDestinationAddresses.indexOf(options.destinationAddress) > -1) {
          matchingPayments.push(payment)
        } else if (options.sourceAddress && payment.tipSourceAddresses.indexOf(options.sourceAddress) > -1) {
          matchingPayments.push(payment)
        } else {
          matchingPayments.push(payment)
        }
      })
      callback(false, matchingPayments)
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
    },
    invalidateBlock: function (blockId, callback) {
      // loop through and remove all transactions for the invalid blockId
      __validOpenpublishOperations.forEach(function (op) {})
      __validOpenTips.forEach(function (op) {})
      __validOpenTipDividendPayments.forEach(function (op) {})
    }
  }
}
