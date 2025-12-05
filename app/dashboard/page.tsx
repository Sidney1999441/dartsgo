'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [myTeam, setMyTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setUser(user)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)

      const { data: m } = await supabase.from('team_members').select('team_id, teams(*)').eq('user_id', user.id).single()
      if (m?.teams) setMyTeam(m.teams)
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>

  // 数据卡片组件
  const StatBox = ({ label, value, color = "text-white", sub }: any) => (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
        <div className={`text-2xl font-black font-mono ${color}`}>{value || 0}</div>
        {sub && <div className="text-[10px] text-slate-600 mt-1">{sub}</div>}
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-20">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 头部卡片 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 flex items-center gap-6 relative overflow-hidden">
            <div className="w-20 h-20 rounded-full bg-slate-700 border-4 border-slate-600 overflow-hidden shrink-0">
                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover"/> : <div className="h-full flex items-center justify-center font-bold text-2xl">{profile?.username?.[0]}</div>}
            </div>
            <div>
                <h1 className="text-2xl font-bold">{profile?.username || '选手'}</h1>
                <div className="text-sm text-slate-400">ID: {user.id.slice(0,6)} • {myTeam ? myTeam.name : '自由人'}</div>
                <div className="mt-2 inline-block bg-slate-950 px-3 py-1 rounded text-xs border border-slate-700 text-yellow-500 font-bold">
                    Lv.{profile?.level} {profile?.tier} 段位
                </div>
            </div>
        </div>

        {/* 核心均分 */}
        <div>
            <h3 className="text-lg font-bold mb-3 pl-2 border-l-4 border-blue-500">核心能力</h3>
            <div className="grid grid-cols-3 gap-4">
                <StatBox label="Steel PPD" value={profile?.ppd_steel} color="text-orange-400" sub="硬镖均分" />
                <StatBox label="Soft PPD" value={profile?.ppd_soft} color="text-blue-400" sub="软镖均分" />
                <StatBox label="Soft MPR" value={profile?.mpr_avg} color="text-green-400" sub="米老鼠能力" />
            </div>
        </div>

        {/* 详细数据矩阵 */}
        <div className="grid md:grid-cols-2 gap-8">
            {/* 硬镖数据 */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <h4 className="text-orange-400 font-bold mb-4 flex items-center gap-2">🎯 硬镖生涯数据</h4>
                <div className="grid grid-cols-2 gap-3">
                    <StatBox label="Total 180s" value={profile?.total_180s} />
                    <StatBox label="Total 140+" value={profile?.total_140s} />
                    <StatBox label="High Finish" value={profile?.high_finish_steel} color="text-yellow-500"/>
                    <StatBox label="结镖率" value={`${profile?.checkout_rate || 0}%`} />
                </div>
            </div>

            {/* 软镖数据 */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <h4 className="text-blue-400 font-bold mb-4 flex items-center gap-2">🕹️ 软镖生涯数据</h4>
                <div className="grid grid-cols-2 gap-3">
                    <StatBox label="Hat Tricks" value={profile?.total_hats} />
                    <StatBox label="White Horses" value={profile?.total_horses} />
                    <StatBox label="High Finish" value={profile?.high_finish_soft} color="text-yellow-500"/>
                    <StatBox label="Total Games" value={profile?.matches_played} />
                </div>
            </div>
        </div>

        {/* 退出按钮 */}
        <div className="text-center pt-8">
            <button onClick={async()=>{await supabase.auth.signOut();router.push('/login')}} className="text-red-400 text-sm hover:underline">退出登录</button>
        </div>

      </div>
    </div>
  )
}