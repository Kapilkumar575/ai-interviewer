// backend/services/emailService.js
// ✅ Upgraded HTML email with full session details & structural fixes

import nodemailer from "nodemailer";

// 1. Initialize the transporter instance first

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    // .trim() removes spaces from the beginning and end of strings safely
    user: (process.env.EMAIL_USER || "").trim(),
    pass: (process.env.EMAIL_PASS || "").replace(/\s/g, ""),
  },
});

// 2. Now verify the server connection safe from ReferenceErrors
transporter.verify(function(error, success) {
  if (error) {
    console.log("EMAIL ERROR:", error);
  } else {
    console.log("EMAIL SERVER READY");
  }
});

/**
 * Send a rich interview report email after a session ends.
 *
 * @param {string} email          - User's email address
 * @param {string} username       - User's display name
 * @param {string} role           - Job role practiced (e.g. "MERN Stack Developer")
 * @param {string} level          - Experience level (e.g. "Mid", "Senior")
 * @param {number} overallScore   - Overall score 0–100
 * @param {number} avgTechnical   - Avg technical score 0–100
 * @param {number} avgConfidence  - Avg confidence score 0–100
 * @param {Array}  questions      - Array of question objects with scores & feedback
 * @param {string} sessionId      - MongoDB session ID (for deep link)
 */
export const sendInterviewReport = async (
  
  email,
  username,
  role,
  level = "",
  overallScore = 0,
  avgTechnical = 0,
  avgConfidence = 0,
  questions = [],
  sessionId = ""
) => {
  console.log("Preparing email report for:", email);

  const scoreColor =
    overallScore >= 75 ? "#10b981" : overallScore >= 50 ? "#f59e0b" : "#ef4444";

  const scoreLabel =
    overallScore >= 80
      ? "Excellent"
      : overallScore >= 65
      ? "Good"
      : overallScore >= 50
      ? "Fair"
      : "Needs Improvement";

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build per-question rows (only evaluated questions)
  const evaluatedQuestions = questions.filter((q) => q.isEvaluated);

  const questionRows = evaluatedQuestions
    .map((q, i) => {
      const techColor =
        q.technicalScore >= 75
          ? "#10b981"
          : q.technicalScore >= 50
          ? "#f59e0b"
          : "#ef4444";

      const cleanQuestion = q.questionText.replace(/^\d+[\s\.\)]+/, "").trim();

      return `
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid #1e1e2e; color:#6b6478; font-size:12px; white-space:nowrap; vertical-align:top;">Q${i + 1}</td>
        <td style="padding:12px 16px; border-bottom:1px solid #1e1e2e; color:#c9c2b4; font-size:13px; line-height:1.5; vertical-align:top;">${cleanQuestion}</td>
        <td style="padding:12px 16px; border-bottom:1px solid #1e1e2e; font-weight:700; font-size:13px; color:${techColor}; white-space:nowrap; vertical-align:top;">${q.technicalScore}%</td>
        <td style="padding:12px 16px; border-bottom:1px solid #1e1e2e; font-weight:700; font-size:13px; color:#a5b4fc; white-space:nowrap; vertical-align:top;">${q.confidenceScore}%</td>
      </tr>
      <tr>
        <td colspan="4" style="padding:0 16px 14px 32px; border-bottom:1px solid #1e1e2e; color:#8b8499; font-size:12px; font-style:italic; line-height:1.5;">
          💬 ${q.aiFeedback || "No feedback available."}
        </td>
      </tr>
    `;
    })
    .join("");

  const reviewLink = sessionId
    ? `https://ai-interviewer-five-umber.vercel.app/review/${sessionId}`
    : `https://ai-interviewer-five-umber.vercel.app`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Interview Report</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;color:#e8e3d9;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">

    <div style="background:linear-gradient(135deg,#12121e 0%,#0d0d18 100%);border-radius:20px 20px 0 0;border:1px solid #2a2a3e;border-bottom:none;padding:40px;text-align:center;">
      <p style="margin:0 0 16px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#6366f1;font-weight:700;">AI Interviewer</p>
      <h1 style="margin:0;font-size:26px;font-weight:300;color:#f0ebe0;line-height:1.3;">Interview Complete</h1>
      <p style="margin:10px 0 0;color:#6b6478;font-size:13px;">${username} &nbsp;·&nbsp; ${role}${level ? ` (${level})` : ""} &nbsp;·&nbsp; ${date}</p>
    </div>

    <div style="background:#0d0d18;border:1px solid #2a2a3e;border-top:none;border-bottom:none;padding:40px;text-align:center;">
      <div style="display:inline-block;width:110px;height:110px;border-radius:50%;border:3px solid ${scoreColor};line-height:1;padding-top:22px;box-sizing:border-box;margin-bottom:12px;">
        <div style="font-size:38px;font-weight:700;color:${scoreColor};">${overallScore}</div>
        <div style="font-size:13px;color:#4a4558;">/100</div>
      </div>
      <div style="font-size:15px;color:#c9c2b4;letter-spacing:1px;margin-bottom:24px;">${scoreLabel}</div>

      <table style="width:100%;max-width:360px;margin:0 auto;border-collapse:collapse;">
        <tr>
          <td style="text-align:center;padding:0 12px;">
            <div style="font-size:22px;font-weight:700;color:#10b981;">${avgTechnical}%</div>
            <div style="font-size:10px;color:#6b6478;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Technical</div>
          </td>
          <td style="text-align:center;padding:0 12px;border-left:1px solid #1e1e2e;border-right:1px solid #1e1e2e;">
            <div style="font-size:22px;font-weight:700;color:#a5b4fc;">${avgConfidence}%</div>
            <div style="font-size:10px;color:#6b6478;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Confidence</div>
          </td>
          <td style="text-align:center;padding:0 12px;">
            <div style="font-size:22px;font-weight:700;color:#f59e0b;">${evaluatedQuestions.length}/${questions.length}</div>
            <div style="font-size:10px;color:#6b6478;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Answered</div>
          </td>
        </tr>
      </table>
    </div>

    ${
      questionRows
        ? `
    <div style="background:#0d0d18;border:1px solid #2a2a3e;border-top:none;border-bottom:none;padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#6366f1;font-weight:700;border-bottom:1px solid #1e1e2e;padding-bottom:12px;">Question Breakdown</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 16px;font-size:10px;color:#4a4558;text-transform:uppercase;letter-spacing:1px;font-weight:700;">#</th>
            <th style="text-align:left;padding:8px 16px;font-size:10px;color:#4a4558;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Question</th>
            <th style="text-align:left;padding:8px 16px;font-size:10px;color:#4a4558;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Tech</th>
            <th style="text-align:left;padding:8px 16px;font-size:10px;color:#4a4558;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Conf</th>
          </tr>
        </thead>
        <tbody>
          ${questionRows}
        </tbody>
      </table>
    </div>`
        : ""
    }

    <div style="background:#0d0d18;border:1px solid #2a2a3e;border-top:none;border-bottom:none;padding:32px 40px;text-align:center;">
      <p style="margin:0 0 20px;color:#8b8499;font-size:14px;line-height:1.6;">View your full detailed report with ideal answers and AI feedback.</p>
      <a href="${reviewLink}" style="display:inline-block;padding:14px 36px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:100px;font-size:14px;font-weight:700;letter-spacing:0.5px;">View Full Report →</a>
    </div>

    <div style="background:#080810;border:1px solid #2a2a3e;border-top:none;border-radius:0 0 20px 20px;padding:24px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#3a3448;line-height:1.7;">
        You're receiving this because you completed an interview on 
        <a href="https://ai-interviewer-five-umber.vercel.app" style="color:#6366f1;text-decoration:none;">AI Interviewer</a>.<br/>
        Ready to improve? <a href="https://ai-interviewer-five-umber.vercel.app" style="color:#6366f1;text-decoration:none;">Start another session</a>.
      </p>
    </div>

  </div>
</body>
</html>`;

  const info = await transporter.sendMail({
    from: `"AI Interviewer" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your Interview Report — ${role} · ${overallScore}/100 (${scoreLabel})`,
    html,
  });

  console.log("✅ Email sent:", info.messageId);
  return info;
};