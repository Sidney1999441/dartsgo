'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname() // 获取当前在哪个页面，方便高亮菜单
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdmin = async () => {
      // 1. 获取当前用户
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login') 
        return
      }

      // 2. 查查是不是管理员
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        alert('🚫 权限不足：只有管理员可以访问后台！')
        router.push('/') 
      } else {
        setLoading(false)
      }
    }
    checkAdmin()
  }, [router])

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center text-neutral-400">🔐 正在验证管理员身份...</div>
  }

  // 菜单项配置
  const menuItems = [
    { name: '📅 赛事录入', href: '/admin/schedule' },
    { name: '⚡️ 新建赛程', href: '/admin/tournaments' },
    { name: '🛡️ 战队管理', href: '/admin/teams' },
    { name: '👥 选手管理', href: '/admin/players' },
    { name: '👤 用户管理', href: '/admin/users' },
    { name: '🎲 随机组队', href: '/admin/team-generator' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col md:flex-row">
      {/* 后台侧边栏 */}
      <aside className="w-full md:w-64 bg-neutral-950 border-r border-neutral-800 p-6 flex-shrink-0">
        <div className="mb-8 flex items-center gap-2">
            <span className="bg-white w-2 h-6 rounded-full"></span>
            <h2 className="text-xl font-bold text-white">管理后台</h2>
        </div>
        
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link 
                key={item.href}
                href={item.href} 
                className={`block px-4 py-3 rounded-lg transition-colors ${
                    isActive 
                    ? 'bg-white text-black font-bold' 
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                {item.name}
              </Link>
            )
          })}
          
          <div className="pt-8 mt-8 border-t border-neutral-800">
            <Link href="/" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 text-sm px-4">
                <span>←</span> 返回前台首页
            </Link>
          </div>
        </nav>
      </aside>

      {/* 后台内容区 */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-[#0a0a0a]">
        {children}
      </main>
    </div>
  )
}