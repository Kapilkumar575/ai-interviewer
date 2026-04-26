import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { toast } from 'react-toastify'
import { updateProfile, reset } from '../features/auth/authSlice'

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
const inputBase = 'w-full bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-2xl p-3.5  sm-4 fornt-semibold text-slate-700 text-base transition-all focus:bg-white focus:border-teal-500 outline-none';
const Profile = () => {
  const dispatch = useDispatch();
  const { user, isSuccess, isError, message, isProfileLoading } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    preferredRole: user?.preferredRole || '',
  })

  useEffect(() => {
    if (!isError && !isSuccess) return
    if (isError) toast.error(message)
    if (isSuccess) toast.success('Profile Updated Successfully')
    dispatch(reset())
  }, [isError, isSuccess, message, dispatch])

  useEffect(() => {
    if (user) {
      setFormData({
        name: user?.name || '',
        email: user?.email || '',
        preferredRole: user?.preferredRole || '',
      });
    }
  }, [user])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.name === user.name && formData.preferredRole === user.preferredRole) {
      toast.info('No changes to save.')
      return
    }
    dispatch(updateProfile(formData))
  }
  return (
    <div className='max-w-4xl px-4 py-6 pb-24 mx-auto sm:py-12'>
      <div className='p-6 bg-white border shadow-xl rounded-3xl sm:shadow-2xl sm:p-12 border-slate-100'>
        <header className='mb-8'>
          <h1 className='text-2xl font-black sm:text-3xl text-slate-900'>Edit Profile</h1>
          <p className='mt-1 text-sm text-slate-500'>
            Update your professional details and preferences
          </p>
        </header>

        <form onSubmit={handleSubmit} className='space-y-6' >

          <FormField label="Full Name">
            <input
              type="text"
              className={inputBase}
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder='Enter your name'
            />
          </FormField>

          <FormField label="Email Address (Fixed)" muted>
            <input
              type="email"
              className='w-full bg-slate-100 rounded-xl sm:rounded-2xl p-3.5  sm-4 fornt-semibold text-slate-500 text-base cursor-not-allowed'
              disabled
              value={formData.email}
              onChange={handleChange}

            />
          </FormField>

           <FormField label="Target Role">
            <div className='relative'>
              <select name="preferredRole" value={formData.preferredRole} onChange={handleChange} className={`${inputBase} appearance-none`}>
                {
                  ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))
                }

              </select>
              <SelectArrow />
            </div>
          </FormField>

          <div className='pt-4'>
            <button
              type='submit'
              disabled={isProfileLoading}
              className={`w-full flex items-center justify-center gap-2 py-4 font-bold rounded-xl sm:rounded-2xl transition-all active:scale-[0.98] ${isProfileLoading ? 'bg-slate-200 text-slate-400 cursor-wait' : 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-100'}`}>
              {
                isProfileLoading ? <Loader /> : 'Save Changes'
              }
              </button>
          </div>
        </form>
      </div>

    </div>
  )
}

export default Profile

function FormField({ label, children, muted }) {

  return (
    <div className={`space-y-1.5 ${muted ? 'opacity-60' : ''}`}>
      <label className='ml-1 text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest'>{label}</label>
      {children}
    </div>

  )
}

function SelectArrow() {
  return (
    <div className='absolute -translate-y-1/2 pointer-events-none right-4 top-1/2 text-slate-400'>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  )
}

function Loader() {
  return (
    <>
      <span className='w-5 h-5 border-2 rounded-full border-slate-400 border-t-transparent animate-spin' />
      <span>Saving...</span>
    </>
  )
}