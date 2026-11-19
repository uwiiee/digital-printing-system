import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { uploadsDir } from "./config/uploads.js";

const app = express();

// "cross-origin" lets the React app (another port) display the uploaded images
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
console.log("CORS allowed origins:", allowedOrigins);
app.use(cors({ origin: allowedOrigins }));

app.use(express.json());
app.use(morgan("dev"));

app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/admin", adminRoutes);

// 404 for unknown routes
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Central error handler: details are shown only for expected (4xx) errors
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res
    .status(status)
    .json({ message: status === 500 ? "Server error" : err.message });
});

export default app;
