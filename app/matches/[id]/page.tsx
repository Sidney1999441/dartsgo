'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function MatchDetailPage() {
  const params = useParams()
  const matchId = params.id
  const [match, setMatch] = useState<any>(null)
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!matchId) return

    const fetchData = async () => {
      // 1. 获取比赛基础信息 (包括 match_type)
      const { data: matchData } = await supabase
        .from('matches')
        .select(`*, tournament:tournaments(name), home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)`)
        .eq('id', matchId)
        .single()
      setMatch(matchData)

      // 2. 获取详细数据
      const { data: statsData } = await supabase
        .from('match_stats')
        .select(`*, profile:profiles(username, avatar_url)`)
        .eq('match_id', matchId)
      
      if (statsData) setStats(statsData)
      setLoading(false)
    }

    fetchData()
  }, [matchId])

  if (loading) return <div className="p-10 text-white animate-pulse">正在加载战报...</div>
  if (!match) return <div className="p-10 text-white">找不到该比赛数据</div>

  // 判断是否是软镖模式
  const isSoft = match.match_type === 'soft'

  const getTeamStats = (teamId: number) => {
    return stats.filter(s => s.team_id === teamId)
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-4xl mx-auto">
        <Link href="/schedule" className="text-slate-400 hover:text-white mb-6 inline-block text-sm">
          ← 返回赛程列表
        </Link>

        {/* 顶部：大比分看板 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-700 mb-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-8xl font-black select-none pointer-events-none">
                {isSoft ? 'SOFT' : 'STEEL'}
            </div>
            
            <div className="text-center mb-6">
                <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">
                    {match.tournament?.name} • {isSoft ? '软镖赛' : '硬镖赛'}
                </span>
            </div>

            <div className="flex justify-between items-center px-4 md:px-12">
                <div className="flex flex-col items-center gap-4 w-1/3">
                    {match.home_team?.logo_url ? (
                        <img src={match.home_team.logo_url} className="w-20 h-20 rounded-full border-4 border-slate-700 shadow-lg" />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-blue-900 border-4 border-slate-700 flex items-center justify-center text-2xl font-bold">A</div>
                    )}
                    <div className="text-xl font-bold text-center">{match.home_team?.name}</div>
                </div>

                <div className="text-center relative z-10">
                    <div className="text-6xl md:text-8xl font-black font-mono tracking-tighter flex items-center gap-4">
                        <span className="text-blue-400">{match.home_score}</span>
                        <span className="text-slate-600 text-4xl">:</span>
                        <span className="text-red-400">{match.away_score}</span>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-4 w-1/3">
                    {match.away_team?.logo_url ? (
                        <img src={match.away_team.logo_url} className="w-20 h-20 rounded-full border-4 border-slate-700 shadow-lg" />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-red-900 border-4 border-slate-700 flex items-center justify-center text-2xl font-bold">B</div>
                    )}
                    <div className="text-xl font-bold text-center">{match.away_team?.name}</div>
                </div>
            </div>
        </div>

        {/* 详细数据统计展示 */}
        <div className="grid md:grid-cols-2 gap-6">
            <StatsCard title={match.home_team?.name} color="border-blue-500/30 bg-blue-900/10" titleColor="text-blue-400" data={getTeamStats(match.home_team_id)} isSoft={isSoft} />
            <StatsCard title={match.away_team?.name} color="border-red-500/30 bg-red-900/10" titleColor="text-red-400" data={getTeamStats(match.away_team_id)} isSoft={isSoft} />
        </div>
      </div>
    </div>
  )
}

// 提取的子组件：根据 isSoft 动态渲染列
function StatsCard({ title, data, color, titleColor, isSoft }: any) {
    return (
        <div className={`rounded-xl border ${color} overflow-hidden`}>
            <div className={`px-4 py-3 bg-slate-900/50 font-bold border-b border-slate-800 ${titleColor}`}>
                {title}
            </div>
            {data.length > 0 ? (
                <div className="divide-y divide-slate-800">
                    {/* 动态表头 */}
                    <div className="grid grid-cols-5 gap-1 px-4 py-2 text-[10px] uppercase text-slate-500 font-bold text-center">
                        <div className="col-span-1 text-left">Player</div>
                        <div>PPD</div>
                        {isSoft ? (
                            <>
                                <div>MPR</div>
                                <div>Hat</div>
                                <div>Horse</div>
                            </>
                        ) : (
                            <>
                                <div>180s</div>
                                <div>140+</div>
                                <div>HiFin</div>
                            </>
                        )}
                    </div>
                    {/* 内容 */}
                    {data.map((s: any) => (
                        <div key={s.id} className="grid grid-cols-5 gap-1 px-4 py-3 items-center hover:bg-white/5 transition text-center text-sm">
                            <div className="col-span-1 flex items-center gap-2 overflow-hidden text-left">
                                <span className="font-bold truncate">{s.profile?.username || '未知'}</span>
                            </div>
                            <div className="font-mono text-slate-300">{s.ppd}</div>
                            {isSoft ? (
                                <>
                                    <div className="font-mono text-blue-300">{s.mpr}</div>
                                    <div className="font-mono text-slate-400">{s.hat_trick}</div>
                                    <div className="font-mono text-slate-400">{s.white_horse}</div>
                                </>
                            ) : (
                                <>
                                    <div className="font-mono text-orange-400 font-bold">{s.score_180s}</div>
                                    <div className="font-mono text-slate-400">{s.score_140s}</div>
                                    <div className="font-mono text-yellow-500">{s.high_finish}</div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-4 text-center text-slate-500 text-sm italic">暂无数据</div>
            )}
        </div>
    )
}