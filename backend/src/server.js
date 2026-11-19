import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB(process.env.MONGODB_URI);

    app.listen(PORT, function () {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start:", error.message);
    process.exit(1);
  }
}

startServer();