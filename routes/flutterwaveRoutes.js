import express from "express";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import Flutterwave from "flutterwave-node-v3";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

//Flutterwave configuration
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY,
);

// Generate a unique transaction reference
function generateTransactionReference() {
  const date = new Date();
  const timestamp = date.getTime();
  return `${timestamp}-${uuidv4()}`;
}

//Testing flutterwaveRoutes
router.get("/testFlutterwave", (req, res) => {
  res.send("testFlutterwave says hello! 👋");
});

// Endpoint to initiate a payment for Uganda mobile money (MTN and Airtel only supported)
router.post("/pay", async (req, res) => {
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
    console.log("Payment Response: /n", JSON.stringify(response));
    res.json({ response, tx_ref: payload.tx_ref });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/card-payment", async (req, res) => {
  app.post("/create-payment", async (req, res) => {
    try {
      const response = await got
        .post("https://api.flutterwave.com/v3/payments", {
          headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          },
          json: {
            ...req.body, // You can send required data from your frontend
          },
        })
        .json();

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
});

//Verify transaction status
router.get("/verifyTransaction/:transactionId", async (req, res) => {
  const { transactionId } = req.params;

  try {
    const response = await flw.Transaction.verify({ id: transactionId });

    console.log(JSON.stringify(response));

    if (response.data.status === "successful") {
      // Success! Confirm the customer's payment
      res.json({ status: "success", message: "Payment successful" });
    } else {
      // Inform the customer their payment was unsuccessful
      res.json({ status: "failure", message: "Payment unsuccessful" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to handle webhook notifications
router.post("/webhook", (req, res) => {
  // Your webhook logic here
  console.log("Webhook hit:", req.body);
  // Implement your verification and processing logic

  res.status(200).send("Webhook received");
});

export default router;
