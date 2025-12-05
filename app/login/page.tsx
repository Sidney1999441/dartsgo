'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase' // 注意这里的路径也是 ../
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // 处理登录
  const handleLogin = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      setMessage('登录失败: ' + error.message)
    } else {
      setMessage('登录成功！正在跳转...')
      router.push('/') // 登录成功跳回首页
      router.refresh() // 刷新页面状态
    }
    setLoading(false)
  }

  // 处理注册
  const handleSignUp = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage('注册失败: ' + error.message)
    } else {
      setMessage('注册确认邮件已发送！请查收邮箱点击链接验证。')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-lg w-full max-w-md border border-slate-700">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          🎯 选手登录 / 注册
        </h1>

        <div className="space-y-4">
          <div>
            <label className="block text-slate-400 mb-1 text-sm">电子邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 text-sm">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {/* 消息提示区 */}
          {message && (
            <div className={`p-3 rounded text-sm ${message.includes('失败') ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
              {message}
            </div>
          )}

          <div className="flex gap-4 pt-2">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition-colors disabled:opacity-50"
            >
              {loading ? '处理中...' : '登录'}
            </button>
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded transition-colors disabled:opacity-50"
            >
              注册新账号
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}