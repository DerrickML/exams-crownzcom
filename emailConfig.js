import nodemailer from "nodemailer";

// Email account credentials
const gmailUser = "legaldero@gmail.com";
const gmailPass = "ampslkwydryjnrpe"; // Use app password if 2FA is enabled

// Create a transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailUser,
    pass: gmailPass,
  },
});

export { gmailUser, transporter };
