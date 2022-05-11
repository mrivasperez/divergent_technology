const Block = require("../blockchain/block.js");
const { STARTING_BALANCE } = require("../config.js");
const { ec, cryptoHash } = require("../util");
const Transaction = require("./transaction.js");

class Wallet {
    constructor() {
        this.balance = STARTING_BALANCE;

        // generate public/private key pairs
        this.keyPair = ec.genKeyPair();

        // generate hex from key
        this.publicKey = this.keyPair.getPublic().encode("hex");
    }

    sign(data) {
        return this.keyPair.sign(cryptoHash(data));
    }

    createTransaction({ recipient, amount }) {
        if (amount > this.balance) {
            throw new Error("Amount exceeds balance");
        }

        return new Transaction({ senderWallet: this, recipient, amount });
    }

    static calculateBalance({ chain, address }) {
        let outputsTotal = 0;

        for(let i =1; i < chain.length; i++){
            const currentBlock = chain[i]
            for (let transaction of currentBlock.data){
                const addressOutput = transaction.outputMap[address]
                if(addressOutput) {
                    // add to total
                    outputsTotal = outputsTotal + addressOutput
                }
            }
        }

        return STARTING_BALANCE + outputsTotal
    }
}

module.exports = Wallet;
