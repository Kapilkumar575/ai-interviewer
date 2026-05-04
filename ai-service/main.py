import os
import json
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# ------------------ LOAD ENV ------------------
load_dotenv()

API_KEY = os.getenv("GROQ_API_KEY")

if not API_KEY:
    raise ValueError("❌ GROQ_API_KEY is missing! Check your .env file")

print("✅ API KEY LOADED")

# ------------------ APP ------------------
app = FastAPI(title="AI Interviewer Microservice", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ MODELS ------------------

class QuestionRequest(BaseModel):
    role: str = "MERN Stack Developer"
    level: str = "Junior"
    count: int = 5
    interview_type: str = "coding-mix"

class QuestionResponse(BaseModel):
    questions: list[str]
    model_used: str

class EvaluationRequest(BaseModel):
    question: str
    question_type: str
    role: str
    level: str
    user_answer: Optional[str] = None
    user_code: Optional[str] = None

class EvaluationResponse(BaseModel):
    technicalScore: int
    confidenceScore: int
    aiFeedback: str
    idealAnswer: str

# ------------------ ROOT ------------------

@app.get("/")
def root():
    return {"message": "AI Service Running", "model": "llama3-8b-8192"}

# ------------------ GENERATE QUESTIONS ------------------

@app.post("/generate-questions", response_model=QuestionResponse)
def generate_questions(request: QuestionRequest):

    try:
        instruction = (
            "Include coding and conceptual questions."
            if request.interview_type == "coding-mix"
            else "Only conceptual questions."
        )

        prompt = f"""
Generate exactly {request.count} interview questions.

Role: {request.role}
Level: {request.level}

Rules:
- {instruction}
- No numbering
- One question per line
"""

        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",  # ✅ comma fixed
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.1-8b-instant",  # ✅ updated model
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.6
            }
        )

        data = response.json()
        print("🔹 Groq Response:", data)

        if "choices" not in data:
            raise HTTPException(status_code=500, detail=str(data))

        text = data["choices"][0]["message"]["content"]
        questions = [q.strip() for q in text.split("\n") if q.strip()]

        return QuestionResponse(
            questions=questions[:request.count],
            model_used="llama3-8b-8192"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------ EVALUATION ------------------

@app.post("/evaluate", response_model=EvaluationResponse)
def evaluate(request: EvaluationRequest):

    try:
        prompt = f"""
Evaluate this interview answer.

Question: {request.question}
Answer: {request.user_answer}
Code: {request.user_code}

Return STRICT JSON:
{{
  "technicalScore": 0-100,
  "confidenceScore": 0-100,
  "aiFeedback": "...",
  "idealAnswer": "..."
}}
"""

        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",  # ✅ fixed
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.1-8b-instant",  # ✅ updated model
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2
            }
        )

        data = response.json()
        print("🔹 Evaluation Response:", data)

        if "choices" not in data:
            raise HTTPException(status_code=500, detail=str(data))

        content = data["choices"][0]["message"]["content"]

        try:
            parsed = json.loads(content)
            return EvaluationResponse(**parsed)
        except:
            return EvaluationResponse(
                technicalScore=0,
                confidenceScore=0,
                aiFeedback="Parsing error",
                idealAnswer=content
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))