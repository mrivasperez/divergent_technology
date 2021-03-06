const { v1 } = require("uuid");
const { REWARD_INPUT, MINING_REWARD } = require("../config");
const { verifySignature } = require("../util");

class Transaction {
    constructor({ senderWallet, recipient, amount, outputMap, input }) {
        // generate a unique id for transaction
        this.id = v1();

        // generate the ouput map
        this.outputMap =
            outputMap ||
            this.createOutpuMap({
                senderWallet,
                recipient,
                amount,
            });

        this.input =
            input ||
            this.createInput({
                senderWallet,
                outputMap: this.outputMap,
            });
    }

    createOutpuMap({ senderWallet, recipient, amount }) {
        const outputMap = {};
        outputMap[recipient] = amount;
        outputMap[senderWallet.publicKey] = senderWallet.balance - amount;
        return outputMap;
    }

    createInput({ senderWallet, outputMap }) {
        return {
            timestamp: Date.now(),
            amount: senderWallet.balance,
            address: senderWallet.publicKey,
            signature: senderWallet.sign(outputMap),
        };
    }

    update({ senderWallet, recipient, amount }) {
        // check if the sender has balance required
        if (amount > this.outputMap[senderWallet.publicKey]) {
            throw new Error("Amount exceeds balance");
        }

        // update recipient balance
        if (!this.outputMap[recipient]) {
            this.outputMap[recipient] = amount;
        } else {
            this.outputMap[recipient] = this.outputMap[recipient] + amount;
        }

        // subtract amount from sender key
        this.outputMap[senderWallet.publicKey] =
            this.outputMap[senderWallet.publicKey] - amount;

        // create new signature
        this.input = this.createInput({
            senderWallet,
            outputMap: this.outputMap,
        });
    }

    static validTransaction(transaction) {
        const {
            // destructure transaction props
            input: { address, amount, signature },
            outputMap,
        } = transaction;

        // calculate total for output
        const outputTotal = Object.values(outputMap).reduce(
            (total, outputAmount) => total + outputAmount
        );

        if (amount !== outputTotal) {
            console.error(`Invalid transaction from ${address}`);
            return false;
        }
        if (
            !verifySignature({ publicKey: address, data: outputMap, signature })
        ) {
            console.error(`Invalid signature from ${address}`);
            return false;
        }
        return true;
    }

    static rewardTransaction({ minerWallet }) {
        return new this({
            // overrule with reward input and reward amount
            input: REWARD_INPUT,
            outputMap: { [minerWallet.publicKey]: MINING_REWARD },
        });
    }
}

module.exports = Transaction;
