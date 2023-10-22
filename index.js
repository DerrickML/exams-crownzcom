// Importing required modules
import express from "express";
import cors from "cors";
import path from "path";
import { client, users, account } from "./appwriteServerConfig.js";

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

/*ROUTE: User Listing*/
app.get("/users", async (req, res) => {
  try {
    const usersList = await users.list(); // Assuming nodeAppwriteUsers is available
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

// ===== STARTING THE SERVER =====
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
