import React from 'react'

const NotFound = () => {
  return (
     <div className="text-center py-20 bg-white rounded-[3rem] shadow-xl max-w-2xl mx-auto mt-10 border border-slate-100">
      <h1 className="font-black text-9xl text-slate-200">404</h1>
      <h2 className="mt-4 text-2xl font-bold tracking-tighter uppercase text-slate-800">Page Not Found</h2>
      <p className="mt-2 mb-8 text-slate-500">The interview module you're looking for doesn't exist.</p>
      <Link to="/" className="px-8 py-3 font-bold text-white transition-all bg-teal-600 rounded-2xl hover:bg-teal-700">
        Back to Dashboard
      </Link>
    </div>
  )
}

export default NotFound