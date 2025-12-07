'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
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
    const trimmedUsername = username.trim()
    
    if (!trimmedUsername) {
      setMessage('请输入用户名')
      return
    }
    
    // 验证用户名长度（通常数据库约束要求 3-20 个字符）
    if (trimmedUsername.length < 3) {
      setMessage('用户名至少需要 3 个字符')
      return
    }
    
    if (trimmedUsername.length > 20) {
      setMessage('用户名不能超过 20 个字符')
      return
    }
    
    setLoading(true); setMessage('')
    
    // 1. 注册用户
    const { data: authData, error: authError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          username: username.trim()
        }
      }
    })
    
    if (authError) { 
      setMessage('注册失败: ' + authError.message)
      setLoading(false)
      return
    }
    
    // 2. 创建 profile（无论是否启用邮箱确认）
    // 修复：确保注册用户能自动成为选手
    if (authData.user) {
      // 如果用户已创建，立即创建 profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        username: trimmedUsername
      })
      
      if (profileError) {
        // 如果 profile 已存在（可能由触发器创建），尝试更新
        if (profileError.code === '23505' || profileError.message.includes('duplicate')) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ username: trimmedUsername })
            .eq('id', authData.user.id)
          
          if (updateError) {
            console.error('更新用户资料失败:', updateError)
            if (updateError.message.includes('username_length')) {
              setMessage('用户名长度不符合要求（3-20 个字符）')
            } else {
              setMessage('注册成功，但更新用户资料失败: ' + updateError.message)
            }
          } else {
            setMessage('注册成功！用户名已设置。请查收邮箱确认邮件，或直接登录。')
            setTimeout(() => {
              setIsSignUp(false)
              setUsername('')
            }, 2000)
          }
        } else {
          console.error('创建用户资料失败:', profileError)
          if (profileError.message.includes('username_length')) {
            setMessage('用户名长度不符合要求（3-20 个字符）')
          } else {
            setMessage('注册成功，但创建用户资料失败: ' + profileError.message)
          }
        }
      } else {
        setMessage('注册成功！用户名已设置。请查收邮箱确认邮件，或直接登录。')
        // 注册成功后，切换到登录模式
        setTimeout(() => {
          setIsSignUp(false)
          setUsername('')
        }, 2000)
      }
    } else {
      // 如果启用了邮箱确认，authData.user 可能为 null
      // 尝试通过 session 获取用户信息
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // 如果 session 中有用户，尝试创建 profile
        const { error: profileError } = await supabase.from('profiles').insert({
          id: session.user.id,
          username: trimmedUsername
        })
        
        if (profileError && profileError.code !== '23505') {
          console.error('创建用户资料失败:', profileError)
        }
      }
      
      setMessage('注册确认邮件已发送！请查收邮箱并确认后登录。如果用户名未自动设置，请在个人中心设置。')
      setTimeout(() => {
        setIsSignUp(false)
        setUsername('')
      }, 3000)
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-[0.03]"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              {isSignUp ? '创建新账号' : '欢迎回来'}
            </h1>
            <p className="text-neutral-400 text-sm">
              {isSignUp ? '注册您的 SydArts 选手账号' : '请登录您的 SydArts 选手账号'}
            </p>
          </div>

          <div className="space-y-5">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-neutral-950/50 border border-neutral-800 rounded-lg p-3 text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-all"
                  placeholder="请输入您的用户名（3-20 个字符）"
                  minLength={3}
                  maxLength={20}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-950/50 border border-neutral-800 rounded-lg p-3 text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-all"
                placeholder="player@darts.pro"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-950/50 border border-neutral-800 rounded-lg p-3 text-white placeholder-neutral-600 focus:outline-none focus:border-white transition-all"
                placeholder="••••••••"
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${message.includes('失败') ? 'bg-neutral-900/50 text-neutral-300 border border-neutral-800' : 'bg-neutral-900/50 text-white border border-neutral-800'}`}>
                {message.includes('失败') ? '⚠️' : '✅'} {message}
              </div>
            )}

            {!isSignUp ? (
              <>
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-white hover:bg-neutral-200 text-black font-bold py-3.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '处理中...' : '立即登录'}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-800"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0a0a0a] px-2 text-neutral-500">Or</span></div>
                </div>

                <button
                  onClick={() => setIsSignUp(true)}
                  disabled={loading}
                  className="w-full bg-transparent hover:bg-neutral-900 border border-neutral-800 text-neutral-300 font-medium py-3 rounded-lg transition-colors hover:border-neutral-700 hover:text-white"
                >
                  注册新账号
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSignUp}
                  disabled={loading || !username.trim()}
                  className="w-full bg-white hover:bg-neutral-200 text-black font-bold py-3.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '注册中...' : '完成注册'}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-800"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0a0a0a] px-2 text-neutral-500">Or</span></div>
                </div>

                <button
                  onClick={() => {
                    setIsSignUp(false)
                    setUsername('')
                    setMessage('')
                  }}
                  disabled={loading}
                  className="w-full bg-transparent hover:bg-neutral-900 border border-neutral-800 text-neutral-300 font-medium py-3 rounded-lg transition-colors hover:border-neutral-700 hover:text-white"
                >
                  返回登录
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}