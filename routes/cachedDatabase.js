import fs from "fs";
import { Router } from "express";
import {
  couponTable_id,
  databases,
  database_id,
} from "../appwriteServerConfig.js";

const router = Router();

router.get("/fetch-coupons", async (req, res) => {
  const passcode = req.query.passcode; // Get the passcode from the request query

  // Check if the passcode is correct
  if (passcode !== "1234") {
    return res.status(401).json({ message: "Invalid passcode" });
  }

  try {
    // Fetch data from the "coupon" table
    const coupons = await databases.listDocuments(database_id, couponTable_id);

    // Prepare the CSV data
    let csvData = "";
    if (coupons.documents.length > 0) {
      console.log("coupons: ", coupons);
      // Get the attribute names as CSV headers
      const headers = Object.keys(coupons.documents[0]).filter(
        (key) => !key.startsWith("$"),
      );

      // Create the CSV headers
      csvData += headers.join(",") + "\n";

      // Create the CSV rows
      coupons.documents.forEach((coupon) => {
        const values = headers.map((header) => coupon[header]);
        csvData += values.join(",") + "\n";
      });
    }

    // Write the CSV data to a file
    fs.writeFileSync("coupons.csv", csvData);

    return res.json({ message: "Coupons fetched and saved to CSV file" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
