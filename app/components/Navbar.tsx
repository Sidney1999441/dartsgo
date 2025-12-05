'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showMenu, setShowMenu] = useState(false) // 用于控制下拉菜单

  // 监听登录状态变化 (更实时的监听)
  useEffect(() => {
    // 1. 初始化检查
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) checkAdmin(user.id)
    }
    checkUser()

    // 2. 订阅状态变化 (比如登录/登出后，导航栏自动变，不需要刷新)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        checkAdmin(session.user.id)
      } else {
        setIsAdmin(false)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const checkAdmin = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    setIsAdmin(profile?.is_admin || false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/') // 退回首页
    router.refresh() // 强制刷新清除缓存
  }

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* 左侧 Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            DARTS.PRO
          </Link>
          <div className="hidden md:flex gap-6 text-sm text-slate-300">
            <Link href="/schedule" className="hover:text-white transition">📅 赛程</Link>
            <Link href="/rankings" className="hover:text-white transition">🏆 排行榜</Link>
          </div>
        </div>

        {/* 右侧 用户状态区 */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="relative flex items-center gap-4">
              {/* 管理员入口 */}
              {isAdmin && (
                <Link href="/admin/schedule">
                   <span className="bg-red-900/50 text-red-200 text-xs px-2 py-1 rounded border border-red-800 cursor-pointer hover:bg-red-800 transition">
                     进入后台
                   </span>
                </Link>
              )}
              
              {/* 用户信息 & 下拉菜单 */}
              <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setShowMenu(!showMenu)}>
                <div className="text-right hidden sm:block">
                    <div className="text-xs text-slate-400">已登录</div>
                    <div className="text-sm font-bold text-white max-w-[100px] truncate">{user.email}</div>
                </div>
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold border border-blue-400">
                    {user.email?.[0].toUpperCase()}
                </div>
              </div>

              {/* 下拉弹窗 */}
              {showMenu && (
                <div className="absolute top-12 right-0 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2 flex flex-col z-50">
                    <Link href="/dashboard" className="px-4 py-2 hover:bg-slate-700 text-sm text-white" onClick={() => setShowMenu(false)}>
                        👤 选手中心
                    </Link>
                    <button onClick={handleSignOut} className="px-4 py-2 hover:bg-slate-700 text-sm text-red-400 text-left w-full">
                        🚪 退出登录
                    </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded font-bold transition">
              登录
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}