const Wallet = require("../");
const Transaction = require("../transaction");
const TransactionPool = require("../transaction-pool");

describe("TransactionPool", () => {
    let transactionPool, transaction, senderWallet;

    beforeEach(() => {
        transactionPool = new TransactionPool();
        senderWallet = new Wallet();
        transaction = new Transaction({
            senderWallet,
            recipient: "foo-fake-recipient",
            amount: 50,
        });
    });

    describe("setTransaction()", () => {
        it("should add a transaction", () => {
            transactionPool.setTransaction(transaction);

            expect(transactionPool.transactionMap[transaction.id]).toBe(
                transaction
            );
        });
    });

    describe("existingTransaction()", () => {
        it("should return an existing transaction given an input address", () => {
            transactionPool.setTransaction(transaction);

            expect(
                transactionPool.existingTransaction({
                    inputAddress: senderWallet.publicKey,
                })
            ).toBe(transaction);
        });
    });

    describe("validTransactions", () => {
        let validTransactions;

        beforeEach(() => {
            validTransactions = [];
            for (let i = 0; i < 10; i++) {
                transaction = new Transaction({
                    senderWallet,
                    recipient: "foo-test-recipient",
                    amount: 30,
                });
                if (i % 3 === 0) {
                    transaction.input.amount = 999999;
                } else if (1 % 3 === 1) {
                    transaction.input.signature = new Wallet().sign("bar");
                } else {
                    validTransactions.push(transaction);
                }

                transactionPool.setTransaction(transaction);
            }
        });

        it("should return valid transactions", () => {
            expect(transactionPool.validTransactions()).toEqual(validTransactions);
        });
    });
});
