'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkUser()
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
    })
    return () => { authListener.subscription.unsubscribe() }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#0a0a0a]/80 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* LOGO: DartsGo (极简风格) */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black font-black text-sm group-hover:scale-105 transition-transform">
            D
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            DartsGo
          </span>
        </Link>

        {/* 桌面端菜单 */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
          <Link href="/schedule" className="hover:text-white transition-colors">赛程</Link>
          <Link href="/rankings" className="hover:text-white transition-colors">排行榜</Link>
          {/* 这里可以加个分隔符 */}
          <div className="w-px h-4 bg-neutral-800"></div>
          
          {user ? (
            <div className="relative group">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <span>{user.email?.split('@')[0]}</span>
                <div className="w-6 h-6 bg-neutral-800 rounded-full flex items-center justify-center text-[10px] text-neutral-400 border border-neutral-700">
                   {user.email?.[0].toUpperCase()}
                </div>
              </button>

              {/* 极简下拉菜单 */}
              {showMenu && (
                <div className="absolute top-10 right-0 w-48 bg-[#0a0a0a] border border-neutral-800 rounded-md shadow-2xl py-1 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <Link href="/dashboard" className="px-4 py-2 hover:bg-neutral-900 text-sm text-neutral-300 hover:text-white text-left">
                        个人中心
                    </Link>
                    <Link href="/admin/schedule" className="px-4 py-2 hover:bg-neutral-900 text-sm text-neutral-300 hover:text-white text-left">
                        管理后台
                    </Link>
                    <button onClick={handleSignOut} className="px-4 py-2 hover:bg-red-950/30 text-sm text-red-500 hover:text-red-400 text-left w-full border-t border-neutral-900 mt-1">
                        退出登录
                    </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="text-white hover:text-neutral-300 transition-colors">
              登录
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}