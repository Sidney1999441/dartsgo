'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)

  // === 编辑相关状态 ===
  const [editingPlayer, setEditingPlayer] = useState<any>(null) // 当前正在编辑的选手对象
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => { fetchPlayers() }, [])

  const fetchPlayers = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('ppd_steel', { ascending: false })
    if (data) setPlayers(data)
    setLoading(false)
  }

  // 打开编辑弹窗
  const handleEditClick = (player: any) => {
    setEditingPlayer({ ...player }) // 复制一份数据，避免直接修改列表
    setIsModalOpen(true)
  }

  // 保存修改
  const handleSaveEdit = async () => {
    if (!editingPlayer) return
    
    const { error } = await supabase
      .from('profiles')
      .update({
        username: editingPlayer.username,
        level: editingPlayer.level,
        tier: editingPlayer.tier,
        ppd_steel: editingPlayer.ppd_steel,
        ppd_soft: editingPlayer.ppd_soft,
        mpr_avg: editingPlayer.mpr_avg
        // 你可以在这里添加更多允许修改的字段
      })
      .eq('id', editingPlayer.id)

    if (error) {
      alert('更新失败: ' + error.message)
    } else {
      setIsModalOpen(false)
      fetchPlayers() // 刷新列表
    }
  }

  // === 全能数据计算器 (保留你原有的逻辑) ===
  const handleRecalculate = async () => {
    if (!confirm('确定要统计所有历史数据吗？这将更新所有选手的生涯总数据。')) return
    setCalculating(true)
    try {
        const { data: stats } = await supabase.from('match_stats').select(`*, matches(match_type)`)
        if (!stats) throw new Error('无比赛数据')

        const aggregator: any = {}
        stats.forEach((s: any) => {
            const pid = s.player_id
            const type = s.matches?.match_type || 'steel'
            if (!aggregator[pid]) aggregator[pid] = { steelSum: 0, steelCount: 0, softSum: 0, mprSum: 0, softCount: 0, t180: 0, t140: 0, tHat: 0, tHorse: 0, hiSteel: 0, hiSoft: 0, matches: 0 }
            const p = aggregator[pid]
            p.matches += 1
            p.t180 += s.score_180s || 0; p.t140 += s.score_140s || 0; p.tHat += s.hat_trick || 0; p.tHorse += s.white_horse || 0
            if (type === 'steel' && s.high_finish > p.hiSteel) p.hiSteel = s.high_finish
            if (type === 'soft' && s.high_finish > p.hiSoft) p.hiSoft = s.high_finish
            if (type === 'steel') { p.steelSum += Number(s.ppd || 0); p.steelCount += 1 } 
            else { p.softSum += Number(s.ppd || 0); p.mprSum += Number(s.mpr || 0); p.softCount += 1 }
        })

        for (const [pid, data] of Object.entries(aggregator) as any) {
            const steelAvg = data.steelCount > 0 ? (data.steelSum / data.steelCount) : 0
            const softAvg = data.softCount > 0 ? (data.softSum / data.softCount) : 0
            const mprAvg = data.softCount > 0 ? (data.mprSum / data.softCount) : 0
            const basePPD = steelAvg > 0 ? steelAvg : softAvg
            let level = Math.floor((basePPD - 10) * 1.5)
            if (level < 1) level = 1; if (level > 30) level = 30
            let tier = 'C'
            if (basePPD >= 30) tier = 'SS'; else if (basePPD >= 25) tier = 'S'; else if (basePPD >= 20) tier = 'A'; else if (basePPD >= 15) tier = 'B'

            await supabase.from('profiles').update({
                ppd_steel: steelAvg.toFixed(2), ppd_soft: softAvg.toFixed(2), mpr_avg: mprAvg.toFixed(2),
                level, tier, total_180s: data.t180, total_140s: data.t140, total_hats: data.tHat, total_horses: data.tHorse,
                high_finish_steel: data.hiSteel, high_finish_soft: data.hiSoft, matches_played: data.matches
            }).eq('id', pid)
        }
        alert(`✅ 全站数据更新完毕！`)
        fetchPlayers()
    } catch (e: any) { alert('失败: ' + e.message) } finally { setCalculating(false) }
  }

  const toggleAdmin = async (id: string, currentStatus: boolean) => {
    await supabase.from('profiles').update({ is_admin: !currentStatus }).eq('id', id)
    fetchPlayers()
  }

  return (
    <div className="space-y-6 text-white pb-20 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Player Management</h1>
          <p className="text-neutral-500 text-xs mt-1">Total Players: {players.length}</p>
        </div>
        <button onClick={handleRecalculate} disabled={calculating} className="bg-white text-black hover:bg-neutral-200 px-4 py-2 text-sm rounded font-bold shadow-lg disabled:opacity-50 transition-colors">
            {calculating ? 'Running...' : '⚡️ Recalculate Stats'}
        </button>
      </div>
      
      <div className="bg-[#0a0a0a] rounded-lg border border-neutral-800 overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[900px]">
          <thead className="bg-neutral-900 text-neutral-400 uppercase text-xs tracking-wider">
            <tr>
              <th className="p-4">Player</th>
              <th className="p-4">Level / Tier</th>
              <th className="p-4">PPD (Steel)</th>
              <th className="p-4">PPD (Soft)</th>
              <th className="p-4">Stats</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {players.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-900/50 transition-colors group">
                <td className="p-4 font-bold text-white flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-500 border border-neutral-700">
                    {p.username?.[0] || '?'}
                  </div>
                  {p.username || <span className="text-neutral-600 italic">No Name</span>}
                </td>
                <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-xs border bg-neutral-900 border-neutral-700 text-neutral-300">
                        Lv.{p.level} <span className="text-white font-bold ml-1">{p.tier}</span>
                    </span>
                </td>
                <td className="p-4 text-neutral-300 font-mono">{Number(p.ppd_steel).toFixed(2)}</td>
                <td className="p-4 text-neutral-300 font-mono">{Number(p.ppd_soft).toFixed(2)}</td>
                <td className="p-4 text-xs text-neutral-500 space-x-2">
                    <span>180s: <b className="text-white">{p.total_180s}</b></span>
                    <span>Hats: <b className="text-white">{p.total_hats}</b></span>
                </td>
                <td className="p-4 text-right space-x-3">
                    <button onClick={() => handleEditClick(p)} className="text-xs font-bold text-neutral-400 hover:text-white transition-colors">
                        EDIT
                    </button>
                    <button onClick={() => toggleAdmin(p.id, p.is_admin)} className={`text-xs ${p.is_admin ? 'text-green-500' : 'text-neutral-600 hover:text-neutral-400'}`}>
                        {p.is_admin ? 'ADMIN' : 'USER'}
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === 编辑弹窗 (Modal) === */}
      {isModalOpen && editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] border border-neutral-700 w-full max-w-md rounded-lg p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-6">Edit Player Profile</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-neutral-500 uppercase">Username</label>
                <input 
                  value={editingPlayer.username || ''}
                  onChange={e => setEditingPlayer({...editingPlayer, username: e.target.value})}
                  className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded mt-1 focus:border-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-neutral-500 uppercase">Level</label>
                    <input 
                      type="number"
                      value={editingPlayer.level}
                      onChange={e => setEditingPlayer({...editingPlayer, level: Number(e.target.value)})}
                      className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded mt-1 outline-none"
                    />
                </div>
                <div>
                    <label className="text-xs text-neutral-500 uppercase">Tier</label>
                    <input 
                      value={editingPlayer.tier}
                      onChange={e => setEditingPlayer({...editingPlayer, tier: e.target.value})}
                      className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded mt-1 outline-none"
                    />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-neutral-500 uppercase">PPD (Steel)</label>
                    <input 
                      type="number" step="0.01"
                      value={editingPlayer.ppd_steel}
                      onChange={e => setEditingPlayer({...editingPlayer, ppd_steel: e.target.value})}
                      className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded mt-1 outline-none font-mono"
                    />
                </div>
                <div>
                    <label className="text-xs text-neutral-500 uppercase">PPD (Soft)</label>
                    <input 
                      type="number" step="0.01"
                      value={editingPlayer.ppd_soft}
                      onChange={e => setEditingPlayer({...editingPlayer, ppd_soft: e.target.value})}
                      className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded mt-1 outline-none font-mono"
                    />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-transparent border border-neutral-700 text-neutral-300 py-2 rounded hover:text-white hover:border-neutral-500 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="flex-1 bg-white text-black font-bold py-2 rounded hover:bg-neutral-200 transition-colors"
              >
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}