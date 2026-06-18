// backend/controllers/sessionController.js
// ✅ FIXED endSession — variables declared before use, email integration confirmed working

import { sendInterviewReport } from "../services/emailService.js";
import User from "../models/userModel.js";
import asyncHandler from 'express-async-handler';
import Session from '../models/SessionModel.js';
import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import mongoose from 'mongoose';

const AI_SERVICE_URL = 'https://ai-service-a85e.onrender.com';

const pushSocketUpdate = (io, userId, sessionId, status, message, session = null) => {
    io.to(userId.toString()).emit('sessionUpdate', {
        sessionId,
        status,
        message,
        session,
    });
};

// @desc    Create a new interview session and start AI question generation
// @route   POST /api/sessions/
// @access  Private
const createSession = asyncHandler(async (req, res) => {
    const { role, level, interviewType, count } = req.body;
    const userId = req.user._id;

    if (!role || !level || !interviewType || !count) {
        res.status(400);
        throw new Error('Please specify role, level, interview type, and question count.');
    }

    let session = await Session.create({
        user: userId,
        role,
        level,
        interviewType,
        status: 'pending',
    });

    const io = req.app.get('io');

    res.status(202).json({
        message: 'Session created. Generating questions asynchronously...',
        sessionId: session._id,
        status: 'processing',
    });

    (async () => {
        try {
            pushSocketUpdate(io, userId, session._id, 'AI_GENERATING_QUESTIONS', `Generating ${count} questions for ${role}...`);

            const aiResponse = await fetch(`${AI_SERVICE_URL}/generate-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role,
                    level,
                    count,
                    interview_type: interviewType
                }),
            });

            if (!aiResponse.ok) {
                const errorBody = await aiResponse.text();
                throw new Error(`AI Service error: ${aiResponse.status} - ${errorBody}`);
            }

            const aiData = await aiResponse.json();
            const codingCount = interviewType === 'coding-mix' ? Math.floor(count * 0.2) : 0;

            const questionsArray = aiData.questions.map((qText, index) => ({
                questionText: qText,
                questionType: index < codingCount ? 'coding' : 'oral',
                isEvaluated: false,
                isSubmitted: false,
            }));

            session.questions = questionsArray;
            session.status = 'in-progress';
            await session.save();

            pushSocketUpdate(io, userId, session._id, 'QUESTIONS_READY', 'Questions generated successfully. Starting session.', session);

        } catch (error) {
            console.error(`Session Creation Failure for ${session._id}:`, error.message);
            session.status = 'failed';
            await session.save();
            pushSocketUpdate(io, userId, session._id, 'GENERATION_FAILED', `Question generation failed. Reason: ${error.message}.`);
        }
    })();
});

// @desc    Get all interview sessions for the current user
// @route   GET /api/sessions/
// @access  Private
const getSessions = asyncHandler(async (req, res) => {
    const sessions = await Session.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .select('-questions.userAnswerText -questions.userSubmittedCode');
    res.json(sessions);
});

// @desc    Get a specific session detail
// @route   GET /api/sessions/:id
// @access  Private
const getSessionById = asyncHandler(async (req, res) => {
    const session = await Session.findOne({ _id: req.params.id, user: req.user._id });

    if (session) {
        res.json(session);
    } else {
        res.status(404);
        throw new Error('Session not found or user unauthorized.');
    }
});

// @desc    Delete a session
// @route   DELETE /api/sessions/:id
// @access  Private
const deleteSession = asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.id);

    if (!session) {
        res.status(404);
        throw new Error('Session not found');
    }

    if (session.user.toString() !== req.user.id) {
        res.status(401);
        throw new Error('Not authorized');
    }

    await session.deleteOne();
    res.status(200).json({ id: req.params.id });
});

const evaluateAnswerAsync = async (io, userId, sessionId, questionIndex, audioFilePath = null, code = null) => {
    let transcription = "";

    const questionIdx = typeof questionIndex === 'string' ? parseInt(questionIndex, 10) : questionIndex;

    const session = await Session.findById(sessionId);
    if (!session) {
        console.error(`Session ${sessionId} not found`);
        return;
    }

    const question = session.questions[questionIdx];
    if (!question) {
        pushSocketUpdate(io, userId, sessionId, 'EVALUATION_FAILED', `Q${questionIdx + 1} not found.`, null);
        return;
    }

    if (audioFilePath) {
        try {
            pushSocketUpdate(io, userId, sessionId, 'AI_TRANSCRIBING', `Transcribing audio for Q${questionIdx + 1}...`);
            const formData = new FormData();
            formData.append('file', fs.createReadStream(audioFilePath));

            const transResponse = await fetch(`${AI_SERVICE_URL}/transcribe`, {
                method: 'POST',
                body: formData,
                headers: formData.getHeaders(),
            });

            if (!transResponse.ok) throw new Error('Transcription service failed');

            const transData = await transResponse.json();
            transcription = transData.transcription || "";
        } catch (error) {
            console.error(`Transcription Error: ${error.message}`);
        } finally {
            if (audioFilePath && fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
        }
    }

    try {
        pushSocketUpdate(io, userId, sessionId, 'AI_EVALUATING', `AI is analyzing Q${questionIdx + 1}...`);

        const evalResponse = await fetch(`${AI_SERVICE_URL}/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question.questionText,
                question_type: question.questionType,
                role: session.role,
                level: session.level,
                user_answer: transcription,
                user_code: code || "",
            }),
        });

        if (!evalResponse.ok) throw new Error('AI Evaluation service failed');

        const evalData = await evalResponse.json();

        question.userAnswerText = transcription;
        question.userSubmittedCode = code || "";
        question.technicalScore = evalData.technicalScore;
        question.confidenceScore = evalData.confidenceScore;
        question.aiFeedback = evalData.aiFeedback;
        question.idealAnswer = evalData.idealAnswer;
        question.isEvaluated = true;

        const allQuestionsEvaluated = session.questions.every(q => q.isEvaluated);

        if (session.status === 'completed' || allQuestionsEvaluated) {
            const scoreSummary = await calculateOverallScore(sessionId);

            session.overallScore = scoreSummary.overallScore || 0;
            session.metrics = {
                avgTechnical: scoreSummary.avgTechnical,
                avgConfidence: scoreSummary.avgConfidence,
            };

            if (allQuestionsEvaluated) {
                session.status = 'completed';
                session.endTime = session.endTime || new Date();
            }

            await session.save();
            pushSocketUpdate(io, userId, sessionId, 'SESSION_COMPLETED', 'Scores finalized.', session);
        } else {
            await session.save();
            pushSocketUpdate(io, userId, sessionId, 'EVALUATION_COMPLETE', `Feedback for Q${questionIdx + 1} is ready!`, session);
        }

    } catch (error) {
        console.error(`Evaluation Error: ${error.message}`);
        pushSocketUpdate(io, userId, sessionId, 'EVALUATION_FAILED', `Evaluation failed.`, session);
    }
};

// @desc    Submit an answer (Audio or Code)
// @route   POST /api/sessions/:id/submit-answer
// @access  Private
const submitAnswer = asyncHandler(async (req, res) => {
    console.log("========== SUBMIT ANSWER ==========");
console.log("BODY:", req.body);
console.log("FILE:", req.file);
console.log("USER:", req.user);
    const sessionId = req.params.id;
    const { questionIndex, code } = req.body;
    const userId = req.user._id;

    const session = await Session.findById(sessionId);
    console.log("SESSION FOUND:", !!session);

    if (!session || session.user.toString() !== userId.toString()) {
        res.status(404);
        throw new Error('Session not found or user unauthorized.');
    }

    const questionIdx = parseInt(questionIndex, 10);
   
    const question = session.questions[questionIdx];
    console.log("questionIndex =", questionIndex);
console.log("parsed =", questionIdx);
console.log("questions count =", session.questions.length);

    if (!question) {
        res.status(400);
        throw new Error(`Question at index ${questionIdx} not found.`);
    }

    let audioFilePath = null;
  if (req.file) {
    console.log("Audio received");
    console.log(req.file);

    audioFilePath = req.file.path;
    console.log("audioFilePath =", audioFilePath);
}
    const codeSubmission = code || null;

    question.isSubmitted = true;
    await session.save();

    res.status(202).json({
        message: 'Answer received. Processing asynchronously...',
        status: 'received',
    });

    const io = req.app.get('io');
    evaluateAnswerAsync(io, userId, sessionId, questionIdx, audioFilePath, codeSubmission);
});

const calculateOverallScore = async (sessionId) => {
    const results = await Session.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(sessionId) } },
        { $unwind: '$questions' },
        {
            $group: {
                _id: '$_id',
                avgTechnical: {
                    $avg: { $cond: [{ $eq: ['$questions.isEvaluated', true] }, '$questions.technicalScore', 0] }
                },
                avgConfidence: {
                    $avg: { $cond: [{ $eq: ['$questions.isEvaluated', true] }, '$questions.confidenceScore', 0] }
                }
            }
        },
        {
            $project: {
                _id: 0,
                overallScore: { $round: [{ $avg: ['$avgTechnical', '$avgConfidence'] }, 0] },
                avgTechnical: { $round: ['$avgTechnical', 0] },
                avgConfidence: { $round: ['$avgConfidence', 0] },
            }
        }
    ]);

    return results[0] || { overallScore: 0, avgTechnical: 0, avgConfidence: 0 };
};

// @desc    End the session early
// @route   POST /api/sessions/:id/end
// @access  Private
const endSession = asyncHandler(async (req, res) => {
    // ✅ FIX: Declare variables BEFORE using them in console.log
    const sessionId = req.params.id;
    const userId = req.user._id;

    console.log("===== END SESSION API HIT =====");
    console.log("Session ID:", sessionId);
    console.log("User ID:", userId);

    const session = await Session.findById(sessionId);

    if (!session || session.user.toString() !== userId.toString()) {
        res.status(404);
        throw new Error("Session not found or user unauthorized.");
    }

    const isProcessing = session.questions.some(
        q => q.isSubmitted && !q.isEvaluated
    );

    if (isProcessing) {
        res.status(400);
        throw new Error("Cannot end interview while AI is processing answers.");
    }

    if (session.status === "completed") {
        res.status(400);
        throw new Error("Session is already completed.");
    }

    const scoreSummary = await calculateOverallScore(sessionId);

    session.overallScore = scoreSummary.overallScore || 0;
    session.status = "completed";
    session.endTime = new Date();
    session.metrics = {
        avgTechnical: scoreSummary.avgTechnical,
        avgConfidence: scoreSummary.avgConfidence,
    };

    await session.save();

    // ✅ EMAIL: Send interview report to user
    try {
        const user = await User.findById(userId);
        console.log("User found:", user?.email);

        if (user?.email) {
            await sendInterviewReport(
                user.email,
                user.name,
                session.role,
                session.level,
                session.overallScore,
                scoreSummary.avgTechnical,
                scoreSummary.avgConfidence,
                session.questions,
                session._id
            );
            console.log("✅ Interview report email sent to:", user.email);
        }
    } catch (emailError) {
        // ⚠️ Non-fatal: log but don't crash the response
        console.error("❌ Email sending failed:", emailError.message);
    }

    const io = req.app.get("io");

    pushSocketUpdate(
        io,
        userId,
        sessionId,
        "SESSION_COMPLETED",
        "Interview session ended successfully.",
        session
    );

    res.json({
        message: "Session ended successfully.",
        session,
    });
});

export {
    createSession,
    getSessionById,
    getSessions,
    submitAnswer,
    endSession,
    calculateOverallScore,
    deleteSession
};