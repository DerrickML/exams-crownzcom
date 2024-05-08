import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import express, { response } from "express";
import cors from "cors";
import {
  couponTable_id,
  databases,
  database_id,
  studentTable_id,
  studentMarksTable_id,
  pointsTable_id,
  Query,
} from "../appwriteServerConfig.js";

const router = Router();

// Initializing Express app
const app = express();
/************************************************/
/*From any origin*/
// Use cors middleware with wildcard origin
app.use(
  cors({
    origin: "*",
  }),
);
/************************************************/

// Get the directory name of the current module file
const dirname = path.dirname(fileURLToPath(import.meta.url));

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

    // Write the CSV data to a file in the 'data' directory
    const filePath = path.join(dirname, "..", "data", "coupons.csv");
    fs.writeFileSync(filePath, csvData);

    return res.json({ message: "Coupons fetched and saved to CSV file" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/fetch-students", async (req, res) => {
  const dataPath = path.join(dirname, "..", "data", "students.json");

  try {
    // Step 1: Check if students.json exists, if not, create it
    if (!fs.existsSync(dataPath)) {
      fs.writeFileSync(dataPath, JSON.stringify([]), "utf-8");
    }

    // Step 2 & 3: Fetch and process all student data
    const processedData = await fetchAndProcessAllStudentData();

    // Step 4: Save the processed data to the students.json file
    fs.writeFileSync(dataPath, JSON.stringify(processedData, null, 2), "utf-8");

    res.json({
      message: "Data fetched and stored successfully!",
      data: processedData,
    });
  } catch (error) {
    console.error("Error in fetch-students route:", error);
    res.status(500).json({ error: "Failed to fetch and process student data" });
  }
});

const fetchAndProcessAllStudentData = async () => {
  try {
    const students = await databases.listDocuments(
      database_id,
      studentTable_id,
      [Query.limit(10000)],
    );

    return Promise.all(
      students.documents.map(async (student) => {
        const results = await databases.listDocuments(
          database_id,
          studentMarksTable_id,
          [Query.equal("studID", [student.studID]), Query.limit(50)],
        );

        const points = await databases.listDocuments(
          database_id,
          pointsTable_id,
          [Query.equal("UserID", [student.studID]), Query.limit(1)],
        );

        const pointsBalance =
          points.documents.length > 0 ? points.documents[0].PointsBalance : 0;

        return {
          studID: student.studID,
          studName: `${student.firstName} ${student.lastName} ${student.otherName || ""}`,
          firstName: student.firstName,
          lastName: student.lastName,
          otherName: student.otherName || "",
          gender: student.gender,
          phone: student.phone,
          email: student.email,
          educationLevel: student.educationLevel,
          schoolName: student.schoolName,
          schoolAddress: student.schoolAddress,
          pointsBalance: pointsBalance,
          Results: results.documents.map((result) => ({
            subject: result.subject,
            score: result.marks,
            resultDetails: result.results,
            dateTime: new Date(result.$createdAt).toLocaleString("en-US", {
              timeZone: "Africa/Nairobi",
              hour12: false,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          })),
        };
      }),
    );
  } catch (error) {
    console.error("Error fetching and processing student data:", error);
    throw error;
  }
};

/**
 * Fetches results for a specific student.
 * @param {string} studID - The ID of the student.
 * @returns {Promise<Array>} - A promise that resolves to an array of results.
 */
const fetchStudentResults = async (studID) => {
  try {
    const response = await databases.listDocuments(
      database_id,
      studentMarksTable_id,
      [Query.equal("studID", [studID])],
    );
    return response.documents;
  } catch (err) {
    console.error(
      "Failed to fecth Students RESULTS linked to next-of-kin. " + err,
    );
  }
};

/**
 * Fetches student points for a specific student.
 * @param {string} studID - The ID of the student.
 * @returns {Promise<Array>} - A promise that resolves to an array of results.
 */
const fetchStudentPoints = async (studID) => {
  try {
    const response = await databases.listDocuments(
      database_id,
      pointsTable_id,
      [Query.equal("UserID", [studID])],
    );
    return response.documents;
  } catch (err) {
    console.error(
      "Failed to fecth Students POINTS linked to next-of-kin. " + err,
    );
  }
};

export default router;
