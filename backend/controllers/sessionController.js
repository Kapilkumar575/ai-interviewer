// backend/controllers/sessionController.js

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
    const sessionId = req.params.id;
    const { questionIndex, code } = req.body;
    const userId = req.user._id;

    const session = await Session.findById(sessionId);

    if (!session || session.user.toString() !== userId.toString()) {
        res.status(404);
        throw new Error('Session not found or user unauthorized.');
    }

    const questionIdx = parseInt(questionIndex, 10);

    const question = session.questions[questionIdx];

    if (!question) {
        res.status(400);
        throw new Error(`Question at index ${questionIdx} not found.`);
    }

    let audioFilePath = null;
    if (req.file) {
        audioFilePath = req.file.path;
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
    const sessionId = req.params.id;
    const userId = req.user._id;

    const session = await Session.findById(sessionId);

    if (!session || session.user.toString() !== userId.toString()) {
        res.status(404);
        throw new Error("Session not found or user unauthorized.");
    }

    // If it's already completed (e.g. evaluateAnswerAsync finished and
    // marked it completed right before this request landed), don't error —
    // just return the current state.
    if (session.status === "completed") {
        return res.json({
            message: "Session already completed.",
            session,
        });
    }

    let scoreSummary;
    try {
        scoreSummary = await calculateOverallScore(sessionId);
    } catch (err) {
        console.error("calculateOverallScore failed:", err);
        scoreSummary = { overallScore: 0, avgTechnical: 0, avgConfidence: 0 };
    }

    // Atomic update — avoids racing with evaluateAnswerAsync's own session.save()
    const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        {
            $set: {
                overallScore: scoreSummary.overallScore || 0,
                status: "completed",
                endTime: new Date(),
                metrics: {
                    avgTechnical: scoreSummary.avgTechnical,
                    avgConfidence: scoreSummary.avgConfidence,
                },
            },
        },
        { new: true }
    );

    const io = req.app.get("io");

    pushSocketUpdate(
        io,
        userId,
        sessionId,
        "SESSION_COMPLETED",
        "Interview session ended successfully.",
        updatedSession
    );

    // ✅ Respond to the client immediately. Do NOT await the email here —
    // Gmail SMTP from Render can hang for 60-120s, which was making
    // "Finish Interview" take two minutes and (since it was wrapped in
    // try/catch) silently failing without telling anyone.
    res.json({
        message: "Session ended successfully.",
        session: updatedSession,
    });

    // 🔥 Fire-and-forget: runs after the response has already gone out.
    User.findById(userId)
        .then((user) => {
            if (!user?.email) return;
            return sendInterviewReport(
                user.email,
                user.name,
                updatedSession.role,
                updatedSession.level,
                updatedSession.overallScore,
                scoreSummary.avgTechnical,
                scoreSummary.avgConfidence,
                updatedSession.questions,
                updatedSession._id
            );
        })
        .then(() => {
            console.log(`📧 Report email dispatched for session ${sessionId}`);
        })
        .catch((emailError) => {
            console.error("❌ Email sending failed:", emailError);
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