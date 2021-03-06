const bodyParser = require("body-parser");
const express = require("express");
const request = require("request");
const path = require("path");

const Blockchain = require("./blockchain/index");
const PubSub = require("./app/pubsub");
const TransactionPool = require("./wallet/transaction-pool");
const Wallet = require("./wallet");
const TransactionMiner = require("./app/transaction-miner");

const app = express();
const blockchain = new Blockchain();
const transactionPool = new TransactionPool();
const wallet = new Wallet();
const pubsub = new PubSub({ blockchain, transactionPool, wallet });
const transactionMiner = new TransactionMiner({
    blockchain,
    transactionPool,
    wallet,
    pubsub,
});

const DEFAULT_PORT = 3000;

const ROOT_NODE_ADDRESS = `http://localhost:${DEFAULT_PORT}`;

// make sure that the user has access to blockchain on connect
// use body parsor middleware to read json
app.use(bodyParser.json());

// allow server to send static files
app.use(express.static(path.join(__dirname, "./client")));

// read blockchain
app.get("/api/blocks", (req, res) => {
    res.json(blockchain.chain);
});

// mine a block
app.post("/api/mine", (req, res) => {
    // get requested data to add
    const { data } = req.body;

    // add blockchain with data
    blockchain.addBlock({ data });

    // broadcast chain
    pubsub.broadcastChain();

    res.redirect("/api/blocks");
});

// create a transaction
app.post("/api/transact", (req, res) => {
    // set amount and recipient
    const { amount, recipient } = req.body;

    // check if transaction by wallet already exists
    let transaction = transactionPool.existingTransaction({
        inputAddress: wallet.publicKey,
    });

    try {
        if (transaction) {
            transaction.update({ senderWallet: wallet, recipient, amount });
        } else {
            transaction = wallet.createTransaction({
                recipient,
                amount,
                chain: blockchain.chain,
            });
        }
    } catch (error) {
        return res.status(400).json({ type: "error", message: error.message });
    }

    transactionPool.setTransaction(transaction);

    // notify network of transaction
    pubsub.broadcastTransaction(transaction);

    res.json({ type: "success", transaction });
});

// get the transaction pool map
app.get("/api/transaction-pool-map", (req, res) => {
    res.json(transactionPool.transactionMap);
});

// mine transactions
app.get("/api/mine-transactions", (req, res) => {
    transactionMiner.mineTransactions();

    // redirect user to blocks
    res.redirect("/api/blocks");
});

// get a wallet's balance
app.get("/api/wallet-info", (req, res) => {
    const address = wallet.publicKey;

    res.json({
        address,
        balance: Wallet.calculateBalance({
            chain: blockchain.chain,
            address,
        }),
    });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "./client/index.html"));
});

// DEV ENV ONLY - to test multiple blocks being mined
let PEER_PORT;

if (process.env.GENERATE_PEER_PORT === "true") {
    PEER_PORT = DEFAULT_PORT + Math.ceil(Math.random() * 1000);
    console.log(PEER_PORT);
}

// replace local chain with most accurate chain
const syncWithRootState = () => {
    request(
        { url: `${ROOT_NODE_ADDRESS}/api/blocks` },
        (error, response, body) => {
            if (!error && response.statusCode === 200) {
                const rootChain = JSON.parse(body);
                console.log("Syncing blockchain... Done!");
                blockchain.replaceChain(rootChain);
            }
        }
    );

    request(
        { url: `${ROOT_NODE_ADDRESS}/api/transaction-pool-map` },
        (error, response, body) => {
            if (!error && response.statusCode === 200) {
                const rootTransactionPoolMap = JSON.parse(body);
                console.log("Syncing transaction pool map... Done!");
                transactionPool.setMap(rootTransactionPoolMap);
            }
        }
    );
};

const PORT = PEER_PORT || DEFAULT_PORT;

app.listen(PORT, () => {
    // syncChains when connected outside of default port
    if (PORT !== DEFAULT_PORT) return syncWithRootState();
});
