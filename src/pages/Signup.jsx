import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ClipLoader } from 'react-spinners'
import { useAuth } from '../context/AuthContext'
import AuthCard from '../components/AuthCard'
import { signupSchema, zodResolver } from '../lib/schemas'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [serverErr, setServerErr] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(signupSchema), defaultValues: { displayName: '', email: '', password: '' } })

  async function onSubmit(values) {
    setServerErr('')
    try {
      await signup(values)
      navigate('/link')
    } catch (e) {
      setServerErr(e.message.replace('Firebase: ', ''))
    }
  }

  return (
    <AuthCard>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="block text-xs text-[#6b5a6d] mt-3.5 mb-1.5 font-semibold">
          Your name
        </label>
        <input
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="What your partner calls you"
          {...register('displayName')}
        />
        {errors.displayName && (
          <div className="text-xs text-[#9b3b3b] mt-1">{errors.displayName.message}</div>
        )}

        <label className="block text-xs text-[#6b5a6d] mt-3.5 mb-1.5 font-semibold">
          Email
        </label>
        <input
          type="email"
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          {...register('email')}
        />
        {errors.email && <div className="text-xs text-[#9b3b3b] mt-1">{errors.email.message}</div>}

        <label className="block text-xs text-[#6b5a6d] mt-3.5 mb-1.5 font-semibold">
          Password
        </label>
        <input
          type="password"
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="At least 6 characters"
          {...register('password')}
        />
        {errors.password && (
          <div className="text-xs text-[#9b3b3b] mt-1">{errors.password.message}</div>
        )}

        {serverErr && (
          <div className="bg-[#fbe4e4] text-[#9b3b3b] text-sm px-3 py-2 rounded-lg mt-3.5">{serverErr}</div>
        )}
        <button
          disabled={isSubmitting}
          className="w-full mt-5 py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isSubmitting && <ClipLoader size={14} color="#3d2340" />}
          {isSubmitting ? 'Creating account' : 'Create account'}
        </button>
      </form>
      <div className="text-center mt-4 text-sm text-[#7a6a7c]">
        Already have one?{' '}
        <Link to="/login" className="text-peach font-semibold">
          Log in
        </Link>
      </div>
    </AuthCard>
  )
}
