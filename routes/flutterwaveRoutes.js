const express = require('express');
const router = express.Router();

const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');  // UUID generation for unique identifiers
const Flutterwave = require('flutterwave-node-v3');
require('dotenv').config();  // Load environment variables from .env file

const app = express();

// Middleware configuration
app.use(bodyParser.json());  // Support for JSON-encoded bodies
app.use(cors());  // Apply CORS to all routes for wider accessibility

//Flutterwave configuration
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

// Generate a unique transaction reference
function generateTransactionReference() {
    const date = new Date();
    const timestamp = date.getTime();
    const randomNumber = Math.floor(Math.random() * 1000000); // Generate a random number between 0 and 999999
    return `${timestamp}-${randomNumber}`;
}

// Endpoint to initiate a payment
app.post('/pay', async (req, res) => {
    const { phone_number, network, amount, email } = req.body;
    console.log(req.body);
    const payload = {
        phone_number,
        network,
        amount,
        currency: 'UGX',
        email,
        tx_ref: generateTransactionReference()
    };

    try {
        const response = await flw.MobileMoney.uganda(payload);
        console.log(JSON.stringify(response));
        res.json(response);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to handle webhook notifications
app.post('/webhook', (req, res) => {
    // Your webhook logic here
    console.log('Webhook hit:', req.body);
    // Implement your verification and processing logic

    res.status(200).send('Webhook received');
});

module.exports = router;
