'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SchedulePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [groupedMatches, setGroupedMatches] = useState<Record<string, Record<string, any[]>>>({})

  useEffect(() => {
    const fetchUserMatches = async () => {
      // 1. 获取当前登录用户
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      // 2. 获取用户所在的队伍
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single()

      if (!teamMember?.team_id) {
        setLoading(false)
        return
      }

      // 3. 获取未来赛程（未完成且开始时间在未来）
      const now = new Date().toISOString()
      const { data: futureMatches } = await supabase
        .from('matches')
        .select(`
          id, start_time, is_finished, home_score, away_score, tournament_id,
          tournament:tournaments(id, name),
          home_team:teams!home_team_id(id, name, logo_url),
          away_team:teams!away_team_id(id, name, logo_url)
        `)
        .or(`home_team_id.eq.${teamMember.team_id},away_team_id.eq.${teamMember.team_id}`)
        .eq('is_finished', false)
        .gte('start_time', now)
        .order('start_time', { ascending: true })

      if (futureMatches) {
        setMatches(futureMatches)
        
        // 4. 按时间和赛事分类
        const grouped: Record<string, Record<string, any[]>> = {}
        futureMatches.forEach((match: any) => {
          const date = match.start_time 
            ? new Date(match.start_time).toLocaleDateString('zh-CN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })
            : '时间待定'
          
          const tournamentName = match.tournament?.name || '未分类赛事'
          
          if (!grouped[date]) {
            grouped[date] = {}
          }
          if (!grouped[date][tournamentName]) {
            grouped[date][tournamentName] = []
          }
          grouped[date][tournamentName].push(match)
        })
        
        setGroupedMatches(grouped)
      }
      setLoading(false)
    }

    fetchUserMatches()
  }, [router])

  const formatDate = (dateString: string) => {
    if (!dateString) return '时间待定'
    return new Date(dateString).toLocaleDateString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatTime = (dateString: string) => {
    if (!dateString) return '时间待定'
    return new Date(dateString).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-neutral-500 animate-pulse">正在加载赛程...</div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="min-h-[80vh] p-4 md:p-8 animate-in fade-in">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex justify-between items-center border-b border-neutral-800 pb-6">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              未来赛程
            </h1>
          </div>
          <div className="text-center py-20">
            <div className="text-neutral-600 text-lg mb-2">
              {!user ? '请先登录' : '暂无未来赛程安排'}
            </div>
            <div className="text-neutral-700 text-sm mt-4">
              {!user ? '登录后即可查看您的比赛安排' : '当有新的比赛安排时，将在此显示'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] p-4 md:p-8 animate-in fade-in">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* 页面标题 */}
        <div className="flex justify-between items-center border-b border-neutral-800 pb-6">
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
              未来赛程
            </h1>
            <p className="text-neutral-500 text-sm">
              查看您所在队伍即将进行的比赛安排
            </p>
          </div>
        </div>

        {/* 按日期和赛事分类显示 */}
        <div className="space-y-12">
          {Object.entries(groupedMatches).map(([date, tournaments]) => (
            <div key={date} className="space-y-8">
              {/* 日期标题 */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-800 to-transparent"></div>
                <h2 className="text-xl font-bold text-white whitespace-nowrap px-4">
                  {date}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-800 to-transparent"></div>
              </div>

              {/* 按赛事分类 */}
              {Object.entries(tournaments).map(([tournamentName, tournamentMatches]) => (
                <div key={tournamentName} className="space-y-4">
                  {/* 赛事标题 */}
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-1 h-5 bg-white rounded-full"></div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      {tournamentName}
                    </h3>
                    <span className="text-xs text-neutral-500 font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                      {tournamentMatches.length} 场
                    </span>
                  </div>

                  {/* 该赛事下的比赛列表 */}
                  <div className="grid gap-3 pl-6">
                    {tournamentMatches.map((match: any) => (
                      <div 
                        key={match.id} 
                        className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden flex flex-col md:flex-row items-center hover:border-neutral-700 hover:bg-neutral-900 transition-all group"
                      >
                        {/* 比赛信息 */}
                        <div className="flex-1 p-5 flex items-center justify-between w-full">
                          {/* 主队 */}
                          <div className="flex items-center gap-3 w-1/3 justify-end">
                            <span className="font-bold text-white text-right hidden md:block group-hover:text-white transition-colors">
                              {match.home_team?.name}
                            </span>
                            <span className="font-bold text-white text-right md:hidden">
                              {match.home_team?.name?.substring(0, 4) || ''}
                            </span>
                            {match.home_team?.logo_url ? (
                              <img 
                                src={match.home_team.logo_url} 
                                className="w-12 h-12 rounded-full border border-neutral-700 group-hover:border-neutral-600 transition-colors"
                                alt={match.home_team.name}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-sm text-neutral-400 group-hover:border-neutral-600 transition-colors">
                                {match.home_team?.name?.[0] || 'A'}
                              </div>
                            )}
                          </div>
                          
                          {/* 时间/VS */}
                          <div className="px-4 text-center min-w-[140px]">
                            <div className="text-2xl font-black text-neutral-600 group-hover:text-neutral-500 transition-colors">
                              VS
                            </div>
                            <div className="text-xs text-neutral-400 mt-2 font-mono">
                              {formatTime(match.start_time)}
                            </div>
                            <div className="text-xs text-neutral-600 mt-1">
                              {formatDate(match.start_time)}
                            </div>
                          </div>

                          {/* 客队 */}
                          <div className="flex items-center gap-3 w-1/3 justify-start">
                            {match.away_team?.logo_url ? (
                              <img 
                                src={match.away_team.logo_url} 
                                className="w-12 h-12 rounded-full border border-neutral-700 group-hover:border-neutral-600 transition-colors"
                                alt={match.away_team.name}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-sm text-neutral-400 group-hover:border-neutral-600 transition-colors">
                                {match.away_team?.name?.[0] || 'B'}
                              </div>
                            )}
                            <span className="font-bold text-white text-left hidden md:block group-hover:text-white transition-colors">
                              {match.away_team?.name}
                            </span>
                            <span className="font-bold text-white text-left md:hidden">
                              {match.away_team?.name?.substring(0, 4) || ''}
                            </span>
                          </div>
                        </div>

                        {/* 状态区 */}
                        <div className="w-full md:w-auto p-5 bg-neutral-900/30 md:border-l border-t md:border-t-0 border-neutral-800 flex justify-center">
                          <span className="px-4 py-2 text-neutral-500 text-xs font-bold uppercase tracking-wider border border-neutral-800 rounded-full bg-neutral-900/50">
                            即将开始
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}