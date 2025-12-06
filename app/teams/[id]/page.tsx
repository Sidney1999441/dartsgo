'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation' // 使用 hook 获取参数更稳妥

export default function TeamDetailPage() {
  const params = useParams() // 获取 URL 参数
  const teamId = params?.id as string

  const [team, setTeam] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!teamId) return

    const fetchTeamData = async () => {
      console.log('正在加载战队 ID:', teamId) // 调试日志 1

      // 1. 获取战队基本信息
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single()
      
      if (teamError || !teamData) {
        console.error('战队加载失败:', teamError) // 调试日志 2
        setErrorMsg('未找到该战队信息，或没有查看权限。')
        setLoading(false)
        return
      }
      setTeam(teamData)

      // 2. 获取战队成员
      const { data: memberData } = await supabase
        .from('team_members')
        .select('*, profiles(*)')
        .eq('team_id', teamId)
      
      setMembers(memberData || [])

      // 3. 获取战队近期比赛
      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          tournaments(name)
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('is_finished', true)
        .order('start_time', { ascending: false })
        .limit(10)

      setMatches(matchData || [])
      setLoading(false)
    }

    fetchTeamData()
  }, [teamId])

  // === 加载中状态 ===
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-neutral-500">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        <div>正在读取战队档案...</div>
      </div>
    </div>
  )

  // === 错误状态 ===
  if (errorMsg || !team) return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-neutral-400 gap-4">
      <div className="text-4xl">🛸</div>
      <div>{errorMsg || '战队不存在'}</div>
      <Link href="/dashboard" className="px-4 py-2 bg-white text-black rounded font-bold hover:bg-neutral-200">
        返回个人中心
      </Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 animate-in fade-in pb-20">
      
      {/* 顶部导航 */}
      <div className="max-w-5xl mx-auto mb-6 pt-4">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-white transition-colors flex items-center gap-1">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          返回个人中心
        </Link>
      </div>

      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* === 1. 战队 Hero 区域 === */}
        <div className="flex flex-col items-center justify-center py-10 border-b border-neutral-800 bg-neutral-900/30 rounded-2xl border-t">
            <div className="w-32 h-32 bg-neutral-900 rounded-full border-4 border-neutral-800 flex items-center justify-center mb-6 shadow-2xl relative">
                {team?.logo_url ? (
                    <img src={team.logo_url} className="w-full h-full rounded-full object-cover"/>
                ) : (
                    <span className="text-4xl font-bold text-neutral-700">{team?.name?.[0]}</span>
                )}
                {/* 装饰光圈 */}
                <div className="absolute inset-0 rounded-full border border-white/10 animate-pulse"></div>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2 text-center">{team?.name}</h1>
            <p className="text-neutral-500 font-mono text-sm bg-neutral-900 px-3 py-1 rounded border border-neutral-800">
                ID: {team?.id}
            </p>
            
            <div className="flex gap-12 mt-8">
                <div className="text-center group cursor-default">
                    <div className="text-3xl font-bold text-white group-hover:text-blue-400 transition-colors">{members.length}</div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Active Players</div>
                </div>
                <div className="text-center group cursor-default">
                    <div className="text-3xl font-bold text-white group-hover:text-orange-400 transition-colors">{matches.length}</div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Matches Played</div>
                </div>
            </div>
        </div>

        {/* === 2. 战队成员名单 === */}
        <div>
            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-6 pl-2 border-l-2 border-blue-500">
                Roster / 队员名单
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {members.map((m: any) => (
                    <div key={m.id} className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg flex flex-col items-center hover:border-neutral-600 hover:bg-neutral-800 transition-all group">
                        <div className="w-14 h-14 rounded-full bg-neutral-800 mb-3 overflow-hidden border-2 border-neutral-700 group-hover:border-white transition-colors">
                             {m.profiles?.avatar_url ? (
                                 <img src={m.profiles.avatar_url} className="w-full h-full object-cover"/>
                             ) : (
                                 <div className="w-full h-full flex items-center justify-center text-neutral-600 font-bold">{m.profiles?.username?.[0]}</div>
                             )}
                        </div>
                        <div className="font-bold text-white text-sm truncate w-full text-center">
                            {m.profiles?.username || '未命名'}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1 font-mono">
                            Lv.{m.profiles?.level || 1}
                        </div>
                        {team.captain_id === m.user_id && (
                            <div className="mt-2 px-2 py-0.5 bg-yellow-500 text-black text-[10px] font-black uppercase rounded shadow-lg shadow-yellow-500/20">
                                Captain
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* === 3. 历史战绩列表 === */}
        <div className="pb-10">
            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-6 pl-2 border-l-2 border-orange-500">
                Match History / 近期战绩
            </h2>
            <div className="space-y-3">
                {matches.length > 0 ? matches.map((match) => {
                    const isHome = match.home_team_id == teamId
                    const myScore = isHome ? match.home_score : match.away_score
                    const oppScore = isHome ? match.away_score : match.home_score
                    const result = myScore > oppScore ? 'WIN' : myScore < oppScore ? 'LOSS' : 'DRAW'
                    
                    // 动态样式
                    let resultBadge = ""
                    let resultBorder = "border-neutral-800"
                    
                    if (result === 'WIN') {
                        resultBadge = "text-green-400 bg-green-900/10 border-green-900/30"
                        resultBorder = "hover:border-green-900/50"
                    } else if (result === 'LOSS') {
                        resultBadge = "text-red-400 bg-red-900/10 border-red-900/30"
                        resultBorder = "hover:border-red-900/50"
                    } else {
                        resultBadge = "text-neutral-400 bg-neutral-800 border-neutral-700"
                    }

                    const oppName = isHome ? match.away_team?.name : match.home_team?.name

                    return (
                        <div key={match.id} className={`bg-neutral-900/50 border ${resultBorder} border-neutral-800 p-4 rounded-lg flex items-center justify-between transition-colors`}>
                            <div className="flex flex-col md:flex-row md:items-center gap-3">
                                <div className={`font-black font-mono text-xs px-2 py-1 rounded border ${resultBadge} w-fit text-center`}>
                                    {result}
                                </div>
                                <div className="text-sm text-neutral-300">
                                    <span className="text-neutral-500 mr-2 text-xs uppercase">VS</span>
                                    <span className="font-bold">{oppName}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="font-mono text-xl font-black text-white tracking-widest">
                                    {myScore} : {oppScore}
                                </div>
                                <div className="text-[10px] text-neutral-500 mt-1 uppercase">{match.tournaments?.name || '未知赛事'}</div>
                            </div>
                        </div>
                    )
                }) : (
                    <div className="text-neutral-600 text-sm text-center py-10 border border-dashed border-neutral-800 rounded-lg bg-neutral-900/20">
                        暂无已完赛的记录
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  )
}