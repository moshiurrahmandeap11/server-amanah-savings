import dotenv from "dotenv";
import { MongoClient } from "mongodb";
dotenv.config();

let client;
let dbInstance;

const uri = process.env.MONGO_URI;

const connectDB = async() => {
    try {
        if(!client) {
            client = new MongoClient(uri);
            await client.connect();
            dbInstance = client.db("amanah-savings")
            console.log("MongoDB connected to amanah savings");
        }
        return dbInstance;
    } catch (error) {
        console.log("MongoDB connection failed : ", error.message);
        process.exit(1)
    }
}

// Export a getter that always returns the connected db
export const db = new Proxy({}, {
  get(target, prop) {
    if (!dbInstance) {
      throw new Error("Database not connected yet. Call connectDB() first.");
    }
    return dbInstance[prop];
  }
});

export {connectDB, dbInstance};