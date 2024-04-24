// appwriteConfig.js
import { Client, Account, Databases, Permission, Role, Query as QueryQ } from "appwrite";

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.EXAM_APPWRITE_PROJECT_ID);
const account = new Account(client);
const databasesQ = new Databases(client);

//Cloud - Appwrite
const database_idQ = "651bceb8a8cad669ed8c";
const sstTablePLE_id = "65a90a70741e52dd96fe"
const mathPLE_id = "65c5cdfe8c088bce8e52";
const engTbalePLE_id = "65a7b4784e6c73e9b823";
const sciTablePLE_id = "65ca0733ec7937ed2f96"

export {
    client,
    account,
    databasesQ,
    database_idQ,
    sstTablePLE_id,
    mathPLE_id,
    engTbalePLE_id,
    sciTablePLE_id,
    Permission,
    Role,
    QueryQ,
};
