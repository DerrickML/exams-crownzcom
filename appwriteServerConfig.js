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

// Init  server side SDK
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1") // Setting your Appwrite endpoint from env var
  .setProject("651413f38aee140189c2") // Setting your project ID from env var
  .setKey(
    "70d1462daa53310a65f8f7294464190bd60cbb8ca1a2b5f2b94763b086be5459463c75ae23eeef1e2804ecc8110de3cdc7d9457f15e2608700b8aa1a8db83bd44da2e93d5bbf4f8918dadc2d1f596b74c0e44ac07c9e7296228728e986060f29057a739c2ff62f426ff5cb8c26a1d2eb61af30ba048122b326378df46080aef2",
  ); // Setting your secret API key from env var
const account = new Account(client);
const users = new Users(client);
const databases = new Databases(client);

// Init client side SDK
const c_client = new cClient()
  .setEndpoint("https://cloud.appwrite.io/v1") // Setting your Appwrite endpoint from env var
  .setProject("651413f38aee140189c2"); // Setting your project ID from env var

const c_account = new cAccount(c_client);
const c_databases = new cDatabases(c_client);

// Database and collection IDs
const database_id = "651417820a07629ea837";
const studentTable_id = "65420efe2297cbf6acf0";
const parentsTable_id = "6544c4d66694e7b9dc3a";

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
