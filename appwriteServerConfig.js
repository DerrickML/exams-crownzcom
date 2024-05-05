// Importing required modules and dotenv package
import { Client, Users, Account, Databases } from "node-appwrite";
import {
  Client as cClient,
  Account as cAccount,
  Databases as cDatabases,
  Permission as cPermission,
  Role as cRole,
  Query,
} from "appwrite";

import dotenv from "dotenv";
dotenv.config();

// Initialize  server side SDK
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const account = new Account(client);
const users = new Users(client);
const databases = new Databases(client);

// Initialize client side SDK
const c_client = new cClient()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID);

const c_account = new cAccount(c_client);
const c_databases = new cDatabases(c_client);
// const query = new Query(c_client);

// DERRICK (CLOUD) - Database and collection IDs
// const database_id = "655f5a677fcf3b1d8b79";
// const studentTable_id = "657065f7dddd996bf19b";
// const parentsTable_id = "65706739032c0962d0a9";
// const couponTable_id = "65d74fb70f64c0e46f36";
// const couponUsagesTable_id = "65dc4317b1e6e5bebdb9";
// const pointsTable_id = 'UserID'
// const pointsBatchTable_id = '65f2c212c16fa9abe971'
// const updatedAttemptedQtnsTable_id = '66279de7702be42c9910'
// const studentMarksTable_id = "6598050dbb628ae2216f";
// const adminTable_id = '6637791400012200a3ce'

// EXAM-PREP-TUTOR (SEL-HOSTED) - Database and collection IDs
const database_id = "655f5a677fcf3b1d8b79";
const studentTable_id = "657065f7dddd996bf19b";
const parentsTable_id = "65706739032c0962d0a9";
const couponTable_id = "65d74fb70f64c0e46f36";
const couponUsagesTable_id = "65dc4317b1e6e5bebdb9";
const pointsTable_id = 'UserID'
const pointsBatchTable_id = '65f2c212c16fa9abe971'
const updatedAttemptedQtnsTable_id = '66279de7702be42c9910'
const studentMarksTable_id = "6598050dbb628ae2216f";
const adminTable_id = '6637791400012200a3ce'

export {
  account,
  databases,
  client,
  users,
  c_account,
  c_databases,
  c_client,
  database_id,
  studentTable_id,
  parentsTable_id,
  couponTable_id,
  couponUsagesTable_id,
  studentMarksTable_id,
  pointsTable_id,
  pointsBatchTable_id,
  updatedAttemptedQtnsTable_id,
  adminTable_id,
  Query,
};
