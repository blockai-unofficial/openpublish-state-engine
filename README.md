# openpublish-state-engine
Processes the Bitcoin blockchain to render a state of ownership of documents that have been registered with Open Publish.

the Open Publish State Engine expects to connect to a bsync compatible client, which has, amongst other interfaces, a postgres client for a bsync compatible schema database as well as a bitcoind json-rpc connection

## how it works

it scans through every single block using the bitcoin json-rpc or some other method

it processes each block and each transaction in order and returns an ordered list of openpublish operations

once it has an ordered list of openpublish operations, it processes them one-by-one.

### processOperation

when it finds a ```register``` operation

```sql
BEGIN
INSERT into opendocs
INSERT into opendoc_owners
COMMIT
```
  
when it finds a ```transfer``` operation

```sql
BEGIN
# check to see if the person transfering shares has enough
# if new owner
INSERT into opendoc_owners
# if existing owner
UPDATE opendoc_owners
COMMIT
```
  
when it finds a register operation on a doc that has been published already, ignore it
  
when it finds a transfer where the person doesn't have enough shares, ignore it

should processOperation be a [postgres procedure?](http://www.postgresql.org/docs/9.3/static/plpgsql-trigger.html#PLPGSQL-TRIGGER-EXAMPLE)

or should it be written for every language implementation?
  
## state snapshots 

trusted state that has been computed to a known blockheight matching a known blockhash
can be used in place of starting from the genesis block

perhaps a snapshot is taken every 144 blocks, or about once a day

how long does it take save a snapshot? how long does it take to load a snapshot?

## rollback-and-reapply

after a reorg, the state of the database must be reverted back to a state previous to the reorg
and then all blocks since must be re-processed

how long does it take to reapply all of the openpublish operations in 144 blocks?

## preorder operation

there's an issue with people front-running registration operations that we've known about for some time

we'll have to eventually make a preoreder operation that works similar to namecoin and blockstore

blind the sha1 that you're wanting to register, embed that, then wait 3 confirmations before you register

however, I don't think we should implement it just yet...

## purposefully shipping without preorder so we can figure out process for hardforks and big ammendments

I'd like for us to get the rest of the system functioning before creating this operation as I would like to use the oppurtunity to figure out the best way to have a hard fork

we're bound to be missing something else so we'll have to have hard forks in the future

it will be nice figuring out this process while we have a problem with a known solution, so when we have to fix a problem with an unknown solution, we're better equiped at rolling out the changes

i imagine that we'll have to update a decent amount of code across a number of repos and language implementations, so we should have a procedure in place for such a moment.

## test blocks

we should create a number of test blocks to use for testing.

that is, the complete block, in hex format, containing all data and all transactions

we can use this to make sure our state engine is working by inputing a few blocks and getting the expected state of the postgres after the sync is complete

we can also make sure that rollbacks work
