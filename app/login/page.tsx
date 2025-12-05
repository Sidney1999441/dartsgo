'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleLogin = async () => {
    setLoading(true); setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setMessage('登录失败: ' + error.message) } 
    else {
      setMessage('登录成功！正在跳转...')
      router.push('/'); router.refresh()
    }
    setLoading(false)
  }

  const handleSignUp = async () => {
    setLoading(true); setMessage('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setMessage('注册失败: ' + error.message) } 
    else { setMessage('注册确认邮件已发送！请查收邮箱。') }
    setLoading(false)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-[0.03]"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">欢迎回来</h1>
            <p className="text-slate-400 text-sm">请登录您的 Darts.Pro 选手账号</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="player@darts.pro"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${message.includes('失败') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                {message.includes('失败') ? '⚠️' : '✅'} {message}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? 'Processing...' : '立即登录'}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">Or</span></div>
            </div>

            <button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full bg-transparent hover:bg-white/5 border border-slate-600 text-slate-300 font-medium py-3 rounded-lg transition-colors"
            >
              注册新账号
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}