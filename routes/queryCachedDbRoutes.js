import express from "express";
import fs from "fs";
import { parse } from "csv-parse/sync";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { promisify } from 'util';
import { createObjectCsvWriter } from 'csv-writer';
import { stringify } from 'csv-stringify';
import { fileURLToPath } from "url";



dotenv.config();
const PLE_ATTEMPTED_QUESTIONS_FILE = process.env.PLE_ATTEMPTED_QUESTIONS_FILE
const UCE_ATTEMPTED_QUESTIONS_FILE = process.env.UCE_ATTEMPTED_QUESTIONS_FILE
const UACE_ATTEMPTED_QUESTIONS_FILE = process.env.UACE_ATTEMPTED_QUESTIONS_FILE
let fileName;

const router = express.Router();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

/************************************************/
/*From any origin*/
// Use cors middleware with wildcard origin
router.use(
  cors({
    origin: "*",
  }),
);
/************************************************/

// Retrieve User Questions History
router.get('/getQtnHistory/:userId/:subjectName/:educationLevel', async (req, res) => {
  const { userId, subjectName, educationLevel } = req.params;
  if (educationLevel === 'PLE') {
    fileName = PLE_ATTEMPTED_QUESTIONS_FILE
  }
  else {
    throw new Error('Education level not provided');
  };

  const filePath = path.join(dirname, "..", "data", fileName);

  try {
    const data = await readFile(filePath, "utf8");
    const records = parse(data, { columns: true, skip_empty_lines: true });

    const userRecord = records.find(record =>
      record.UserId === userId && record.SubjectName === subjectName);

    if (userRecord) {
      res.json({
        questionsJSON: JSON.parse(userRecord.QuestionsJSON || '{}'),
        timestamp: userRecord.Timestamp || null
      });
    } else {
      // No history found for this user and subject
      res.json({ questionsJSON: {}, timestamp: null });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Error reading user history');
  }
});

// Update User Questions History
router.post('/updateQtnHistory', async (req, res) => {
  const { userId, subjectName, questionsJSON, educationLevel } = req.body;

  if (educationLevel === 'PLE') {
    fileName = PLE_ATTEMPTED_QUESTIONS_FILE
  }
  else if (educationLevel === 'UCE') {
    fileName = UCE_ATTEMPTED_QUESTIONS_FILE
  }
  else if (educationLevel === 'UACE') {
    fileName = UACE_ATTEMPTED_QUESTIONS_FILE
  }
  else {
    throw new Error('Education level not provided');
  };

  console.log('Update Question History Education Level: ', educationLevel);
  questionsJSON ? console.log('Not empty') : console.log('Empty Question JSON')

  try {
    // let data = await readFile(csvFilePath, { encoding: 'utf8' });
    const filePath = path.join(dirname, "..", "data", fileName);
    let records;

    // Check if the file exists and read, otherwise initialize records as an empty array
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      records = parse(data, { columns: true, skip_empty_lines: true });
    } else {
      records = [];
    }

    const existingRecordIndex = records.findIndex(record => record.UserId === userId && record.SubjectName === subjectName);

    if (existingRecordIndex >= 0) {
      // Merge with existing record
      let existingQuestionsJSON = JSON.parse(records[existingRecordIndex].QuestionsJSON);

      // Iterate through each category in the existing data and update with new questions
      for (const category in questionsJSON) {
        if (existingQuestionsJSON[category]) {
          existingQuestionsJSON[category] = [...new Set([...existingQuestionsJSON[category], ...questionsJSON[category]])];
        } else {
          existingQuestionsJSON[category] = questionsJSON[category];
        }
      }

      records[existingRecordIndex] = {
        UserId: userId,
        SubjectName: subjectName,
        QuestionsJSON: JSON.stringify(questionsJSON),
        Timestamp: new Date().toISOString()
      };
    } else {
      // Append new record
      records.push({
        UserId: userId,
        SubjectName: subjectName,
        QuestionsJSON: JSON.stringify(questionsJSON),
        Timestamp: new Date().toISOString()
      });
      console.log('Appending new user record.');
    }

    // Convert records to CSV format
    stringify(records, { header: true }, (err, output) => {
      if (err) {
        console.error(`Error stringifying CSV: ${err}`);
        res.status(500).send(`Error stringifying CSV: ${err}`);
        return;
      }

      // Write updated data to CSV file
      fs.writeFile(filePath, output, (writeErr) => {
        if (writeErr) {
          console.error(`Error writing to CSV: ${writeErr}`);
          res.status(500).send(`Error writing to CSV: ${writeErr}`);
          return;
        }
        res.send('User history updated successfully');
      });
    });
  } catch (error) {
    console.log(error);
    res.status(500).send(`Error updating user history ${error}`);
  }
});


// Route to validate a coupon
router.get("/validate-coupon", async (req, res) => {
  const couponCode = req.query.code;

  if (!couponCode) {
    return res.status(400).json({ message: "Coupon code is required" });
  }

  try {
    const filePath = path.join(dirname, "..", "data", "coupons.csv");
    const csvData = fs.readFileSync(filePath, "utf8");
    const records = parse(csvData, { columns: true, skip_empty_lines: true });
    const coupon = records.find((c) => c.CouponCode === couponCode);

    if (!coupon || coupon.IsActive.toLowerCase() !== "true") {
      return res
        .status(404)
        .json({ message: "Coupon not found or not active" });
    }

    const now = new Date();
    const validFrom = new Date(coupon.ValidFrom);
    const expiryDate = new Date(coupon.ExpiryDate);

    if (now < validFrom || now > expiryDate) {
      return res
        .status(400)
        .json({ message: "Coupon is not valid at this time" });
    }

    // Coupon is valid, return its details
    res.json({
      message: "Coupon is valid",
      couponDetails: {
        DiscountType: coupon.DiscountType,
        DiscountValue: coupon.DiscountValue,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
