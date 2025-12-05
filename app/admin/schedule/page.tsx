'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'

export default function AdminSchedulePage() {
  const [tournaments, setTournaments] = useState<any[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('')
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 1. 页面加载时，先获取所有赛事列表
  useEffect(() => {
    fetchTournaments()
  }, [])

  // 2. 当用户选择了某个赛事，去加载对应的赛程
  useEffect(() => {
    if (selectedTournamentId) {
      fetchMatches(selectedTournamentId)
    } else {
      setMatches([])
    }
  }, [selectedTournamentId])

  const fetchTournaments = async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false }) // 新建的排前面
    
    if (data && data.length > 0) {
      setTournaments(data)
      // 默认选中最新的一个赛事 (可选)
      setSelectedTournamentId(String(data[0].id))
    }
  }

  const fetchMatches = async (tournamentId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('matches')
      .select(`
        *, 
        home_team:teams!home_team_id(name), 
        away_team:teams!away_team_id(name)
      `)
      .eq('tournament_id', tournamentId)
      .order('start_time', { ascending: true }) // 按时间正序
      
    if (data) setMatches(data)
    setLoading(false)
  }

  // === 危险操作：清空当前赛事的赛程 ===
  const handleClearSchedule = async () => {
    if (!selectedTournamentId) return
    if (!confirm('⚠️ 高能预警！\n\n确定要【清空】该赛事下的所有比赛和数据吗？\n此操作不可恢复！')) return

    setLoading(true)
    // 因为设置了级联删除，删了 match 会自动删 stats
    const { error } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', selectedTournamentId)

    if (error) {
        alert('清空失败: ' + error.message)
    } else {
        alert('✅ 赛程已清空，你可以重新生成了。')
        fetchMatches(selectedTournamentId) // 刷新列表
    }
    setLoading(false)
  }

  // === 危险操作：删除整个赛事 ===
  const handleDeleteTournament = async () => {
    if (!selectedTournamentId) return
    if (!confirm('🧨 毁灭性操作！\n\n确定要【删除整个赛事】吗？\n这将连带删除该赛事下的所有赛程、比分、统计数据！')) return

    setLoading(true)
    const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', selectedTournamentId)

    if (error) {
        alert('删除失败: ' + error.message)
    } else {
        alert('✅ 赛事已彻底删除。')
        // 删除后，刷新列表并选中下一个
        const remaining = tournaments.filter(t => String(t.id) !== selectedTournamentId)
        setTournaments(remaining)
        if (remaining.length > 0) setSelectedTournamentId(String(remaining[0].id))
        else setSelectedTournamentId('')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 text-white pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">📅 赛事录入 & 管理</h1>
        
        {/* 顶部筛选器 */}
        <div className="flex items-center gap-4 w-full md:w-auto bg-slate-800 p-2 rounded-lg border border-slate-700">
            <span className="text-sm text-slate-400 pl-2 whitespace-nowrap">当前管理赛事:</span>
            <select 
                value={selectedTournamentId} 
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="bg-slate-900 border border-slate-600 text-white text-sm rounded px-3 py-1.5 focus:border-blue-500 outline-none flex-1 md:w-64"
            >
                {tournaments.length === 0 && <option value="">无赛事</option>}
                {tournaments.map(t => (
                    <option key={t.id} value={t.id}>
                        {t.name} ({t.format === 'league' ? '单循环' : t.format === 'knockout' ? '淘汰赛' : '双循环'})
                    </option>
                ))}
            </select>
        </div>
      </div>
      
      {/* 赛事操作栏 (仅当选中赛事时显示) */}
      {selectedTournamentId && (
          <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-lg flex justify-between items-center">
              <div className="text-xs text-slate-400">
                  赛事 ID: {selectedTournamentId} | 共 {matches.length} 场比赛
              </div>
              <div className="flex gap-3">
                  <button 
                    onClick={handleClearSchedule}
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 px-3 py-1.5 rounded border border-red-900/30 transition"
                  >
                    🗑️ 清空所有赛程
                  </button>
                  <button 
                    onClick={handleDeleteTournament}
                    className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded font-bold transition shadow-lg"
                  >
                    💣 删除整个赛事
                  </button>
              </div>
          </div>
      )}

      {/* 赛程列表 */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden min-h-[400px]">
        {loading ? (
            <div className="p-10 text-center text-slate-500">数据加载中...</div>
        ) : matches.length > 0 ? (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-900 text-slate-200 uppercase">
                    <tr>
                    <th className="p-4 w-32">轮次/时间</th>
                    <th className="p-4">对阵详情</th>
                    <th className="p-4 w-24">类型</th>
                    <th className="p-4 w-24">状态</th>
                    <th className="p-4 text-right">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {matches.map((match) => (
                    <tr key={match.id} className="hover:bg-slate-700/50 transition-colors">
                        <td className="p-4">
                            <div className="font-bold text-white">{match.round_name || '-'}</div>
                            <div className="text-xs text-slate-500 mt-1">
                                {new Date(match.start_time).toLocaleDateString()}
                                <br/>
                                {new Date(match.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </td>
                        <td className="p-4">
                            <div className="flex items-center gap-2 text-white font-bold text-lg">
                                <span className={match.home_score > match.away_score ? 'text-yellow-400' : ''}>{match.home_team?.name}</span>
                                <span className="text-slate-600 text-sm font-normal mx-1">vs</span>
                                <span className={match.away_score > match.home_score ? 'text-yellow-400' : ''}>{match.away_team?.name}</span>
                            </div>
                            {match.is_finished && (
                                <div className="text-xs font-mono text-slate-400 mt-1">
                                    比分: {match.home_score} - {match.away_score}
                                </div>
                            )}
                        </td>
                        <td className="p-4">
                             {match.match_type === 'soft' ? (
                                 <span className="px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800 text-xs">软镖</span>
                             ) : (
                                 <span className="px-2 py-0.5 rounded bg-orange-900/30 text-orange-400 border border-orange-800 text-xs">硬镖</span>
                             )}
                        </td>
                        <td className="p-4">
                        {match.is_finished ? 
                            <span className="text-green-400 bg-green-900/30 px-2 py-1 rounded text-xs border border-green-800">已完赛</span> : 
                            <span className="text-slate-400 bg-slate-900/50 px-2 py-1 rounded text-xs border border-slate-700">未开始</span>
                        }
                        </td>
                        <td className="p-4 text-right">
                        <Link 
                            href={`/admin/matches/${match.id}`} 
                            className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-xs font-bold transition shadow-lg hover:shadow-blue-500/20"
                        >
                            ✏️ 录入
                        </Link>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-500 gap-4">
                <div className="text-4xl">📭</div>
                <p>该赛事暂无赛程安排</p>
                {selectedTournamentId ? (
                    <Link href="/admin/tournaments" className="text-blue-400 hover:underline text-sm">
                        去创建赛程 →
                    </Link>
                ) : (
                    <p className="text-sm">请先在上方选择一个赛事</p>
                )}
            </div>
        )}
      </div>
    </div>
  )
}