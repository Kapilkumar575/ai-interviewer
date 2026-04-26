import fetch from "node-fetch";

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://localhost:8000";

// ================= TIMEOUT + RETRY WRAPPER =================
const fetchWithRetry = async (url, options, retries = 2) => {
  try {
    const controller = new AbortController();

    // ⏳ Increased timeout (VERY IMPORTANT FIX)
    const timeout = setTimeout(() => {
      console.log("⏳ AI request taking too long...");
      controller.abort();
    }, 60000); // ✅ 60 seconds

    console.log("🚀 Sending request to AI:", url);

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI Error: ${res.status} - ${text}`);
    }

    const data = await res.json();

    console.log("✅ AI response received");

    return data;

  } catch (error) {
    if (error.name === "AbortError") {
      console.error("❌ AI Timeout (Request Aborted)");
    } else {
      console.error("❌ AI Request Error:", error.message);
    }

    // 🔁 Retry logic
    if (retries > 0) {
      console.log("🔁 Retrying AI request...");
      return fetchWithRetry(url, options, retries - 1);
    }

    throw error;
  }
};

// ================= GENERATE QUESTIONS =================
export const generateQuestions = async (payload) => {
  return fetchWithRetry(`${AI_SERVICE_URL}/generate-questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

// ================= EVALUATE ANSWER =================
export const evaluateAnswer = async (payload) => {
  return fetchWithRetry(`${AI_SERVICE_URL}/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};