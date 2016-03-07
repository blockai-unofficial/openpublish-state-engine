# Open Publish State Engine

This [Open Publish](https://github.com/blockai/openpublish) state engine reads and validates an ordered list of Open Publish operations from the public access Bitcoin blockchain to compute a state of ownership.

## Installation and Use

```npm install openpublish-state-engine```

Like all Bitcoin metaprotocols, the Open Publish state engine needs access to a Bitcoin blockchain and a place to store validated metadata.

```js
var openpublishStateEngine = require('./')({
  commonBlockchain: commonBlockchain,
  openpublishOperationsStore: openpublishOperationsStore
})
```

Open Publish adheres to the [Common Blockchain](https://github.com/blockai/abstract-common-blockchain) interface and will work with any valid adapter, including  [```rpc-common-blockchain```](https://github.com/blockai/rpc-common-blockchain) and the useful for testing [```mem-common-blockchain```](https://github.com/blockai/mem-common-blockchain). There is limited support for 3rd parties like Blocktrail or Blockcypher as most blockchain API providers do not have have access to the full block data. 

It is recommended to have bitcoind running locally to the state engine and to use [```rpc-common-blockchain```](https://github.com/blockai/rpc-common-blockchain) in production.

## Open Publish Operations Store

The Open Publish state engine need a place to store and query valid registration and transfer operations as well as a place to store valid tips.

You can see a full [in-memory implementation](https://github.com/blockai/openpublish-state-engine/blob/master/mem-openpublish-operations-store.js) and how it is used in this project's [test suite](https://github.com/blockai/openpublish-state-engine/blob/master/test.js).

Production versions should implement their own data store using a more permanent solution such as LevelDB or Postgres.

```js
var openpublishOperationStore = {
  pushOp: function (openpublishOperation, callback) {
    callback(false, exists)
  },
  pushTip: function (tip, callback) {
    callback(false, exists)
  },
  pushDividendPayment: function (payment, callback) {
  },
  findTips: function (options, callback) {
    callback(false, matchingTips)
  },
  findDividendPayments: function (options, callback) {
  },
  findTransfers: function (options, callback) {
    callback(false, matchingOperations)
  },
  findRegistration: function (options, callback) {
    callback(false, registration)
  },
  latest: function (callback) {
    callback(false, latestOperation)
  },
  invalidateBlock: function (blockId, callback) {
    callback(false, didInvalidate)
  }
}
```

#### pushOp

Add the operation to the stack of valid Open Publish operations. 

There should be unique constraint on ```openpublishOperation.txid```.

This should only be called on valid operations as determined by ```openpublishStateEngine.validateOpenpublishOperation()```.

#### pushTip

Add the tip to the stack of valid Open Tips.

There should be a unique constraint on ```tip.txid```.

This should only be called on valid tips as determined by ```openpublishStateEngine.validateOpenTip()```.

#### pushDividendPayment

Add the dividend payment to the stack of valid Open Tips dividend payments.

There should be a unique constraint on ```payment.txid```.

This should only be called on valid tips as determined by ```openpublishStateEngine.validateOpenTipDividendPayment()```.

#### findTips

Given an ```options.sha1```, an ```options.destinationAddress``` or an ```options.sourceAddress```, should return all matching valid Open Tips.

#### findDividendPayments

Given an ```options.sha1```, an ```options.destinationAddress``` or an ```options.sourceAddress```, should return all matching valid Open Tip dividend payments.

#### findTransfers

Given an ```options.sha1``` or an ```options.assetAddress```, should return all matching valid Open Publish transfer operations.

#### findRegistration

Given an ```options.sha1```, should find the single valid Open Publish registration.

#### latest

Should return the latest valid Open Publish operation.

#### invalidateBlock

Should remove all operations, tips and dividend payments for the given ```blockId```.

## Running The Open Publish State Engine

The state engine needs to sync to a Bitcoin blockchain. It does this by reading every transaction in every block and validating every operation.

### openpublishStateEngine.scanFrom

```js
openpublishStateEngine.scanFrom({
  blockHeight: 0,
  onBlock: function (err, blockInfo) {},
  onTx: function(err, tx) {},
  onOperation: function (err, validOpenpublishOperations, blockInfo) {},
  onTip: function (err, tip) {}
}, function (err, status) {

})
```

There are callbacks during the scanning a syncronization process for both the raw blocks and raw transactoins with ```onBlock``` and ```onTx``` respectively.

Additionally, after every block where valid Open Publish operations were found, the ```onOperation``` function is called and for every tip, ```onTip```.

After every block has been parsed by the state engine there is an additional ending callback.

It is possible to start the scan from an arbitrary ```options.blockHeight``` or ```options.blockId``` and up to a certain ```options.toBlockHeight```.

## Validating Open Publish Operations

Since anyone can write whatever they want to the Bitcoin blockchain, we need a mechanism that follows a set of rules in order to enforce the validity of claims, as technically valid Open Publish registrations and transfers need to be compared to the existing valid operations.

### openpublishStateEngine.validateOpenpublishOperation

```js
openpublishStateEngine.validateOpenpublishOperation(operation, tx, function(err, valid) {
  
})
```

### How it works

There are a set of simple conditions for valid registration and transfer operations.

#### Register

As per most code related to registering ownership, "between two conflicting transfers, the one executed first prevails if it is recorded".

```js
openpublishOperationsStore.findRegistration({sha1: newRegistration.sha1}, function (err, existingRegistration) {
  // only the first registration is valid
  var valid = !existingRegistration
})
```

#### Transfer

And of course valid transfers are contingent on the balances of the accounts involved.

```js
getAssetBalance({sha1: newTransfer.sha1, assetAddress: newTransfer.assetAddress}, function (err, assetBalance) {
  var valid = assetBalance > newTransfer.assetValue
})
```

## Computing Asset Balance

Given a document's ```options.sha1``` and a Bitcoin wallet ```options.assetAddress```, we compute current ```assetBalance```.

### openpublishStateEngine.getAssetBalance

```js
openpublishStateEngine.getAssetBalance({sha1: sha1, assetAddress:wallet.address}, function (err, assetBalance) {

})
```

### How it works

Balances are computed by a sum of all related transactions for the asset and account in question.

```js
openpublishOperationsStore.findTransfers({sha1: options.sha1}, function (err, existingValidTransfers) {
  openpublishOperationsStore.findRegistration(options, function (err, existingRegistration) {
    var assetBalance = 0
    if (existingRegistration && existingRegistration.addr === options.assetAddress) {
      assetBalance += ONE_HUNDRED_MILLION
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
```

## Computing Capitalization Table

We can also compute the full ```capTable``` for a given ```options.sha1```.

### openpublishStateEngine.getCapitalizationTable

```js
openpublishStateEngine.getCapitalizationTable({sha1: sha1}, function (err, capTable) {
  // capTable object
  { 
    msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ: 99960000,
    mwaj74EideMcpe4cjieuPFpqacmpjtKSk1: 10000,
    mjM1Zrm8JGnCF4hENLy4TdP9fEL5QWyp59: 30000 
  }
})
```

### How it works

The cap table is computed by iterating over all valid transactions including the intial registration.

Please note that the cap table always sums to default registration value of 100,000,000.

## Validating Open Tips

### openpublishStateEngine.validateOpenTip

```js
openpublishStateEngine.validateOpenTip(tip, tx, function(err, valid) {
  
})
```

### How it works

Valid tips need to be directed to the original account with the matching ```sha1``` registration.

```js
openpublishOperationsStore.findRegistration({sha1: sha1}, function (err, existingRegistration) {
  var valid = existingRegistration && existingRegistration.addr === tipDestinationAddress
})
```

## Computing Dividends Payable Table

We can compute the dividends that are owed to each asset holder.

### openpublishStateEngine.getOpenTipDividendsPayableTable

```js
openpublishStateEngine.getOpenTipDividendsPayableTable({sha1: sha1}, function(err, dividendsPayableTable) {
  // dividendsPayableTable object
  { 
    msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ: -5000,
    mwaj74EideMcpe4cjieuPFpqacmpjtKSk1: 5000 
  }
}
```

### How it works

We do this by looking at each Open Tip and computing the cap table at the time the tip was mined. This means that different tips for the same ```sha1``` could have different cap tables.

```js
openpublishStateEngine.getCapitalizationTable({sha1: sha1, tip: tip}, function (err, capTable) {
  // capTable object
  { 
    msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ: 50000000,
    mwaj74EideMcpe4cjieuPFpqacmpjtKSk1: 50000000
  }
})
```

The dividends payable to each address is the tip amount multiplied by the percent holdings of the asset.

```js
for (var address in capTable) {
  var percentage = capTable[address] / ONE_HUNDRED_MILLION
  var dividendPayable = parseFloat((tipAmount * percentage).toFixed(10))
  if (existingRegistration.addr === address) {
    modifyTable(address, -dividendPayable)
  } else {
    modifyTable(address, dividendPayable)
  }
}
```

Followed by accounting for all existing dividend payments.

```js
openpublishOperationsStore.findDividendPayments({sha1: sha1}, function (err, payments) {
  payments.forEach(function (payment) {
    var address = payment.tipDestinationAddresses[0]
    modifyTable(address, -payment.tipAmount)
    modifyTable(existingRegistration.addr, payment.tipAmount)
  })
  callback(err, dividendsPayableTable)
})
```

## Validating Open Tip Dividend Payments

### openpublishStateEngine.validateOpenTipDividendPayment

```js
openpublishStateEngine.validateOpenTipDividendPayment(payment, tx, function(err, valid) {
  
})
```

### How it works

Valid dividend payments need to be directed to one of the addresses in the cap table while coming from the registration address.

```js
var validSource = existingRegistration && existingRegistration.addr === tipSourceAddress
getCapitalizationTable({sha1: sha1}, function (err, capTable) {
  var valid = validSource && capTable[tipDestinationAddress] && capTable[tipDestinationAddress] > 0
  callback(err, valid)
})
```
