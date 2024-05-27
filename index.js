// Importing required modules
import crypto from "crypto";
import "winston-daily-rotate-file";
import winston from "winston";
import express, { response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import {
  client,
  users,
  account,
  databases,
  c_client,
  c_account,
  c_databases,
  database_id,
  studentTable_id,
  parentsTable_id,
  adminTable_id,
  Query,
} from "./appwriteServerConfig.js";
import { sendEmail } from "./emailConfig.js";
import cachedDbRoutes from "./routes/cachedDatabase.js";
import queryCachedDbRoutes from "./routes/queryCachedDbRoutes.js";
import flutterwaveRoutes from "./routes/flutterwaveRoutes.js";
import mtnMomoRoutes from "./routes/mtnMomoRoutes.js";
import examRoutes from "./routes/examRoutes.js";

dotenv.config();

const PORT_NO = process.env.PORT_NO || 3009;

// Initializing Express App
const app = express();

const dailyRotateFileTransport = new winston.transports.DailyRotateFile({
  filename: "logs/server-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [dailyRotateFileTransport],
});

/************************************************/
/*From any origin*/
// Use cors middleware with wildcard origin
app.use(
  cors({
    origin: "*",
  }),
);
/************************************************/

// Logging Middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ipAddress: req.ip,
  });
  next();
});

// Support for JSON-encoded bodies
app.use(bodyParser.json());

// Support for URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Server is set up to parse JSON bodies
app.use(express.json());

// Serving static files from 'public' directory
app.use(express.static(path.join(process.cwd(), "public")));
// app.use(express.static(path.join(process.cwd(), 'public')));

// Generate random password
function generateSecurePassword(length = 12) {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

// Function to create email message
function createKinEmailMessage(kinName, studentName, password, kinEmail) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Exam Prep Tutor!</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; color: #333;">
<div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border: 1px solid #dddddd;">
  <div style="background-color: #007bff; color: #ffffff; padding: 10px 20px; text-align: center;">
    <h1 style="margin: 0;">Welcome to Exam Prep Tutor!</h1>
  </div>
  <div style="padding: 20px;">
    <p>Hello <strong>${kinName}</strong>,</p>
    <p>We are excited to inform you that <strong>${studentName}</strong> has added you as their Guardian on the Exam Prep Tutor platform. This role is crucial in monitoring and supporting their educational journey.</p>
    <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dddddd;">
      <p>Your account details are as follows:</p>
      <p><strong>Email:</strong> ${kinEmail}</p>
      <p><strong>Password:</strong> ${password} (Please change this on your first login)</p>
    </div>
    <p>As a Guardian, you'll have access to view their academic progress, including quiz and exam scores. This is a great opportunity to stay involved and offer support where needed.</p>
    <p>Should you have any questions or require assistance, please don't hesitate to contact us.</p>
    <a href="https://exampreptutor.com/" style="background-color: #007bff; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 5px; display: inline-block;">Sign In to Dashboard</a>
  </div>
  <div style="background-color: #007bff; color: #ffffff; text-align: center; padding: 10px 20px; font-size: 0.8em;">
    <p>Best regards,</p>
    <p>Exam Prep Tutor Team</p>
  </div>
</div>
</body>
</html>

`;
}

//Funtion to create kin document in kin table
async function createKinDocument(kinID, firstName, lastName, email, phone) {
  try {
    await databases.createDocument(database_id, parentsTable_id, "unique()", {
      kinID: kinID,
      firstName: firstName,
      lastName: lastName,
      email: email || null,
      phone: phone || null,
      accountStatus: "Active",
      createdDate: new Date(),
    });

    console.log("Parent added successfully");
    return true;
  } catch (error) {
    console.error(error);
    // throw error;
    // res.status(500).json({ error: `Alert: ${error.message}` });
  }
}

//Funtion to create kin document in kin table
async function createAdminDocument(adminId, firstName, lastName, email, phone) {
  try {
    await databases.createDocument(database_id, adminTable_id, "unique()", {
      adminID: adminId,
      firstName: firstName,
      lastName: lastName,
      email: email || null,
      phone: phone || null,
      accountStatus: "Active",
    });

    console.log("Admin added successfully");
    return true;
  } catch (error) {
    console.error(error);
    // throw error;
    // res.status(500).json({ error: `Alert: ${error.message}` });
  }
}

// Function to update User account labels
async function updateLabel(userId, labels) {
  try {
    return await users.updateLabels(userId, labels);
  } catch (error) {
    throw error; // Rethrow the error to handle it in the route
  }
}

//Function to return user account details
async function getUserDetails(userId) {
  try {
    return await users.get(userId);
  } catch (error) {
    throw error; // Rethrow the error to handle it in the route
  }
}

// Function to Query user (kin/student) collection for details
async function queryUser(userId, table_id, queryKey) {
  try {
    queryKey === "studID"
      ? console.log("On student query")
      : console.log("On kin or Admin query");

    console.log("Database id: " + database_id);
    console.log("Table id: " + table_id);
    const details = await databases.listDocuments(database_id, table_id, [
      Query.equal(queryKey, userId),
    ]);
    console.log(details);
    return details;
  } catch (error) {
    console.log("On user query: " + error);
    throw error; // Rethrow the error to handle it in the route
  }
}

// Helper function to construct response for user details
// Used in the get-user-details route
function constructResponse(user, userDetails, kinDetails, labels, isStudent) {
  let response = {
    status: userDetails ? userDetails.total > 0 : false,
    userDocId: userDetails.documents[0].$id || null,
    firstName: null,
    lastName: null,
    phone: user.phone || null,
    email: user.email || null,
    labels: labels || [],
    kinID: user.kinID || null,
    adminID: user.adminID || null,
    // Set default values for other properties
    otherName: null,
    gender: null,
    schoolName: null,
    schoolAddress: null,
    educationLevel: null,
    subjects: userDetails.subjects || [],
  };

  // Populate response if userDetails exist
  if (userDetails && userDetails.total > 0) {
    const details = userDetails.documents[0];
    for (const key in details) {
      if (response.hasOwnProperty(key)) {
        response[key] = details[key];
      }
    }
  }

  // Conditionally add kin details if the user is a student and kinDetails exist
  if (isStudent && kinDetails && kinDetails.total > 0) {
    const kin = kinDetails.documents[0];
    response.kinFirstName = kin.firstName || null;
    response.kinLastName = kin.lastName || null;
    response.kinEmail = kin.email || null;
    response.kinPhone = kin.phone || null;
  }

  /**
   * TODO: Add admin response details if required
   */

  return response;
}

//Function to update a document in a collection
async function updateDocument(collectionId, documentId, data) {
  try {
    console.log("Document Data: ", data);
    const response = await databases.updateDocument(
      database_id,
      collectionId,
      documentId,
      data,
    );

    return response;
  } catch (error) {
    console.log("Failed to update document", error);
    throw error;
  }
}

//Function to update user Account service data
async function updateAccountData(userId, data) {
  try {
    if (data.hasOwnProperty("firstName")) {
      if (
        data.firstName &&
        data.firstName !== undefined &&
        data.firstName !== null &&
        data.firstName !== ""
      ) {
        console.log("firstName exists and is directly defined!");
        const promise = await users.updateName(userId, data.firstName);
      }
    }
    if (data.hasOwnProperty("email")) {
      if (
        data.email &&
        data.email !== undefined &&
        data.email !== null &&
        data.email !== ""
      ) {
        console.log("email exists and is directly defined!");
        const promise = await users.updateEmail(userId, data.email);
      }
    }
    if (data.hasOwnProperty("phone")) {
      if (
        data.phone &&
        data.phone !== undefined &&
        data.phone !== null &&
        data.phone !== ""
      ) {
        console.log("phone exists and is directly defined!");
        const promise = await users.updatePhone(userId, data.phone);
      }
    }

    return "Finished to check account update";
  } catch (error) {
    console.log("Failed to User Account", error);
    throw error;
  }
}

// ===== ROUTE HANDLERS =====
/*ROUTE 0: (AUTH 3) Home route - Simple check to confirm the server is running and used by webhooks too*/
app.get("/", (req, res) => {
  res.send("Crownzcom Quiz/Exam says hello! 👋");
});

/*ROUTE 1: (AUTH 3) Gets user details requested from client side*/
app.post("/get-user-details", async (req, res) => {
  try {
    const userId = req.body.userId;
    const user = await getUserDetails(userId);
    const labels = user.labels;
    let userDetails, kinDetails;

    if (labels.includes("student")) {
      console.log("User is a student: " + userId);
      userDetails = await queryUser(userId, studentTable_id, "studID");
      if (userDetails.documents[0].kinID) {
        kinDetails = await queryUser(
          userDetails.documents[0].kinID,
          parentsTable_id,
          "kinID",
        );
      }
    } else if (labels.includes("kin")) {
      console.log("User is a kin");
      userDetails = await queryUser(userId, parentsTable_id, "kinID");
    } else if (labels.includes("admin")) {
      console.log("User is an Admin");
      userDetails = await queryUser(userId, adminTable_id, "adminID");
    }

    const response = constructResponse(
      user,
      userDetails,
      kinDetails,
      labels,
      labels.includes("student"),
    );
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: error });
  }
});

/*ROUTE 2: (AUTH 3) Create user student account with email if email method is selected on client side*/
app.post("/create-student", async (req, res) => {
  try {
    const { email, phone, password, userName } = req.body;
    const response = await users.create(
      "unique()",
      email,
      phone,
      password,
      userName,
    );
    console.log("Student details: ", response);
    res.json(response);
  } catch (error) {
    console.error("Error in creating student account:", error);
    res.status(500).send(`Internal Server Error: ${error}`);
  }
});

/*ROUTE 3: (AUTH 3) Create user account for the Next of Kin*/
app.post("/create-guardian", async (req, res) => {
  try {
    const { email, firstName, lastName, phone, signupMethod, studentName } =
      req.body;
    if (!email && !phone) {
      return res
        .status(400)
        .send(
          "Please provide either an email or phone number for the next of kin.",
        );
    }
    let password = generateSecurePassword();
    let response, accountResponse, kinId;
    const kinLabel = ["kin"];

    //Check for signup method and use that for signup
    if (signupMethod === "email") {
      try {
        response = await users.create(
          "unique()",
          email,
          phone,
          password,
          firstName,
        );
        console.log("Kin ID: ", response.$id);
        await updateLabel(response.$id, kinLabel);
        accountResponse = await getUserDetails(response.$id);
        kinId = response.$id;
        console.log("Email account resoonse (ID expected): ", kinId);
      } catch (error) {
        console.log("Failed to create Next-of-Kin account:" + error);
        throw error.message;
      }
    } else if (signupMethod === "phone") {
      try {
        response = await c_account.createPhoneSession("unique()", phone);
        console.log("Kin ID From Phone: ", response.userId);
        await updateLabel(response.userId, kinLabel);
        accountResponse = await getUserDetails(response.userId);
        kinId = response.userId;
        console.log("Phone account resoonse (ID expected): ", kinId);
      } catch (error) {
        console.log("Failed to create Next-of-Kin account:" + error);
        res.status(500).send(error.message);
        throw error.message;
      }
    }

    // Attempt to send an email if it's provided
    if (email) {
      try {
        const emailMessage = createKinEmailMessage(
          firstName,
          studentName,
          password,
          email,
        );
        await sendEmail(email, "Welcome to Exam Prep Tutor!", emailMessage);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        throw emailError;
      }
    }

    //Add next of kin accout to next-of-kin collection
    await createKinDocument(kinId, firstName, lastName, email, phone); //accountResponse parameter contains kinID

    console.log("Next of Kin account created:", accountResponse);
    res.json(accountResponse);
  } catch (error) {
    console.error("Error in creating Next of Kin account:", error);
    res.status(500).send(`Internal Server Error: ${error}`);
  }
});

/*ROUTE 4: (AUTH 3) Create user account for an Admin*/
app.post("/create-admin", async (req, res) => {
  try {
    const { email, firstName, lastName, phone, signupMethod } = req.body;
    if (!email && !phone) {
      return res
        .status(400)
        .send("Please provide either an email or phone number for the admin.");
    }
    let password = generateSecurePassword();
    let response, accountResponse, adminId;
    const adminLabel = ["admin", "staff"];

    //Check for signup method and use that for signup
    if (signupMethod === "email") {
      try {
        response = await users.create(
          "unique()",
          email,
          phone,
          password,
          firstName,
        );
        console.log("Admin ID: ", response.$id);
        await updateLabel(response.$id, adminLabel);
        accountResponse = await getUserDetails(response.$id);
        adminId = response.$id;
        console.log("Email account resoonse (ID expected): ", adminId);
      } catch (error) {
        console.log("Failed to create Admin account:" + error);
        throw error.message;
      }
    } else if (signupMethod === "phone") {
      try {
        response = await c_account.createPhoneSession("unique()", phone);
        console.log("Admin ID From Phone: ", response.userId);
        await updateLabel(response.userId, adminLabel);
        accountResponse = await getUserDetails(response.userId);
        adminId = response.userId;
        console.log("Phone account resoonse (ID expected): ", adminId);
      } catch (error) {
        console.log("Failed to create Admin account:" + error);
        res.status(500).send(error.message);
        throw error.message;
      }
    }

    // Attempt to send an email if it's provided
    // if (email) {
    //   try {
    //     const emailMessage = createKinEmailMessage(
    //       firstName,
    //       studentName,
    //       password,
    //       email,
    //     );
    //     await sendEmail(email, "Welcome to Exam Prep Tutor!", emailMessage);
    //   } catch (emailError) {
    //     console.error("Email sending failed:", emailError);
    //     throw emailError;
    //   }
    // }

    //Add Admin accout to Admin collection
    await createAdminDocument(adminId, firstName, lastName, email, phone); //accountResponse parameter contains Admin

    console.log("Admin account created:", accountResponse);
    res.json(accountResponse);
  } catch (error) {
    console.error("Error in creating Admin account:", error);
    res.status(500).send(`Internal Server Error: ${error}`);
  }
});

/*ROUTE 5: (AUTH 3) Route for updating user labels */
app.post("/update-label", async (req, res) => {
  try {
    const userId = req.body.userId; // Assuming userId is passed in the request body
    const labels = req.body.labels; // Assuming labels array is passed in the request body

    const response = await updateLabel(userId, labels);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/*ROUTE 6: (AUTH 3) Route for updating user acount details */
app.post("/update-account", async (req, res) => {
  try {
    const userId = req.body.userId;
    const documentID = req.body.userDocId;
    const userLabel = req.body.label;

    let collectionID;

    userLabel === "student"
      ? (collectionID = studentTable_id)
      : (collectionID = parentsTable_id);

    const dataToUpdate = { ...req.body };

    //Remove data which isn't to be updated
    delete dataToUpdate.userDocId;
    delete dataToUpdate.userId;
    delete dataToUpdate.label;

    //Updating User data via the Account service
    const responseAccountService = await updateAccountData(
      userId,
      dataToUpdate,
    );

    //Updating User data stored in Collecion via database service
    const responseDocumentUpdate = await updateDocument(
      collectionID,
      documentID,
      dataToUpdate,
    );

    res.json({
      Account: responseAccountService,
      document: responseDocumentUpdate,
    });
  } catch (error) {
    console.log("Failed to Update User Details:\n", error);
    res.json({ error: `Failed to Update User Details:\n${error}` });
  }
});

/*ROUTE 6: Alert Next of Kin about Exam Attempt*/
app.post("/alert-guardian", async (req, res) => {
  try {
    const {
      studentName,
      educationLevel,
      kinNames,
      kinEmail,
      subjectName,
      examScore,
      examDateTime,
    } = req.body;

    // Create the email body
    const emailBody = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Exam Results Notification</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; color: #333;">
<div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border: 1px solid #dddddd;">
  <div style="background-color: #007bff; color: #ffffff; padding: 10px 20px; text-align: center;">
    <h1 style="margin: 0;">Exam Results Update</h1>
  </div>
  <div style="padding: 20px;">
    <p>Dear <strong>${kinNames}</strong>,</p>
    <p>We are delighted to share the latest exam results for <strong>${studentName}</strong>.</p>
    <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dddddd;">
      <p><strong>Education Level:</strong> ${educationLevel}</p>
      <p><strong>Subject:</strong> ${subjectName}</p>
      <p><strong>Exam Score:</strong> ${examScore}</p>
      <p><strong>Exam Date and Time:</strong> ${examDateTime}</p>
    </div>
    <p>To view more details and track ongoing performance, please sign in to your dashboard:</p>
    <a href="https://exampreptutor.com/" style="background-color: #007bff; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 5px; display: inline-block;">Sign In to Dashboard</a>
  </div>
  <div style="background-color: #007bff; color: #ffffff; text-align: center; padding: 10px 20px; font-size: 0.8em;">
    <p>Best regards,</p>
    <p>Exam Prep Tutor Team</p>
  </div>
</div>
</body>
</html>
`;

    console.log("Exam Attempted: Alerting Guardian");

    // Send the email
    await sendEmail(kinEmail, "Exam Attempt Alert", emailBody);

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error in sending email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

/* ROUTE 7: Password Reset */
app.get("/reset-password", async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Email to reset: ', email);
    const result = await account.createRecovery(
      'derrickmal123@gmail.com', // email
      'https://exampreptutor.com/password-reset' // url
    );
    console.log('Password Reset: ', result);
    res.status(200).json({ message: "Email sent successfully for password reset", Results: result });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ error: "Failed to reset password", errorMessage: err.message });
  };
});

/*--- FLUTTERWAVE SUPPORTED ROUTES ---*/
app.use("/flutterwave", flutterwaveRoutes);

/*--- MTN MOMO API SUPPORTED ROUTES ---*/
app.use("/mtnMomo", mtnMomoRoutes);

/*--- Cached Database Routes ---*/
app.use("/db", cachedDbRoutes);

/*--- Query Cached Database Routes ---*/
app.use("/query", queryCachedDbRoutes);

/*--- Query to for exams ---*/
app.use("/exam/", examRoutes);

// The "catch-all" handler: for any request that doesn't
// match one above, send back React's index.html file.
// app.get('*', (req, res) => {
//   res.sendFile(path.resolve(process.cwd(), 'public', 'index.html'));
// });

// Testing Route
app.get("/test-error", (req, res) => {
  throw new Error("Something went wrong!");
  res.send("Hello, world!");
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error("Error logged", {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ipAddress: req.ip,
  });

  res.status(500).send({
    error: "Internal Server Error",
    message: err.message,
  });
});

// ===== STARTING THE SERVER =====
app.listen(PORT_NO, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT_NO}`);
});
