import './globals.css'
import type { Metadata } from 'next'
import Navbar from './components/Navbar' // 引入刚才写的组件

export const metadata: Metadata = {
  title: '飞镖赛事系统',
  description: 'Darts Tournament Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-950 text-white min-h-screen flex flex-col">
        {/* 把导航栏放在最顶上 */}
        <Navbar />
        
        {/* 页面内容主体 */}
        <main className="flex-1 w-full max-w-6xl mx-auto p-4">
          {children}
        </main>
      </body>
    </html>
  )
}