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
const database_id = "655f5a677fcf3b1d8b79";
const studentTable_id = "657065f7dddd996bf19b";
const parentsTable_id = "65706739032c0962d0a9";
const couponTable_id = "65d74fb70f64c0e46f36";
const couponUsagesTable_id = "65dc4317b1e6e5bebdb9";

// EXAM-PREP-TUTOR (SEL-HOSTED) - Database and collection IDs
// const database_id = "655f5a677fcf3b1d8b79";
// const studentTable_id = "661e4bb2002397381143";
// const parentsTable_id = "661e4d270036062e938b";
// const couponTable_id = "661e489c0034d76a19bd";
// const couponUsagesTable_id = "65dc4317b1e6e5bebdb9";

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
  Query,
};
