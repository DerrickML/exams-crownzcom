// Importing required modules and dotenv package
import { Client, Users, Account, Databases } from "node-appwrite";
import {
  Client as cClient,
  Account as cAccount,
  Databases as cDatabases,
  Permission as cPermission,
  Role as cRole,
  Query as cQuery,
} from "appwrite";

import dotenv from "dotenv";
dotenv.config();

// Init  server side SDK
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT) // Setting your Appwrite endpoint from env var
  .setProject(process.env.APPWRITE_PROJECT_ID) // Setting your project ID from env var
  .setKey(process.env.APPWRITE_API_KEY); // Setting your secret API key from env var
const account = new Account(client);
const users = new Users(client);
const databases = new Databases(client);

// Init client side SDK
const c_client = new cClient()
  .setEndpoint(process.env.APPWRITE_ENDPOINT) // Setting your Appwrite endpoint from env var
  .setProject(process.env.APPWRITE_PROJECT_ID); // Setting your project ID from env var

const c_account = new cAccount(c_client);
const c_databases = new cDatabases(c_client);

// Database and collection IDs
const database_id = "651417820a07629ea837";
const studentTable_id = "657065f7dddd996bf19b";
const parentsTable_id = "65706739032c0962d0a9";

export {
  client,
  account,
  users,
  databases,
  c_account,
  c_databases,
  c_client,
  database_id,
  studentTable_id,
  parentsTable_id,
};
