// Importing required modules
// import cors from "codockerrs";
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
import { ENCRYPTION_KEY, encrypt } from "./passcodeHashConfig.js";
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

function createKinEmailMessage(kinName, studentName, password) {
  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="color: #4A90E2;">Welcome to Student Progress Tracker!</h2>
      <p>Hello <strong>${kinName}</strong>,</p>
      <p>We are excited to inform you that <strong>${studentName}</strong> has added you as their Next of Kin on our platform. This role is crucial in monitoring and supporting their educational journey.</p>
      <p>Your account details are as follows:</p>
      <ul>
        <li>Email: <strong>${kinName}</strong></li>
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
// Function to update labels
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

// Function to Query user (kin/student) details
async function queryUser(userId, table_id, queryKey) {
  try {
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

// ===== ROUTE HANDLERS =====
/*ROUTE: (AUTH 3) Gets user details*/
app.post("/get-user-details", async (req, res) => {
  try {
    const userId = req.body.userId;
    const user = await getUserDetails(userId);
    const labels = user.labels;
    let userDetails;
    if (labels.includes("student")) {
      // The "labels" array contains "student"
      console.log("User is a student: " + userId);
      let studQueryKey = "studID";
      userDetails = await queryUser(userId, studentTable_id, studQueryKey);
      console.log(userDetails);

      // Extracting firstName, lastName, phone, and email
      const {
        firstName,
        lastName,
        otherName,
        phone,
        email,
        gender,
        educationLevel,
        schoolName,
        schoolAddress,
      } = userDetails.documents[0];

      // Now you can use these variables as needed
      console.log(
        "USER INFO:" +
          "\nFirst Name: " +
          firstName +
          "\nLast Name: " +
          lastName +
          "\nPhone: " +
          phone +
          "\nEmail: " +
          email +
          "\nLabels: " +
          labels,
      );

      res.status(200).json({
        firstName: firstName,
        lastName: lastName,
        otherName: otherName,
        phone: phone,
        email: email,
        gender: gender,
        schoolName: schoolName,
        schoolAddress: schoolAddress,
        educationLevel: educationLevel,
        labels: labels,
      });
    } else if (labels.includes("kin")) {
      // The "labels" array contains "kin"
      console.log("User is a kin");
      let kinQueryKey = "kinID";
      userDetails = await queryUser(userId, parentsTable_id, kinQueryKey);

      // Extracting firstName, lastName, phone, and email
      const { firstName, lastName, phone, email } = userDetails.documents[0];

      // Now you can use these variables as needed
      console.log(firstName, lastName, phone, email);

      res.status(200).json({
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        email: email,
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error,
    });
  }
});
/*ROUTE: Sends a static password to use on the client for a user that doesn't exist*/
app.get("/get-password", (req, res) => {
  const staticPassword = "Study@123"; // Define the static password here

  res.status(200).json({
    password: staticPassword,
  });
});

/*ROUTE: (AUTH 1/2) (Kin) Send Login Details on addition of an account if doesn't exist*/
app.post("/send-password", (req, res) => {
  const recipientEmail = req.body.email;
  const signInPassword = req.body.password; // Static sign-in password

  // const signInPassword = "Study@123"; // Static sign-in password

  // Email options
  const mailOptions = {
    from: gmailUser,
    to: recipientEmail,
    subject: "Your Sign-In Details",
    html: `
      <h1>Welcome to Our Application</h1>
      <p>Here are your sign-in details:</p>
      <ul>
        <li><b>Email:</b> ${recipientEmail}</li>
        <li><b>Password:</b> ${signInPassword}</li>
      </ul>
      <p><i>Please make sure to change your password upon first login.</i></p>
    `,
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(`Error: ${error}`);
      res.status(500).send("Error in sending email");
    } else {
      console.log(`Message sent: ${info.response}`);
      res.status(200).send("Email sent successfully");
    }
  });
});

/*ROUTE: (AUTH 1/2) Server-side Encryption*/
app.post("/encrypt", (req, res) => {
  try {
    const text = req.body.passcode;
    const encryptedData = encrypt(text);
    res.json({ encryptedData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Encryption failed" });
  }
});

/*ROUTE: (AUTH 1/2) User Server-Side Decryption and Verification*/
app.post("/verify-passcode", (req, res) => {
  try {
    const encryptedText = req.body.encryptedPasscode;
    const userPasscode = req.body.userPasscode;

    let textParts = encryptedText.split(":");
    let iv = Buffer.from(textParts.shift(), "hex");
    let encryptedTextBuffer = Buffer.from(textParts.join(":"), "hex");
    let decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY, "hex"),
      iv,
    );
    let decrypted = decipher.update(encryptedTextBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    if (decrypted.toString() === userPasscode) {
      res.json({ verified: true });
    } else {
      res.json({ verified: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Decryption failed" });
  }
});

/*ROUTE: (AUTH 1/DER) User Listing*/
app.get("/users", async (req, res) => {
  try {
    const usersList = await users.list(); // Fetch Users from Appwrite
    res.json({ users: usersList.users }); // Respond with the list of users
    console.log(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" }); // Updated to return JSON
  }
});

/*ROUTE: (AUTH 1 / DER) User Deletion*/
app.post("/delete-user", async (req, res) => {
  const userIds = req.body.userIds;
  if (!userIds || userIds.length === 0) {
    return res.status(400).send("User IDs are required");
  }

  const errors = []; // Array to hold any errors that occur

  for (const userId of userIds) {
    try {
      await users.delete(userId); // Assuming nodeAppwriteUsers is available
    } catch (error) {
      console.error(error);
      errors.push(`Failed to delete user with ID ${userId}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    res.status(500).json({ errors }); // Send back any errors that occurred
  } else {
    res.send("Users deleted successfully");
  }
});

/*ROUTE: (AUTH 3) Create student account with email if email method is selected on client side*/
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

/*ROUTE: (AUTH 3) Create account of the Next of Kin*/
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

/*ROUTE: (AUTH 1/2) Add Created New Parent account to Parents' Collection*/
app.post("/createParentDoc", async (req, res) => {
  const { kinID, firstName, lastName, email, phone, passCode } = req.body;

  // Basic validation
  if (!parent_ID || !firstName || !lastName || !email || !phone || !passCode) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const encryptedPassCode = encrypt(passCode);

    await databases.createDocument(database_id, parentsTable_id, "unique()", {
      kinID: parent_ID,
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      passCode: encryptedPassCode,
    });

    res.json({ message: "Parent added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Failed to add parent: ${error.message}` });
  }
});

/*ROUTE: (AUTH 3) Route for updating labels */
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

// ROUTE: (AUTH 1/2) Check Phone Number in Student and Kin Tables
app.post("/check-phone-number", async (req, res) => {
  const phoneNumber = req.body.phone;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    // Check in the student table
    const existsInStudentTable = await checkPhoneNumberInTable(
      studentTable_id,
      phoneNumber,
    );

    if (existsInStudentTable) {
      return res.json({ exists: true });
    }

    // Check in the kin table
    const existsInKinTable = await checkPhoneNumberInTable(
      parentsTable_id,
      phoneNumber,
    );

    if (existsInKinTable) {
      return res.json({ exists: true });
    }

    // Phone number does not exist in any table
    return res.json({ exists: false });
  } catch (error) {
    console.error("Error checking phone number:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Function to check if a phone number exists in a given table
async function checkPhoneNumberInTable(tableId, phoneNumber) {
  try {
    const response = await databases.listDocuments(database_id, tableId, [
      Query.equal("phone", phoneNumber),
    ]);
    return response.documents.length > 0;
  } catch (error) {
    console.error("Error querying table:", error);
    throw error;
  }
}

// ===== STARTING THE SERVER =====
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
