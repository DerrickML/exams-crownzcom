// Importing required modules
// import cors from "codockerrs";
// Importing required modules
import crypto from "crypto";
import express from "express";
import cors from "cors";
import path from "path";
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
} from "./appwriteServerConfig.js";
import { ENCRYPTION_KEY, encrypt } from "./passcodeHashConfig.js";
import { gmailUser, transporter } from "./emailConfig.js";

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

// ===== ROUTE HANDLERS =====
/*ROUTE: Sends a static password to use on the client for a user that doesn't exist*/
app.get("/get-password", (req, res) => {
  const staticPassword = "Study@123"; // Define the static password here

  res.status(200).json({
    password: staticPassword,
  });
});

/*ROUTE: Send Login Details on addition of an account if doesn't exist*/
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

/*ROUTE: Server-side Encryption*/
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

/*ROUTE: User Server-Side Decryption and Verification*/
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

/*ROUTE: User Listing*/
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

/*ROUTE: User Deletion*/
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

/*ROUTE: Create account of the Next of Kin*/
app.post("/create-next-of-kin", async (req, res) => {
  try {
    const { email, firstName, phone } = req.body;
    let response;

    if (email) {
      // Create account with email
      response = await c_account.create(
        "unique()",
        email,
        "study@1234",
        firstName,
      );
    } else if (phone) {
      // Create account with phone
      response = await c_account.createPhoneSession("unique()", phone);
    }

    console.log("Next of Kin account created:", response);
    res.json(response);
  } catch (error) {
    console.error("Error in creating Next of Kin account:", error);
    res.status(500).send("Internal Server Error");
  }
});

/*ROUTE: Add Created New Parent account to Parents' Collection*/
app.post("/createParentDoc", async (req, res) => {
  const { parent_ID, firstName, secondName, email, phoneNumber, passCode } =
    req.body;

  // Basic validation
  if (
    !parent_ID ||
    !firstName ||
    !secondName ||
    !email ||
    !phoneNumber ||
    !passCode
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const encryptedPassCode = encrypt(passCode);

    await databases.createDocument(database_id, parentsTable_id, "unique()", {
      parID: parent_ID,
      firstName: firstName,
      lastName: secondName,
      email: email,
      phoneNumber: phoneNumber,
      passCode: encryptedPassCode,
    });

    res.json({ message: "Parent added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Failed to add parent: ${error.message}` });
  }
});

// ===== STARTING THE SERVER =====
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
