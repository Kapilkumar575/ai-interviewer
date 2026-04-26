import express from "express";
import {
  createSession,
  deleteSession,
  endSession,
  getSessionById,
  getSessions,
  submitAnswer,
} from "../controllers/sessionController.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadSingleAudio } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// 🔐 Protect all routes
router.use(protect);

// ================= ROUTES =================

// Root
router
  .route("/")
  .get(getSessions)
  .post(createSession);

// By ID
router
  .route("/:id")
  .get(getSessionById)
  .delete(deleteSession);

// Actions
router.post("/:id/submit-answer", uploadSingleAudio, submitAnswer);
router.post("/:id/end", endSession);

export default router;