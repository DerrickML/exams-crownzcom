// Importing required modules
import crypto from "crypto";
import express, { response } from "express";
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
  Query,
} from "./appwriteServerConfig.js";
import { sendEmail } from "./emailConfig.js";

dotenv.config();

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

// Server is set up to parse JSON bodies
app.use(express.json());

// Serving static files from 'public' directory
app.use(express.static(path.join(process.cwd(), "public")));

// Generate random password
function generateSecurePassword(length = 12) {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

// Function to create email message
function createKinEmailMessage(kinName, studentName, password, kinEmail) {
  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="color: #4A90E2;">Welcome to Student Progress Tracker!</h2>
      <p>Hello <strong>${kinName}</strong>,</p>
      <p>We are excited to inform you that <strong>${studentName}</strong> has added you as their Next of Kin on our platform. This role is crucial in monitoring and supporting their educational journey.</p>
      <p>Your account details are as follows:</p>
      <ul>
        <li>Email: <strong>${kinEmail}</strong></li>
        <li>Password: <strong>${password}</strong> (Please change this on your first login)</li>
      </ul>
      <p>As a Next of Kin, you'll have access to view their academic progress, including quiz and exam scores. This is a great opportunity to stay involved and offer support where needed.</p>
      <p>Should you have any questions or require assistance, please don't hesitate to contact us.</p>
      <p>Best regards,</p>
      <p><strong>The Student Progress Tracker Team</strong></p>
    </div>
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
    });

    console.log("Parent added successfully");
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
      : console.log("On kin query");
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
    // Set default values for other properties
    otherName: null,
    gender: null,
    schoolName: null,
    schoolAddress: null,
    educationLevel: null,
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

  return response;
}

// ===== ROUTE HANDLERS =====
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
app.post("/create-next-of-kin", async (req, res) => {
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
        await sendEmail(
          email,
          "Welcome to Student Progress Tracker!",
          emailMessage,
        );
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

/*ROUTE 4: (AUTH 3) Route for updating user labels */
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

// ===== STARTING THE SERVER =====
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
