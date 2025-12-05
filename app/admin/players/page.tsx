'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)

  useEffect(() => { fetchPlayers() }, [])

  const fetchPlayers = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('ppd_steel', { ascending: false })
    if (data) setPlayers(data)
    setLoading(false)
  }

  // === 核心：全能数据计算器 ===
  const handleRecalculate = async () => {
    if (!confirm('确定要统计所有历史数据吗？这将更新所有选手的生涯总数据。')) return
    setCalculating(true)

    try {
        // 1. 抓取所有比赛详细数据
        const { data: stats } = await supabase
            .from('match_stats')
            .select(`*, matches(match_type)`)
        
        if (!stats) throw new Error('无比赛数据')

        // 2. 初始化统计桶
        const aggregator: any = {}

        stats.forEach((s: any) => {
            const pid = s.player_id
            const type = s.matches?.match_type || 'steel'

            if (!aggregator[pid]) {
                aggregator[pid] = { 
                    steelSum: 0, steelCount: 0,
                    softSum: 0, mprSum: 0, softCount: 0,
                    // 累计数据
                    t180: 0, t140: 0, tHat: 0, tHorse: 0,
                    hiSteel: 0, hiSoft: 0,
                    matches: 0
                }
            }
            
            const p = aggregator[pid]
            p.matches += 1 // 总场次

            // 累计特殊奖项
            p.t180 += s.score_180s || 0
            p.t140 += s.score_140s || 0
            p.tHat += s.hat_trick || 0
            p.tHorse += s.white_horse || 0

            // 统计最高结镖 (区分软硬)
            if (type === 'steel' && s.high_finish > p.hiSteel) p.hiSteel = s.high_finish
            if (type === 'soft' && s.high_finish > p.hiSoft) p.hiSoft = s.high_finish

            // 统计均分
            if (type === 'steel') {
                p.steelSum += Number(s.ppd || 0)
                p.steelCount += 1
            } else {
                p.softSum += Number(s.ppd || 0)
                p.mprSum += Number(s.mpr || 0)
                p.softCount += 1
            }
        })

        // 3. 计算均分并更新
        for (const [pid, data] of Object.entries(aggregator) as any) {
            const steelAvg = data.steelCount > 0 ? (data.steelSum / data.steelCount) : 0
            const softAvg = data.softCount > 0 ? (data.softSum / data.softCount) : 0
            const mprAvg = data.softCount > 0 ? (data.mprSum / data.softCount) : 0

            // 计算等级
            const basePPD = steelAvg > 0 ? steelAvg : softAvg
            let level = Math.floor((basePPD - 10) * 1.5)
            if (level < 1) level = 1
            if (level > 30) level = 30
            
            let tier = 'C'
            if (basePPD >= 30) tier = 'SS'
            else if (basePPD >= 25) tier = 'S'
            else if (basePPD >= 20) tier = 'A'
            else if (basePPD >= 15) tier = 'B'

            await supabase.from('profiles').update({
                ppd_steel: steelAvg.toFixed(2),
                ppd_soft: softAvg.toFixed(2),
                mpr_avg: mprAvg.toFixed(2),
                level, tier,
                // 新增：写入累计数据
                total_180s: data.t180,
                total_140s: data.t140,
                total_hats: data.tHat,
                total_horses: data.tHorse,
                high_finish_steel: data.hiSteel,
                high_finish_soft: data.hiSoft,
                matches_played: data.matches
            }).eq('id', pid)
        }

        alert(`✅ 全站数据更新完毕！`)
        fetchPlayers()

    } catch (e: any) {
        alert('失败: ' + e.message)
    } finally {
        setCalculating(false)
    }
  }

  // 修改管理员 (保留功能)
  const toggleAdmin = async (id: string, currentStatus: boolean) => {
    await supabase.from('profiles').update({ is_admin: !currentStatus }).eq('id', id)
    fetchPlayers()
  }

  return (
    <div className="space-y-6 text-white pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">👥 选手数据中心</h1>
        <button onClick={handleRecalculate} disabled={calculating} className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded font-bold shadow-lg disabled:opacity-50">
            {calculating ? '计算中...' : '⚡️ 重新统计全站生涯数据'}
        </button>
      </div>
      
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[900px]">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="p-4">选手</th>
              <th className="p-4">等级</th>
              <th className="p-4">硬镖均分</th>
              <th className="p-4">180数</th>
              <th className="p-4">软镖均分</th>
              <th className="p-4">帽子</th>
              <th className="p-4 text-right">权限</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {players.map((p) => (
              <tr key={p.id} className="hover:bg-slate-700/50">
                <td className="p-4 font-bold">{p.username || '未命名'}</td>
                <td className="p-4"><span className={`px-2 py-0.5 rounded text-xs border bg-slate-800 border-slate-600`}>Lv.{p.level} {p.tier}</span></td>
                <td className="p-4 text-orange-400 font-mono">{Number(p.ppd_steel).toFixed(2)}</td>
                <td className="p-4 font-bold">{p.total_180s}</td>
                <td className="p-4 text-blue-400 font-mono">{Number(p.ppd_soft).toFixed(2)}</td>
                <td className="p-4 font-bold">{p.total_hats}</td>
                <td className="p-4 text-right">
                    <button onClick={() => toggleAdmin(p.id, p.is_admin)} className="text-xs underline text-slate-500">{p.is_admin ? '管理员' : '选手'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}