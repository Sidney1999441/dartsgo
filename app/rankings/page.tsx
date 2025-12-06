'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type TeamStats = {
  id: number; name: string; logo_url: string | null;
  played: number; won: number; drawn: number; lost: number;
  legs_won: number; legs_lost: number; diff: number; points: number
}

// 树状图组件 (极简风格)
const KnockoutBracket = ({ matches }: { matches: any[] }) => {
  // 简单处理：按轮次分组
  const rounds = matches.reduce((acc: any, match) => {
    const roundName = match.round_name || 'Unkown'
    if (!acc[roundName]) acc[roundName] = []
    acc[roundName].push(match)
    return acc
  }, {})

  return (
    <div className="flex gap-8 overflow-x-auto pb-8">
      {Object.entries(rounds).map(([roundName, roundMatches]: any, rIndex) => (
        <div key={rIndex} className="flex flex-col justify-center gap-8 min-w-[240px]">
           <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest text-center border-b border-neutral-800 pb-2 mb-2">
             {roundName}
           </div>
           {roundMatches.map((m: any) => (
             <div key={m.id} className="border border-neutral-800 bg-neutral-900/50 p-4 relative group hover:border-white transition-colors">
               {/* 连接线示意 (仅装饰) */}
               {rIndex < Object.keys(rounds).length - 1 && (
                 <div className="absolute top-1/2 -right-4 w-4 h-px bg-neutral-800"></div>
               )}
               
               {/* 主队 */}
               <div className={`flex justify-between items-center mb-2 ${m.home_score > m.away_score ? 'text-white font-bold' : 'text-neutral-500'}`}>
                 <span>{m.home_team?.name}</span>
                 <span className="font-mono">{m.is_finished ? m.home_score : '-'}</span>
               </div>
               {/* 客队 */}
               <div className={`flex justify-between items-center ${m.away_score > m.home_score ? 'text-white font-bold' : 'text-neutral-500'}`}>
                 <span>{m.away_team?.name}</span>
                 <span className="font-mono">{m.is_finished ? m.away_score : '-'}</span>
               </div>
             </div>
           ))}
        </div>
      ))}
    </div>
  )
}

export default function RankingsPage() {
  const [loading, setLoading] = useState(true)
  const [tournaments, setTournaments] = useState<any[]>([])
  const [currentTournament, setCurrentTournament] = useState<any>(null)
  const [standings, setStandings] = useState<TeamStats[]>([])
  const [knockoutMatches, setKnockoutMatches] = useState<any[]>([])

  // 1. 获取赛事列表
  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
      if (data && data.length > 0) {
        setTournaments(data)
        setCurrentTournament(data[0]) // 默认选最新的
      } else setLoading(false)
    }
    init()
  }, [])

  // 2. 赛事变动 -> 计算数据
  useEffect(() => {
    if (!currentTournament) return
    fetchData(currentTournament)
  }, [currentTournament])

  async function fetchData(tournament: any) {
    setLoading(true)
    const { data: matches } = await supabase
      .from('matches')
      .select(`*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)`)
      .eq('tournament_id', tournament.id)

    if (tournament.format === 'knockout') {
        // 如果是淘汰赛，直接存比赛数据给树状图用
        setKnockoutMatches(matches || [])
    } else {
        // 如果是联赛，计算积分
        calculateStandings(matches || [], tournament.scoring_rules || { win: 2, draw: 1, loss: 0 })
    }
    setLoading(false)
  }

  function calculateStandings(matches: any[], rules: any) {
    const map = new Map<number, TeamStats>()
    const initT = (t: any) => {
      if (!t || map.has(t.id)) return
      map.set(t.id, { id: t.id, name: t.name, logo_url: t.logo_url, played: 0, won: 0, drawn: 0, lost: 0, legs_won: 0, legs_lost: 0, diff: 0, points: 0 })
    }

    matches.forEach((m: any) => {
      if (!m.is_finished) return
      initT(m.home_team); initT(m.away_team)
      const h = map.get(m.home_team_id); const a = map.get(m.away_team_id)
      if(!h || !a) return

      h.played++; a.played++
      h.legs_won += m.home_score; h.legs_lost += m.away_score
      a.legs_won += m.away_score; a.legs_lost += m.home_score
      h.diff = h.legs_won - h.legs_lost; a.diff = a.legs_won - a.legs_lost

      if (m.home_score > m.away_score) {
        h.won++; h.points += rules.win; a.lost++; a.points += rules.loss
      } else if (m.home_score < m.away_score) {
        a.won++; a.points += rules.win; h.lost++; h.points += rules.loss
      } else {
        h.drawn++; h.points += rules.draw; a.drawn++; a.points += rules.draw
      }
    })
    
    // 排序
    setStandings(Array.from(map.values()).sort((a, b) => b.points - a.points || b.diff - a.diff))
  }

  return (
    <div className="min-h-[80vh] p-4 md:p-8 animate-in fade-in">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-6 mb-12 border-b border-neutral-800 pb-6">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">赛事信息</h1>
          <p className="text-neutral-500 text-sm flex items-center gap-2">
            {currentTournament?.format === 'knockout' ? 'Knockout Stage' : 'League Standings'}
            {currentTournament && currentTournament.format !== 'knockout' && (
               <span className="bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 text-xs">
                 Rule: W+{currentTournament.scoring_rules?.win ?? 2} / D+{currentTournament.scoring_rules?.draw ?? 1}
               </span>
            )}
          </p>
        </div>

        {/* 赛事切换 */}
        <select 
          className="bg-[#0a0a0a] border border-neutral-700 text-white px-4 py-2 outline-none focus:border-white transition-colors min-w-[240px]"
          onChange={(e) => setCurrentTournament(tournaments.find(t => String(t.id) === e.target.value))}
          value={currentTournament?.id || ''}
        >
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* 内容展示区 */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
            <div className="text-neutral-600 animate-pulse">Loading data...</div>
        ) : currentTournament?.format === 'knockout' ? (
            // === 淘汰赛树状图 ===
            <div className="overflow-x-auto">
               <KnockoutBracket matches={knockoutMatches} />
               {knockoutMatches.length === 0 && <div className="text-neutral-500">赛程尚未生成</div>}
            </div>
        ) : (
            // === 联赛积分榜 ===
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-neutral-500 uppercase border-b border-neutral-800">
                  <th className="pb-4 w-12">#</th>
                  <th className="pb-4">Team</th>
                  <th className="pb-4 text-center">Pld</th>
                  <th className="pb-4 text-center hidden md:table-cell">W-D-L</th>
                  <th className="pb-4 text-center hidden sm:table-cell">Diff</th>
                  <th className="pb-4 text-right">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {standings.map((t, i) => (
                  <tr key={t.id} className="group hover:bg-neutral-900/50">
                    <td className="py-4 text-neutral-500 font-mono">{i+1}</td>
                    <td className="py-4 font-bold text-white text-lg">{t.name}</td>
                    <td className="py-4 text-center text-neutral-400">{t.played}</td>
                    <td className="py-4 text-center text-neutral-500 hidden md:table-cell font-mono text-xs">{t.won}-{t.drawn}-{t.lost}</td>
                    <td className={`py-4 text-center hidden sm:table-cell font-mono ${t.diff>0?'text-green-500':t.diff<0?'text-red-500':'text-neutral-500'}`}>{t.diff>0?`+${t.diff}`:t.diff}</td>
                    <td className="py-4 text-right font-bold text-white text-xl">{t.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </div>
    </div>
  )
}