import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

// ================= INIT =================
dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// ================= SECURITY =================
app.use(helmet());

// ================= LOGGING =================
app.use(morgan("dev"));

// ================= RATE LIMIT =================
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

// ================= CORS (PRODUCTION READY) =================
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.FRONTEND_URL, // deployed frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow Postman / mobile apps (no origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("❌ Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ PREFLIGHT FIX
app.options("*", cors());

// ================= BODY =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: "*", // keep open for now (can restrict later)
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

app.set("io", io);

// ================= SOCKET EVENTS =================
io.on("connection", (socket) => {
  console.log("🔌 User Connected:", socket.id);

  const userId = socket.handshake.query.userId;

  if (userId) {
    socket.join(userId);
    console.log(`✅ User ${socket.id} joined room: ${userId}`);
  }

  socket.on("disconnect", (reason) => {
    console.log("❌ User Disconnected:", reason);
  });
});

// ================= ROUTES =================
app.get("/", (req, res) => {
  res.send("🚀 API running...");
});

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.use("/api/users", userRoutes);
app.use("/api/sessions", sessionRoutes);

// ================= ERROR HANDLING =================
app.use(notFound);
app.use(errorHandler);

// ================= SERVER =================
const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});