import express from "express";
import { Router } from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid"; // UUID generation for unique identifiers
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// MTN MoMo API configuration
const MOMO_SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY; //Subscription key (Primary  or Secondary key) for MoMo API. You can get this from the MoMo API portal
const momoHost = "sandbox.momodeveloper.mtn.com"; // MoMo API host
const momoTokenUrl = `https://${momoHost}/collection/token/`; // Token endpoint
const momoRequestToPayUrl = `https://${momoHost}/collection/v1_0/requesttopay`; // Request to Pay endpoint

// Endpoint: Create MoMo API User
// This endpoint creates a new API user and returns the user ID (X-Reference-Id).
// This user ID is essential for further actions like retrieving the API key.
router.post("/create-api-user", async (req, res) => {
  const apiUrl = `https://${momoHost}/v1_0/apiuser`;

  // UUID generation for use in API calls where a unique identifier is required
  let uuid = uuidv4();

  // Headers for the MoMo API request
  const headers = {
    "X-Reference-Id": uuid,
    "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
    "Content-Type": "application/json",
  };
  // Data payload for the API request
  const data = {
    providerCallbackHost: "https://2wkvf7-3000.csb.app/", // replace with your Callback url
  };

  try {
    const response = await axios.post(apiUrl, data, { headers: headers });
    console.log("Creating MTN MoMo API User \n", { userId: uuid });
    res.status(200).json({ userId: uuid }); // Returns the response from MoMo API along with the generated userId
  } catch (error) {
    console.log("Creating MTN MoMo API User \n", error);
    res
      .status(500)
      .json({ message: "Error creating API user", error: error.message });
  }
});

// Endpoint: Get Created User by User ID
// This endpoint retrieves details of a created user using their user ID.
// It's useful for validating that a user has been created successfully.
router.get("/get-created-user/:userId", async (req, res) => {
  const userId = req.params.userId;
  const apiUrl = `https://${momoHost}/v1_0/apiuser/${userId}`;
  const headers = {
    "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
  };

  try {
    const response = await axios.get(apiUrl, { headers: headers });
    console.log("Get created MTN MoMo API User \n", response);
    res.status(200).json(response.data); // Successful retrieval returns user details
  } catch (error) {
    console.log("Get created MTN MoMo API User \n", error);
    res
      .status(500)
      .json({ message: "Error retrieving created user", error: error.message });
  }
});

// Endpoint: Retrieve User API Key
// This endpoint retrieves the API key for a specific user, which is used as the password
// in user authentication when generating a MoMo token.
router.post("/retrieve-api-key/:userId", async (req, res) => {
  const userId = req.params.userId;
  const apiUrl = `https://${momoHost}/v1_0/apiuser/${userId}/apikey`;
  const headers = {
    "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
  };

  try {
    const response = await axios.post(apiUrl, {}, { headers: headers });
    console.log("Retrieve MTN MoMo API User \n", response.data.apiKey);
    res.status(200).json({ apiKey: response.data.apiKey }); // Returns the user's API key
  } catch (error) {
    console.log("Retrieve MTN MoMo API User \n", error);
    res
      .status(500)
      .json({ message: "Error retrieving API key", error: error.message });
  }
});

// Endpoint: Generate MoMo Token
// This endpoint generates a token used for authorizing payment requests.
// The token is essential for making requests to the `/request-to-pay` endpoint.
router.post("/generate-api-token", async (req, res) => {
  try {
    console.log("Token request details:\n", req.body);
    const apiUrl = momoTokenUrl;
    const { userId, apiKey } = req.body;
    const username = userId; // Username (X-Reference-Id) from user creation step
    const password = apiKey; // API Key retrieved from user API key step
    const basicAuth = "Basic " + btoa(username + ":" + password); // Basic Auth header
    const headers = {
      Authorization: basicAuth,
      "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
    };

    const response = await axios.post(apiUrl, {}, { headers: headers });
    // console.log("Generate MTN MoMo API Token \n", response);
    res.status(200).json(response.data); // Returns the generated token
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error generating API token", error: error.message });
  }
});

// Endpoint: Request to Pay
// This endpoint initiates a payment request to a specified mobile number.
// It requires a valid MoMo token and transaction details.
router.post("/request-to-pay", async (req, res) => {
  try {
    console.log("Payment request details:", req.body);
    const { total, phone, momoTokenId } = req.body;

    if (!momoTokenId) {
      return res.status(400).json({ error: "MoMo token not available" });
    }

    const externalId = uuidv4();
    const body = {
      amount: total, // Total amount for the transaction
      currency: "EUR", // Currency for the transaction
      externalId: externalId, // Unique ID for each transaction
      payer: {
        partyIdType: "MSISDN",
        partyId: phone, // Phone number of the payer
      },
      payerMessage: "Payment for order",
      payeeNote: "Payment for order",
    };

    console.log("request-to-pay - External Id: ", body.externalId);

    const paymentRefId = uuidv4(); // New UUID for the request
    console.log("request-to-pay - PaymentRefId: ", paymentRefId);
    const momoResponse = await axios.post(momoRequestToPayUrl, body, {
      headers: {
        "X-Reference-Id": paymentRefId,
        "X-Target-Environment": "sandbox",
        "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
        Authorization: `Bearer ${momoTokenId}`,
        "Content-Type": "application/json",
      },
    });

    let transaction_success = true;

    console.log("request-to-pay - Response: ");
    console.log(momoResponse.status);
    console.log(momoResponse.statusText);

    if (
      (momoResponse.status === 202) &
      (momoResponse.statusText === "Accepted")
    ) {
      console.log("request-to-pay - Transaction Successful");
    } else {
      console.log("request-to-pay - Transaction Failed");
      transaction_success = false;
    }

    res.json({
      momoResponse: momoResponse.data,
      success: transaction_success,
      paymentRefId: paymentRefId,
      externalId: externalId,
      momoTokenId: momoTokenId,
    });
  } catch (error) {
    console.error("Error in processing payment request:", error);
    res.status(500).json({ error: `An error occurred: ${error.message}` });
  }
});

// Endpoint: Get 'Request-to-Pay' Transaction Status
// This operation is used to get the status of a request to pay.
// The X-Reference-Id that was passed in the post is used as reference to the request.
// The Bearer Authentication Token generated using CreateAccessToken API Call use to make a payment request
// It is useful for confirming the status of a transaction initiated by the `/request-to-pay` endpoint.
router.get("/payment-status/:transactionId/:momoTokenId", async (req, res) => {
  console.log('PAYMENT STATUS')
  const transactionId = req.params.transactionId;
  const momoTokenId = req.params.momoTokenId;
  console.log("payment-status - Transaction Id: ", transactionId);
  const apiUrl = `https://${momoHost}/collection/v1_0/requesttopay/${transactionId}`;
  const headers = {
    "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
    Authorization: `Bearer ${momoTokenId}`,
    "X-Target-Environment": "sandbox",
  };

  try {
    const response = await axios.get(apiUrl, { headers: headers });
    console.log("payment-status - Response: ", response);
    res.json(response.data); // Returns the status of the payment transaction
  } catch (error) {
    console.error("Error in retrieving payment status:", error);
    res.status(500).json({ error: `An error occurred: ${error.message}` });
  }
});

export default router;
