import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useSelector, useDispatch } from "react-redux"
import { logout, reset } from "../features/auth/authSlice"
const Header = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useSelector((state) => state.auth);

  const onLogout = () => {
    dispatch(logout());
    dispatch(reset());
    navigate("/login");
  }

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 py-2 text-white border-b shadow-2xl bg-slate-900/95 backdrop-blur-md border-slate-700/50">
      <div className="flex justify-between px-4 mx-auto max-w-7xl sm:px-6 lg:px-8 items center">
        <Link to="/" className="flex items-center space-x-2 group shrink-0">
          <div className="bg-teal-500 p-1.5 rounded-lg group-hover:rotate-12 transition-transform duration-300">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>

          </div>
          <span className="text-lg font-black tracking-tighter text-white uppercase transition-colors sm:text-xl group-hover:text-teal-400">AI <span className="text-teal-500">INT</span><span className="hidden sm:inline">erviewer</span></span>
        </Link>
        <nav className="items-center hidden space-x-6 md:flex">
          {user ? (<>
            <Link to="/" className={`text-sm font-bold uppercase tracking-widest transition-all ${isActive('/') ? 'text-teal-400 border-b-2 border-teal-500' : 'text-slate-400 hover:text-white border-b-2 border-transparent'}`}>Dashboard</Link>
            <Link to="/profile" className={`text-sm font-bold uppercase tracking-widest transition-all ${isActive('/profile') ? 'text-teal-400 border-b-2 border-teal-500' : 'text-slate-400 hover:text-white border-b-2 border-transparent'}`}>Profile</Link>
            <div className="flex items-center space-x-2 bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold uppercase text-slate-300">{user.name.split(' ')[0]}</span>
            </div>
            <button onClick={onLogout} className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-widest py-2.5 px-5 rounded-xl transition duration-300 shadow-lg active:scale-95">Logout</button>

          </>) : (<div className="flex space-x-6">
            <Link to="/login" className={`text-sm font-bold uppercase tracking-widest transition-all ${isActive('/login') ? 'text-teal-400 border-b-2 border-teal-500' : 'text-slate-400 hover:text-white border-b-2 border-transparent'}`}>Login</Link>
            <Link to="/register" className={`text-sm font-bold uppercase tracking-widest transition-all ${isActive('/register') ? 'text-teal-400 border-b-2 border-teal-500' : 'text-slate-400 hover:text-white border-b-2 border-transparent'}`}>Register</Link>
          </div>)}
        </nav>

        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 transition-colors border rounded-lg md:hidden bg-slate-800 border-slate-700 text-slate-400 hover:text-teal-400">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>
      
       {isMenuOpen && (
        <div className="duration-300 border-t md:hidden bg-slate-900 border-slate-800 animate-in slide-in-from-top-2">
          <div className="px-6 py-8 space-y-4">
            {user ? (
              <>
                <div className="flex items-center p-4 mb-6 space-x-3 border bg-slate-800 rounded-2xl border-slate-700">
                   <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                   <span className="text-lg font-black tracking-tighter uppercase text-slate-200">{user.name}</span>
                </div>
                <Link to="/" onClick={() => setIsMenuOpen(false)} className={`block py-4 text-xl font-black uppercase tracking-widest border-b border-slate-800 ${isActive('/') ? 'text-teal-400' : 'text-slate-400'}`}>Dashboard</Link>
                <Link to="/profile" onClick={() => setIsMenuOpen(false)} className={`block py-4 text-xl font-black uppercase tracking-widest border-b border-slate-800 ${isActive('/profile') ? 'text-teal-400' : 'text-slate-400'}`}>Profile</Link>
                <button onClick={onLogout} className="w-full py-4 mt-6 font-black tracking-widest text-white uppercase transition-all shadow-xl bg-rose-600 hover:bg-rose-700 rounded-2xl active:scale-95">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsMenuOpen(false)} className={`block py-4 text-xl font-black uppercase tracking-widest border-b border-slate-800 ${isActive('/login') ? 'text-teal-400' : 'text-slate-400'}`}>Login</Link>
                <Link to="/register" onClick={() => setIsMenuOpen(false)} className={`block py-4 text-xl font-black uppercase tracking-widest ${isActive('/register') ? 'text-teal-400' : 'text-slate-400'}`}>Register</Link>
              </>
            )}
          </div>
        </div>
      )}

        
      
    </header>
  )
}

export default Header