import express from "express";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Flutterwave from "flutterwave-node-v3";
import got from "got";
import dotenv from "dotenv";

dotenv.config();

const router = Router();
const dirname = path.dirname(fileURLToPath(import.meta.url));

//FOR TRANSACTION ROUTE: Update server to Load User Data
let usersData = {};
try {
  const dataPath = path.join(dirname, "..", "data", "users.json");
  const data = fs.readFileSync(dataPath, 'utf8');
  usersData = JSON.parse(data);
} catch (err) {
  console.error('Error reading users data:', err);
}

//Flutterwave configuration
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY,
);

// Generate a unique transaction reference
function generateTransactionReference() {
  const date = new Date();
  // const timestamp = date.getTime();
  return `${uuidv4()}`;
}

//Testing flutterwaveRoutes
router.get("/testFlutterwave", (req, res) => {
  res.send("testFlutterwave says hello! 👋");
});

// Endpoint to initiate a payment for Uganda mobile money (MTN and Airtel only supported)
router.post("/mobile-money-pay", async (req, res) => {
  const { phone_number, network, amount, email, redirect_url, meta } = req.body;
  console.log(req.body);
  const payload = {
    phone_number,
    network,
    amount,
    currency: "UGX",
    email,
    redirect_url,
    tx_ref: generateTransactionReference(),
    meta,
  };

  try {
    const response = await flw.MobileMoney.uganda(payload);
    console.log(`${network} Payment Response: `, JSON.stringify(response));
    res.json({ response, tx_ref: payload.tx_ref });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/card-payment", async (req, res) => {
  try {
    console.log("meta data: ", JSON.stringify(req.body));
    const response = await got
      .post("https://api.flutterwave.com/v3/payments", {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        },
        json: {
          ...req.body, // Required data from your frontend
        },
      })
      .json();
    console.log("Data card payment: ", JSON.stringify(response));
    res.json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Verify transaction status
router.get("/verify-payment/:transactionId", async (req, res) => {
  const { transactionId } = req.params; // Use transactionId from the route params
  console.log("transactionId: ", transactionId);
  try {
    const response = await flw.Transaction.verify({ id: transactionId });

    console.log("Verifying transaction: ", response);

    if (response.data.status === "successful") {
      // Success! Confirm the customer's payment
      res.json({
        status: "success",
        message: "Payment successful",
        transactionData: response.data,
      });
    } else {
      // Inform the customer their payment was unsuccessful
      res.json({ status: "failure", message: "Payment unsuccessful" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

//Fetch All transactions
// router.get('/transactions', async (req, res) => {
//   // Get the date range from the query params or set default to the last 90 days
//   let { from, to, days } = req.query;
//   const today = new Date();

//   if (days) {
//     // Calculate 'from' based on the 'days' provided and set 'to' to today's date
//     const daysAgo = new Date(today);
//     daysAgo.setDate(today.getDate() - days);
//     from = daysAgo.toISOString().split('T')[0]; // Formats the date as 'YYYY-MM-DD'
//     to = today.toISOString().split('T')[0];     // Sets 'to' to today's date
//   } else {
//     // Default range if no days or specific dates provided
//     if (!from && !to) {
//       const ninetyDaysAgo = new Date(today);
//       ninetyDaysAgo.setDate(today.getDate() - 90);
//       from = ninetyDaysAgo.toISOString().split('T')[0];
//       to = today.toISOString().split('T')[0];
//     }
//   }

//   const payload = { from, to };

//   try {
//     const response = await flw.Transaction.fetch(payload);
//     console.log('Fetched Transactions:', response);
//     res.status(200).send(response);
//   } catch (error) {
//     console.error('Error fetching transactions:', error);
//     res.status(500).send({ error: 'Failed to fetch transactions', details: error });
//   }
// });
// Fetch All transactions
router.get('/transactions', async (req, res) => {
  // Get the date range from the query params or set default to the last 90 days
  let { from, to, days } = req.query;
  const today = new Date();

  if (days) {
    // Calculate 'from' based on the 'days' provided and set 'to' to today's date
    const daysAgo = new Date(today);
    daysAgo.setDate(today.getDate() - days);
    from = daysAgo.toISOString().split('T')[0]; // Formats the date as 'YYYY-MM-DD'
    to = today.toISOString().split('T')[0];     // Sets 'to' to today's date
  } else {
    // Default range if no days or specific dates provided
    if (!from && !to) {
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 90);
      from = ninetyDaysAgo.toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
    }
  }

  const payload = { from, to };

  try {
    const response = await flw.Transaction.fetch(payload);
    console.log('Fetched Transactions:', response);

    const transactions = response.data.map(tx => {
      const filteredTx = {
        userId: tx.meta.userId,
        id: tx.id,
        txRef: tx.tx_ref,
        amount: tx.amount,
        currency: tx.currency,
        createdAt: tx.created_at,
        status: tx.status,
        name: tx.customer.name !== 'Anonymous Customer' ? tx.customer.name : 'Anonymous',
        description: tx.meta.description,
        userType: 'Unknown' // Default user type
      };

      // Replace 'Anonymous' with the user's name if necessary and set user type
      if (filteredTx.name === 'Anonymous' && tx.meta && tx.meta.userId) {
        const userId = tx.meta.userId;

        // Search through all user types
        for (const userType of Object.keys(usersData)) {
          const user = usersData[userType].find(u => u.userId === userId);
          if (user) {
            filteredTx.name = `${user.firstName} ${user.lastName}`;
            filteredTx.userType = userType; // Assign the user type from users.json
            break; // Stop searching once found
          }
        }
      }

      return filteredTx;
    });

    res.status(200).json({
      status: 'success',
      message: 'Transactions fetched',
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).send({ error: 'Failed to fetch transactions', details: error });
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
