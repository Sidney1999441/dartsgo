'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'

export default function AdminSchedulePage() {
  const [tournaments, setTournaments] = useState<any[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('')
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchTournaments() }, [])

  useEffect(() => {
    if (selectedTournamentId) fetchMatches(selectedTournamentId)
    else setMatches([])
  }, [selectedTournamentId])

  const fetchTournaments = async () => {
    const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
    if (data && data.length > 0) {
      setTournaments(data)
      setSelectedTournamentId(String(data[0].id))
    }
  }

  const fetchMatches = async (tournamentId: string) => {
    setLoading(true)
    const { data } = await supabase.from('matches')
      .select(`*, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)`)
      .eq('tournament_id', tournamentId).order('start_time', { ascending: true })
    if (data) setMatches(data)
    setLoading(false)
  }

  const handleClearSchedule = async () => {
    if (!selectedTournamentId || !confirm('⚠️ 确定要清空该赛事的所有赛程吗？此操作不可逆！')) return
    setLoading(true)
    const { error } = await supabase.from('matches').delete().eq('tournament_id', selectedTournamentId)
    if (!error) { alert('已清空'); fetchMatches(selectedTournamentId) }
    setLoading(false)
  }

  const handleDeleteTournament = async () => {
    if (!selectedTournamentId || !confirm('🧨 确定要删除整个赛事吗？')) return
    setLoading(true)
    const { error } = await supabase.from('tournaments').delete().eq('id', selectedTournamentId)
    if (!error) {
      alert('赛事已删除')
      const remaining = tournaments.filter(t => String(t.id) !== selectedTournamentId)
      setTournaments(remaining)
      setSelectedTournamentId(remaining[0] ? String(remaining[0].id) : '')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-8 pb-20">
      {/* 头部：标题与选择器 */}
      <div className="bg-slate-800/50 backdrop-blur border-b border-white/5 p-6 -mx-4 md:mx-0 md:rounded-xl md:border mb-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">赛程管理控制台</h1>
            <p className="text-slate-400 text-sm">选择赛事进行排期或比分录入</p>
          </div>
          
          <div className="relative">
            <select 
              value={selectedTournamentId} 
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className="w-full md:w-64 appearance-none bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer hover:bg-slate-800 transition"
            >
              {tournaments.length === 0 && <option value="">无赛事</option>}
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.format === 'league' ? '单循环' : '淘汰/其他'})
                </option>
              ))}
            </select>
            {/* 模拟下箭头 */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
            </div>
          </div>
        </div>
      </div>
      
      {/* 危险操作区 */}
      {selectedTournamentId && (
        <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-red-200 text-sm">
            <span className="animate-pulse">⚠️</span>
            <span>当前选中 ID: <span className="font-mono">{selectedTournamentId}</span> ({matches.length} 场比赛)</span>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={handleClearSchedule} className="flex-1 md:flex-none text-xs text-red-300 hover:text-white hover:bg-red-600/50 px-4 py-2 rounded border border-red-500/30 transition">
              清空赛程
            </button>
            <button onClick={handleDeleteTournament} className="flex-1 md:flex-none text-xs bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold shadow-lg shadow-red-900/20 transition">
              删除赛事
            </button>
          </div>
        </div>
      )}

      {/* 赛程列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-20 text-center text-slate-500 animate-pulse">正在从云端同步数据...</div>
        ) : matches.length > 0 ? (
          <div className="grid gap-3">
            {matches.map((match) => (
              <div key={match.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col md:flex-row items-center gap-4 hover:border-blue-500/30 transition-colors">
                
                {/* 时间与轮次 */}
                <div className="flex flex-row md:flex-col justify-between w-full md:w-32 shrink-0 text-sm">
                  <span className="font-bold text-slate-300">{match.round_name}</span>
                  <div className="text-slate-500 text-xs mt-0.5">
                    {new Date(match.start_time).toLocaleDateString()}
                  </div>
                </div>

                {/* 对阵 */}
                <div className="flex-1 grid grid-cols-3 items-center w-full gap-2">
                  <div className={`text-right font-bold truncate ${match.home_score > match.away_score ? 'text-yellow-400' : 'text-slate-300'}`}>
                    {match.home_team?.name}
                  </div>
                  <div className="text-center">
                    {match.is_finished ? (
                      <span className="bg-slate-950 px-3 py-1 rounded text-white font-mono font-bold tracking-widest border border-slate-700">
                        {match.home_score}:{match.away_score}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">VS</span>
                    )}
                  </div>
                  <div className={`text-left font-bold truncate ${match.away_score > match.home_score ? 'text-yellow-400' : 'text-slate-300'}`}>
                    {match.away_team?.name}
                  </div>
                </div>

                {/* 标签与操作 */}
                <div className="flex items-center justify-between w-full md:w-auto gap-4 mt-2 md:mt-0 pt-2 md:pt-0 border-t border-slate-700 md:border-0">
                  <span className={`text-xs px-2 py-0.5 rounded border ${match.match_type === 'soft' ? 'bg-blue-900/20 border-blue-800 text-blue-400' : 'bg-orange-900/20 border-orange-800 text-orange-400'}`}>
                    {match.match_type === 'soft' ? '软镖' : '硬镖'}
                  </span>
                  
                  <Link href={`/admin/matches/${match.id}`} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold shadow-lg shadow-blue-900/20 transition flex items-center gap-2">
                    <span>✏️</span> 录入
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
            <div className="text-4xl mb-4 opacity-50">📅</div>
            <p className="text-slate-400">暂无赛程安排</p>
          </div>
        )}
      </div>
    </div>
  )
}