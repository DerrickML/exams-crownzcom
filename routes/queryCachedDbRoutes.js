import express from "express";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { constants as fsConstants } from "fs";
import { parse } from "csv-parse/sync";
import path from "path";
import dotenv from "dotenv";
import { promisify } from "util";
import { createObjectCsvWriter } from "csv-writer";
import { stringify } from "csv-stringify";
import { fileURLToPath } from "url";
import {
  databases,
  database_id,
  couponTable_id,
  couponUsagesTable_id,
  Query,
} from "../appwriteServerConfig.js";

dotenv.config();
const PLE_ATTEMPTED_QUESTIONS_FILE = process.env.PLE_ATTEMPTED_QUESTIONS_FILE;
const UCE_ATTEMPTED_QUESTIONS_FILE = process.env.UCE_ATTEMPTED_QUESTIONS_FILE;
const UACE_ATTEMPTED_QUESTIONS_FILE = process.env.UACE_ATTEMPTED_QUESTIONS_FILE;
let fileName;

const router = express.Router();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

// Retrieve User Questions History
//TODO: Fetch Question History From Database
router.get(
  "/getQtnHistory/:userId/:subjectName/:educationLevel",
  async (req, res) => {
    const { userId, subjectName, educationLevel } = req.params;
    if (subjectName && educationLevel && userId) {
      if (educationLevel === "PLE") {
        fileName = PLE_ATTEMPTED_QUESTIONS_FILE;
      }
      const filePath = path.join(dirname, "..", "data", fileName);

      try {
        const data = await readFile(filePath, "utf8");
        const records = parse(data, { columns: true, skip_empty_lines: true });

        const userRecord = records.find(
          (record) =>
            record.UserId === userId && record.SubjectName === subjectName
        );

        if (userRecord) {
          res.json({
            questionsJSON: JSON.parse(userRecord.QuestionsJSON || "{}"),
            timestamp: userRecord.Timestamp || null,
          });
        } else {
          // No history found for this user and subject
          res.json({ questionsJSON: {}, timestamp: null });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send(`Error Fecthing user ${subjectName} exam history: ${error}`);
      }
    }
    else {
      // throw new Error("Education level not provided");
      res.json(new Error)
    }
  }
);

// Update User Questions History
//TODO: Update Question History From Database
router.post("/updateQtnHistory", async (req, res) => {
  const { userId, subjectName, questionsJSON, educationLevel } = req.body;

  // Determine education level
  if (educationLevel === "PLE") {
    fileName = PLE_ATTEMPTED_QUESTIONS_FILE;
  } else if (educationLevel === "UCE") {
    fileName = UCE_ATTEMPTED_QUESTIONS_FILE;
  } else if (educationLevel === "UACE") {
    fileName = UACE_ATTEMPTED_QUESTIONS_FILE;
  } else {
    return res.status(400).send("Education level not provided");
  }

  const filePath = path.join(dirname, "..", "data", fileName);

  try {
    let fileExists = true;
    try {
      await fsPromises.access(filePath, fsConstants.F_OK);
    } catch (error) {
      fileExists = false;
    }

    let records;

    // Check if the file exists and read, otherwise initialize records as an empty array
    if (fileExists) {
      const data = await fsPromises.readFile(filePath, "utf8");
      records = parse(data, { columns: true, skip_empty_lines: true });
    } else {
      records = [];
    }

    const existingRecordIndex = records.findIndex(
      (record) => record.UserId === userId && record.SubjectName === subjectName
    );

    // logic to update or append records
    if (existingRecordIndex >= 0) {
      // Merge with existing record
      let existingQuestionsJSON = JSON.parse(
        records[existingRecordIndex].QuestionsJSON
      );

      // Iterate through each category in the existing data and update with new questions
      for (const category in questionsJSON) {
        if (existingQuestionsJSON[category]) {
          existingQuestionsJSON[category] = [
            ...new Set([
              ...existingQuestionsJSON[category],
              ...questionsJSON[category],
            ]),
          ];
        } else {
          existingQuestionsJSON[category] = questionsJSON[category];
        }
      }

      records[existingRecordIndex] = {
        UserId: userId,
        SubjectName: subjectName,
        QuestionsJSON: JSON.stringify(questionsJSON),
        Timestamp: new Date().toISOString(),
      };
    } else {
      // Append new record
      records.push({
        UserId: userId,
        SubjectName: subjectName,
        QuestionsJSON: JSON.stringify(questionsJSON),
        Timestamp: new Date().toISOString(),
      });
      console.log("Appending new user record.");
    }

    // Convert records to CSV format and write to file
    const csvString = await new Promise((resolve, reject) => {
      stringify(records, { header: true }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });

    await fsPromises.writeFile(filePath, csvString);

    res.send({ updated: `Updated user ${subjectName} exam history successfully` });
  } catch (error) {
    console.error(`Error Updating user ${subjectName} exam history: ${error}`);
    res
      .status(500)
      .send(`Error Updating user ${subjectName} exam history: ${error}`);
  }
});

// Route to validate a coupon
router.get("/validate-coupon", async (req, res) => {
  const couponCode = req.query.code;
  const userId = req.query.userId;
  const userLabel = req.query.userLabel;
  console.log('user label: ' + userLabel)

  if (!couponCode || !userId) {
    return res.status(400).json({ message: "Coupon code and user ID are required" });
  }

  try {
    const filePath = path.join(dirname, "..", "data", "coupons.csv");
    const csvData = fs.readFileSync(filePath, "utf8");
    const records = parse(csvData, { columns: true, skip_empty_lines: true });
    const coupon = records.find((c) => c.CouponCode === couponCode);

    if (!coupon || coupon.IsActive.toLowerCase() !== "true") {
      return res.status(404).json({ message: "Coupon not found or not active" });
    }

    const now = new Date();
    const validFrom = new Date(coupon.ValidFrom);
    const expiryDate = new Date(coupon.ExpiryDate);

    if (now < validFrom || now > expiryDate) {
      return res.status(400).json({ message: "Coupon is not valid at this time" });
    }

    // Fetch all usages for this user
    const queryResponse = await databases.listDocuments(database_id, couponUsagesTable_id, [
      Query.equal("UserID", userId)
    ]);

    // Filter to count usages of this specific coupon code provided
    const couponUsages = queryResponse.documents.filter(doc => doc.CouponCode === couponCode);
    const usageCount = couponUsages.length;

    // if (userLabel.includes('admin') || !userLabel.includes('staff')) {
    if (usageCount >= parseInt(coupon.UsageLimit)) {
      return res.status(400).json({ message: "Coupon usage limit exceeded for this student" });
    }
    // }

    // Coupon is valid, return its details to front end
    res.json({
      message: "Coupon is valid",
      couponDetails: {
        DiscountType: coupon.DiscountType,
        DiscountValue: coupon.DiscountValue,
        Description: coupon.Description,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
