import nodemailer from "nodemailer";

// ===== EMAIL SETUP =====
/************************************************/
// Acumbamail SMTP server credentials
const acumbamailUser = process.env.acumbamailUser;
const acumbamailSender = process.env.acumbamailSender;
const acumbamailPass = process.env.acumbamailPass;

// Create a transporter for Acumbamail
const transporter = nodemailer.createTransport({
  host: "smtp.acumbamail.com", // Acumbamail's SMTP server host
  port: 587, // Commonly used port for SMTP, adjust if Acumbamail uses a different one
  secure: false, // True if port is 465 (secure), false for other ports like 587
  auth: {
    user: acumbamailUser,
    pass: acumbamailPass,
  },
});

function sendEmail(email, subject, message) {
  return new Promise((resolve, reject) => {
    // Email options
    const mailOptions = {
      from: acumbamailSender, // Sender address
      to: email, // Recipient address
      subject: subject,
      html: message,
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(`Error: ${error}`);
        reject(error);
      } else {
        console.log(`Message sent: ${info.response}`);
        resolve(info);
      }
    });
  });
}
/************************************************/
export { sendEmail };
