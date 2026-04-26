import { useState, useEffect } from "react"
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { createSession, getSessions,reset,deleteSession } from '../features/sessions/sessionSlice'
import { toast } from 'react-toastify'
import SessionCard from "../components/SessionCard"

const ROLES = [
  "MERN Stack Developer",
  "MEAN Stack Developer",
  "Full Stack Python",
  "Full Stack Java",
  "Frontend Developer",
  "Backend Developer",
  "Data Scientist",
  "Data Analyst",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Cloud Engineer (AWS/Azure/GCP)",
  "Cybersecurity Engineer",
  "Blockchain Developer",
  "Mobile Developer (iOS/Android)",
  "Game Developer",
  "UI/UX Designer",
  "QA Automation Engineer",
  "Product Manager"
];
const LEVELS = ["Junior", "Mid-Level", "Senior"];
const TYPES = [{ label: 'Oral only', value: 'oral-only' }, { label: 'Coding Mix', value: 'coding-mix' }];
const COUNTS = [5, 10, 15];

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { sessions, isLoading, isGenerating, isError, message } = useSelector((state) => state.sessions);
  const isProcessing = isGenerating;

  const [formData, setFormData] = useState({
    role: user.preferredRole || ROLES[0],
    level: LEVELS[0],
    interviewType: TYPES[1].value,
    count: COUNTS[0],
  });

  useEffect(() => {
    dispatch(getSessions());
  }, [dispatch]);

  useEffect(() => {
    if (isError && message) {
      toast.error(message);
      dispatch(reset());
    }
  }, [isError, message, dispatch]);

  const onChange = (e) => {
    setFormData((prevState) => ({ ...prevState, [e.target.name]: e.target.value }));
  }

  const onSubmit = (e) => {
    e.preventDefault();
    dispatch(createSession(formData));
  }

  const viewSession = (session) => {
    if (session.status === 'completed') {
      navigate(`/review/${session._id}`);
    } else if(session.status === 'in-progress') {
      navigate(`/interview/${session._id}`);
    }else{
      toast.info('Session not ready yet')
    }
  }


  const handleDelete = (e, sessionId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this session?')) {
      dispatch(deleteSession(sessionId));
      toast.error('Session Deleted')
    }
  }



  return (
    <div className="px-4 py-6 mx-auto space-y-8 duration-700 max-w-7xl sm:px-6 sm:py-12 sm:space-y-12 animate-in">

      <div className="flex flex-col justify-between gap-4 pb-6 border-b sm:flex-row sm:items-center border-slate-200 sm:pb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-4xl text-slate-900">Welcome, <span className="text-teal-600">{user.name.split(' ')[0]}</span> </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 sm:text-lg">Ready for your technical prep?</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-teal-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl border border-teal-100 flex sm:block items-center gap-2">
            <p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider">Total Sessions</p>
            <p className="text-xl font-black leading-none text-teal-700 sm:text-2xl">{sessions.length}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-xl sm:shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 sm:px-8 sm:py-6">
          <h2 className="flex items-center text-lg font-bold text-white">
            <span className="bg-teal-500 w-1.5 h-5 rounded-full mr-3"></span>
            New Interview
          </h2>
        </div>
        <form onSubmit={onSubmit} className="grid items-end grid-cols-1 gap-4 p-6 sm:p-8 md:grid-cols-2 lg:grid-cols-5 sm:gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Role</label>
            <select name="role" value={formData.role} onChange={onChange} className="w-full p-3 text-sm font-semibold border-none bg-slate-50 rounded-xl sm:rounded-2xl text-slate-700 focus:ring-2 focus:ring-teal-500">
              {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:contents">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Level</label>
              <select name="level" value={formData.level} onChange={onChange} className="w-full p-3 text-sm font-semibold border-none bg-slate-50 rounded-xl sm:rounded-2xl text-slate-700 focus:ring-2 focus:ring-teal-500">
                {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Length</label>
              <select name="count" value={formData.count} onChange={onChange} className="w-full p-3 text-sm font-semibold border-none bg-slate-50 rounded-xl sm:rounded-2xl text-slate-700 focus:ring-2 focus:ring-teal-500">
                {COUNTS.map((count) => <option key={count} value={count}>{count} Qs</option>)}</select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
            <select name="interviewType" value={formData.interviewType} onChange={onChange} className="w-full p-3 text-sm font-semibold border-none bg-slate-50 rounded-xl sm:rounded-2xl text-slate-700 focus:ring-2 focus:ring-teal-500">
              {TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
          </div>
          <button type="submit" disabled={isProcessing} className={`w-full h-[48px] rounded-xl font-bold text-white flex items-center justify-center gap-2 ${isProcessing ? 'bg-slate-300' : 'bg-teal-600 hover:bg-teal-700'}`}>
            {isProcessing ? <><span className="w-4 h-4 border-2 border-white rounded-full animate-spin border-t-transparent"></span> Generating...</> : <span className="text-sm">Start Interview</span>}
          </button>
        </form>
</div> {/* 3. Closing div for the card moved here */}

      {/* HISTORY LIST (Now separate from the creation card) */}
      <div className="pb-20 space-y-6 sm:pb-0">
        <h2 className="flex items-center px-2 text-xl font-black sm:text-2xl text-slate-800"><span className="flex items-center justify-center w-8 h-8 mr-3 text-sm rounded-lg sm:w-10 sm:h-10 bg-slate-100 sm:rounded-xl sm:text-lg">📊</span> Interview History</h2>
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-t-2 border-b-2 border-teal-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          sessions.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl sm:rounded-[2rem] py-16 sm:py-20 text-center">
              <p className="text-base font-bold text-slate-400 sm:text-lg">No sessions yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <SessionCard key={session._id} session={session} onClick={viewSession} onDelete={handleDelete}/>
              ))}
            </div>
          )
        )}
      </div>

    </div>
  )
}
export default Dashboard