import express from "express";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import Flutterwave from "flutterwave-node-v3";
import dotenv from "dotenv";

dotenv.config();

const router = Router();
const app = express();

//Flutterwave configuration
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY,
);

// Generate a unique transaction reference
function generateTransactionReference() {
  const date = new Date();
  const timestamp = date.getTime();
  const randomNumber = Math.floor(Math.random() * 1000000); // Generate a random number between 0 and 999999
  return `${timestamp}-${randomNumber}`;
}

// Endpoint to initiate a payment
app.post("/pay", async (req, res) => {
  const { phone_number, network, amount, email } = req.body;
  console.log(req.body);
  const payload = {
    phone_number,
    network,
    amount,
    currency: "UGX",
    email,
    tx_ref: generateTransactionReference(),
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
app.post("/webhook", (req, res) => {
  // Your webhook logic here
  console.log("Webhook hit:", req.body);
  // Implement your verification and processing logic

  res.status(200).send("Webhook received");
});

export default router;
