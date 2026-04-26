import  { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, Link } from 'react-router-dom';
import { getSessionById } from '../features/sessions/sessionSlice';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const formatDuration = (start, end) => {
    if (!start || !end) return 'N/A';
    const diff = new Date(end) - new Date(start);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
};

const sanitizeQuestionText = (text) => {
    return text.replace(/^\d+[\s\.\)]+/, '').trim();
};

const formatIdealAnswer = (text) => {
    try {
        if (!text) return "Pending evaluation.";

        let cleanText = text.trim();

        // 1. Remove Markdown code blocks if the AI added them (e.g., ```json ... ```)
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        }

        // 2. Check if it's a JSON object
        if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
            const parsed = JSON.parse(cleanText);

            // Scenario A: The "Merged" Hallucination (Fixes Screenshot 266)
            // The AI put the score object inside the answer. We extract just the answer.
            if (parsed.verbalAnswer || parsed.idealAnswer || parsed.idealanswer) {
                return parsed.verbalAnswer || parsed.idealAnswer || parsed.idealanswer;
            }

            // Scenario B: Structured Explanation (Fixes Screenshot 267/268)
            const explanation = parsed.explanation || parsed.understanding || "";
            const code = parsed.code || parsed.codeExample || parsed.example || "";

            if (explanation || code) {
                return `${explanation}\n\n${code}`.trim();
            }
        }

        // Scenario C: It's just a normal string
        return text;
    } catch (e) {
        // If parsing fails, just show the raw text so nothing crashes
        return text;
    }
};

function SessionReview() {
    const { sessionId } = useParams();
    const dispatch = useDispatch();
    const { activeSession, isLoading } = useSelector(state => state.sessions);

    useEffect(() => {
        dispatch(getSessionById(sessionId));
    }, [dispatch, sessionId]);

    if (isLoading) return <div className="py-20 font-bold tracking-widest text-center uppercase text-slate-400 animate-pulse">Generating Analysis...</div>;

    if (!activeSession || activeSession.status !== 'completed') {
        return (
            <div className="max-w-xl mx-auto mt-10 sm:mt-20 p-6 sm:p-10 bg-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl text-center border border-slate-100 ">
                <h2 className="mb-4 text-xl font-black tracking-tighter uppercase sm:text-2xl text-slate-800">Report Not Ready</h2>
                <p className="mb-8 text-sm font-medium text-slate-500 sm:text-base">This session is still being processed by our AI network.</p>
                <Link to="/" className="inline-block px-8 py-3 text-xs font-black tracking-widest text-white uppercase transition bg-teal-600 shadow-xl sm:px-10 sm:py-4 rounded-2xl hover:bg-teal-700 active:scale-95 sm:text-sm">Dashboard</Link>
            </div>
        );
    }

    const { overallScore, metrics, role, level, questions, startTime, endTime } = activeSession;
    const finalMetrics = metrics || {};

    const barData = {
        labels: questions.map((_, i) => `Q${i + 1}`),
        datasets: [{
            label: 'Technical Score',
            data: questions.map(q => q.technicalScore || 0),
            backgroundColor: questions.map(q => (q.technicalScore || 0) > 70 ? '#10b981' : '#f59e0b'),
            borderRadius: 8,
        }],
    };

    return (
        <div className="px-4 py-8 mx-auto space-y-8 duration-700 max-w-7xl sm:px-6 sm:py-12 sm:space-y-12 animate-in fade-in">

            {/* --- Header --- */}
            <div className="flex flex-col items-start justify-between gap-4 pb-6 border-b md:flex-row md:items-end border-slate-100 sm:pb-10">
                <div>
                    <span className="text-teal-600 font-black uppercase tracking-[0.2em] text-[10px]">Assessment Complete</span>
                    <h1 className="mt-2 text-3xl font-black tracking-tight uppercase sm:text-5xl text-slate-900">
                        {role} <span className="block font-medium lowercase text-slate-300 sm:inline">({level})</span>
                    </h1>
                </div>
            </div>

            {/* --- Summary Stats --- */}
            <div className="grid grid-cols-2 gap-4 pb-4 overflow-x-auto lg:grid-cols-4 sm:pb-0 no-scrollbar snap-x">
                {[
                    { label: 'Overall Result', value: `${overallScore}%`, color: 'teal' },
                    { label: 'Avg Technical', value: `${finalMetrics.avgTechnical}%`, color: 'slate' },
                    { label: 'Avg Confidence', value: `${finalMetrics.avgConfidence}%`, color: 'slate' },
                    { label: 'Session Time', value: formatDuration(startTime, endTime), color: 'slate' }
                ].map((stat, i) => (
                    <div key={i} className={`min-w-[160px] snap-center bg-white p-6 sm:p-8 rounded-3xl sm:rounded-[2.5rem] shadow-sm border-l-[8px] ${stat.color === 'teal' ? 'border-teal-500' : 'border-slate-100'}`}>
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{stat.label}</p>
                        <p className={`text-2xl sm:text-4xl font-black mt-2 leading-none ${stat.color === 'teal' ? 'text-teal-600' : 'text-slate-800'}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* --- Chart --- */}
            <div className="bg-white p-6 sm:p-10 rounded-3xl sm:rounded-[3rem] shadow-sm border border-slate-50">
                <h3 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-[0.2em]">Per-Question Performance</h3>
                <div className="h-64 sm:h-80">
                    <Bar
                        data={barData}
                        options={{
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true, max: 100, grid: { color: '#f8fafc' } },
                                x: { grid: { display: false } }
                            }
                        }}
                    />
                </div>
            </div>

            {/* --- Detailed Question Review --- */}
            <div className="space-y-6 sm:space-y-10">
                <h3 className="flex items-center px-2 text-xl font-black tracking-tighter uppercase sm:text-3xl text-slate-900">
                    <span className="flex items-center justify-center w-8 h-8 mr-3 text-base text-white sm:w-12 sm:h-12 bg-slate-900 rounded-xl sm:rounded-2xl sm:mr-5 sm:text-xl">✓</span>
                    Answer Intelligence
                </h3>
                <div className="space-y-6 sm:space-y-10">
                    {questions.map((q, index) => (
                        <div key={index} className="bg-white rounded-3xl sm:rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-lg transition-all duration-500">
                            <div className="p-6 space-y-6 sm:p-10 sm:space-y-8">

                                {/* Header: Question & Scores */}
                                <div className="flex flex-col items-start justify-between gap-4 lg:flex-row sm:gap-6">
                                    <h4 className="flex-1 text-lg font-bold leading-snug sm:text-2xl text-slate-800">
                                        <span className="mr-2 italic font-black text-teal-500">Q{index + 1}.</span> {sanitizeQuestionText(q.questionText)}
                                    </h4>
                                    <div className="flex gap-2 shrink-0">
                                        <div className="px-3 py-1.5 sm:px-5 sm:py-2 rounded-xl sm:rounded-2xl border flex items-center gap-2 bg-emerald-50 border-emerald-100">
                                            <span className="text-[8px] sm:text-[10px] font-black uppercase text-slate-400">Tech</span>
                                            <span className="text-xs font-black sm:text-sm text-emerald-600">{q.technicalScore}%</span>
                                        </div>
                                        <div className="px-3 py-1.5 sm:px-5 sm:py-2 rounded-xl sm:rounded-2xl border border-blue-50 bg-blue-50/30 flex items-center gap-2">
                                            <span className="text-[8px] sm:text-[10px] font-black uppercase text-slate-400">Conf</span>
                                            <span className="text-xs font-black text-blue-600 sm:text-sm">{q.confidenceScore}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* --- User's Submission Display (Corrected) --- */}
                                <div className="space-y-3">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] block ml-1">Your Submission</label>
                                    <div className="bg-slate-50 rounded-2xl sm:rounded-[2rem] border border-slate-100 overflow-hidden">

                                        {/* Display Code if available */}
                                        {q.userSubmittedCode && q.userSubmittedCode !== "undefined" && (
                                            <div className="p-4 border-b sm:p-6 border-slate-200 last:border-0">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Code</span>
                                                <pre className="text-[11px] sm:text-xs font-mono text-slate-700 whitespace-pre-wrap overflow-x-auto">
                                                    {q.userSubmittedCode}
                                                </pre>
                                            </div>
                                        )}

                                        {/* Display Transcript if available */}
                                        {q.userAnswerText && (
                                            <div className="p-4 sm:p-6">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Transcript</span>
                                                <p className="text-xs italic leading-relaxed sm:text-sm text-slate-600">
                                                    "{q.userAnswerText}"
                                                </p>
                                            </div>
                                        )}

                                        {/* Fallback if nothing was recorded */}
                                        {(!q.userSubmittedCode || q.userSubmittedCode === "undefined") && !q.userAnswerText && (
                                            <div className="p-6 text-xs italic text-center text-slate-400">
                                                No answer recorded.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Feedback & Ideal Answer Grid */}
                                <div className="grid grid-cols-1 gap-6 pt-6 border-t lg:grid-cols-2 sm:gap-10 sm:pt-8 border-slate-50">
                                    <div className="space-y-3">
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] block ml-1">AI Analytical Feedback</label>
                                        <div className="bg-slate-50/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] text-xs sm:text-sm italic text-slate-600 border-l-[4px] sm:border-l-[6px] border-teal-500 leading-relaxed">
                                            "{q.aiFeedback}"
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] block ml-1">Ideal Implementation</label>
                                        <pre className="bg-slate-900 text-slate-400 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] text-[11px] sm:text-[13px] overflow-x-auto whitespace-pre-wrap font-mono shadow-inner leading-relaxed">
                                            {/* Using the updated helper function here */}
                                            {formatIdealAnswer(q.idealAnswer)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default SessionReview;