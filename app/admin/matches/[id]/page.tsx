'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function AdminMatchEditPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.id
  
  const [match, setMatch] = useState<any>(null)
  const [homePlayers, setHomePlayers] = useState<any[]>([])
  const [awayPlayers, setAwayPlayers] = useState<any[]>([])
  
  // 比赛状态
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const [currentMatchType, setCurrentMatchType] = useState('steel') 
  
  // 新增：时间和轮次编辑
  const [startTime, setStartTime] = useState('')
  const [roundName, setRoundName] = useState('')

  const [statsMap, setStatsMap] = useState<any>({})

  useEffect(() => {
    if (!matchId) return
    const initData = async () => {
      // 先获取比赛信息，判断是团队赛还是个人赛
      const { data: matchData } = await supabase
        .from('matches')
        .select(`*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), home_player:profiles!home_player_id(id, username, avatar_url), away_player:profiles!away_player_id(id, username, avatar_url), tournaments(tournament_type)`)
        .eq('id', matchId)
        .single()
      
      if (matchData) {
        setMatch(matchData)
        setHomeScore(matchData.home_score || 0)
        setAwayScore(matchData.away_score || 0)
        setIsFinished(matchData.is_finished || false)
        setCurrentMatchType(matchData.match_type || 'steel')
        setRoundName(matchData.round_name || '')

        // 初始化时间 (转为 input datetime-local 格式)
        if (matchData.start_time) {
            const dt = new Date(matchData.start_time)
            const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            setStartTime(localIso)
        }

        // 判断是团队赛还是个人赛
        const isIndividual = matchData.tournaments?.tournament_type === 'individual' || matchData.home_player_id

        if (isIndividual) {
          // 个人赛：直接使用选手信息
          if (matchData.home_player) setHomePlayers([matchData.home_player])
          if (matchData.away_player) setAwayPlayers([matchData.away_player])
        } else {
          // 团队赛：获取队伍成员
          const { data: members } = await supabase
            .from('team_members')
            .select('team_id, profiles(id, username)')
            .in('team_id', [matchData.home_team_id, matchData.away_team_id])
          
          if (members) {
              setHomePlayers(members.filter((m: any) => m.team_id === matchData.home_team_id).map((m: any) => m.profiles))
              setAwayPlayers(members.filter((m: any) => m.team_id === matchData.away_team_id).map((m: any) => m.profiles))
          }
        }

        const { data: savedStats } = await supabase.from('match_stats').select('*').eq('match_id', matchId)
        if (savedStats) {
            const newMap: any = {}
            savedStats.forEach((s: any) => {
                newMap[s.player_id] = { 
                    ppd: s.ppd, s180: s.score_180s, s140: s.score_140s,
                    hat: s.hat_trick, horse: s.white_horse, mpr: s.mpr,
                    co_rate: s.checkout_rate, high_finish: s.high_finish
                }
            })
            setStatsMap(newMap)
        }
      }
    }
    initData()
  }, [matchId])

  const handleStatChange = (pid: string, field: string, val: string) => {
    setStatsMap((prev: any) => ({ ...prev, [pid]: { ...prev[pid], [field]: val } }))
  }

  const handleSave = async () => {
    // 保存基本信息
    await supabase.from('matches').update({
        home_score: homeScore, 
        away_score: awayScore, 
        is_finished: isFinished, 
        match_type: currentMatchType,
        start_time: new Date(startTime).toISOString(), // 保存新时间
        round_name: roundName // 保存新轮次名
    }).eq('id', matchId)

    // 保存详细数据 (这部分保持不变)
    const statsArray: any[] = []
    const allPlayers = [...homePlayers, ...awayPlayers]
    allPlayers.forEach(p => {
       const s = statsMap[p.id] || {}
       if (Object.values(s).some(val => val)) {
         statsArray.push({
            match_id: matchId, player_id: p.id,
            team_id: homePlayers.find(hp => hp.id === p.id) ? match?.home_team_id : match?.away_team_id,
            ppd: s.ppd || 0, score_180s: s.s180 || 0, score_140s: s.s140 || 0,
            hat_trick: s.hat || 0, white_horse: s.horse || 0, mpr: s.mpr || 0,
            checkout_rate: s.co_rate || 0, high_finish: s.high_finish || 0
         })
       }
    })
    
    if (statsArray.length > 0) {
        await supabase.from('match_stats').delete().eq('match_id', matchId)
        await supabase.from('match_stats').insert(statsArray)
    }
    alert('✅ 比赛信息已更新')
    router.push('/admin/schedule')
  }

  if (!match) return <div className="p-8">Loading...</div>

  const StatInput = ({ pid, field, ph, width = 'w-16' }: any) => (
    <input placeholder={ph} value={statsMap[pid]?.[field] || ''} onChange={e => handleStatChange(pid, field, e.target.value)} className={`bg-slate-900 ${width} px-2 py-1 text-sm rounded border border-slate-700 text-center focus:border-blue-500 outline-none`}/>
  )

  return (
    <div className="max-w-6xl mx-auto text-white pb-20">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">编辑比赛数据</h1>
            <div className="flex gap-4">
                <button onClick={() => setCurrentMatchType(currentMatchType === 'steel' ? 'soft' : 'steel')} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded border border-slate-500">
                    当前: {currentMatchType === 'steel' ? '🎯 硬镖' : '🕹️ 软镖'}
                </button>
                <Link href="/admin/schedule" className="text-slate-400 hover:text-white">取消</Link>
            </div>
        </div>

        {/* 1. 比赛排期管理 (新功能) */}
        <div className="bg-slate-800 p-4 rounded-lg mb-6 border border-slate-700 grid md:grid-cols-2 gap-4">
             <div>
                <label className="text-xs text-slate-500 block mb-1">开赛时间</label>
                <input 
                    type="datetime-local" 
                    value={startTime} 
                    onChange={e => setStartTime(e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white w-full"
                />
             </div>
             <div>
                <label className="text-xs text-slate-500 block mb-1">轮次名称 (例如: Week 1)</label>
                <input 
                    type="text" 
                    value={roundName} 
                    onChange={e => setRoundName(e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white w-full"
                />
             </div>
        </div>

        {/* 2. 大比分 */}
        <div className="bg-slate-800 p-6 rounded-lg mb-6 flex items-center justify-center gap-4 border border-slate-700">
            <div className="text-right">
                <div className="font-bold text-lg">
                  {match.home_team?.name || match.home_player?.username || `用户_${match.home_player_id?.substring(0, 8)}`}
                </div>
                <div className="text-xs text-slate-500">Home</div>
            </div>
            <input type="number" value={homeScore} onChange={e => setHomeScore(Number(e.target.value))} className="bg-slate-900 w-20 h-16 text-3xl text-center rounded border border-slate-700 font-bold" />
            <span className="text-2xl text-slate-500">:</span>
            <input type="number" value={awayScore} onChange={e => setAwayScore(Number(e.target.value))} className="bg-slate-900 w-20 h-16 text-3xl text-center rounded border border-slate-700 font-bold" />
            <div className="text-left">
                <div className="font-bold text-lg">
                  {match.away_team?.name || match.away_player?.username || `用户_${match.away_player_id?.substring(0, 8)}`}
                </div>
                <div className="text-xs text-slate-500">Away</div>
            </div>
            <label className="ml-8 flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-1 rounded border border-slate-600">
                <input type="checkbox" checked={isFinished} onChange={e => setIsFinished(e.target.checked)} className="w-5 h-5"/>
                <span className={isFinished ? "text-green-400 font-bold" : "text-slate-400"}>已完赛</span>
            </label>
        </div>

        {/* 3. 详细数据表格 */}
        <div className="bg-slate-800 p-6 rounded-lg space-y-8 border border-slate-700">
            {[
                { 
                  name: match.home_team?.name || match.home_player?.username || `用户_${match.home_player_id?.substring(0, 8)}`, 
                  players: homePlayers, 
                  color: 'text-blue-400' 
                },
                { 
                  name: match.away_team?.name || match.away_player?.username || `用户_${match.away_player_id?.substring(0, 8)}`, 
                  players: awayPlayers, 
                  color: 'text-red-400' 
                }
            ].map((group, idx) => (
                <div key={idx}>
                    <h3 className={`${group.color} font-bold mb-3 border-b border-slate-700 pb-2`}>{group.name}</h3>
                    <div className="space-y-2">
                        <div className="flex gap-2 text-[10px] text-slate-500 uppercase px-2 text-center font-bold">
                            <span className="w-24 text-left">姓名</span>
                            <span className="w-16">PPD</span>
                            {currentMatchType === 'steel' ? <><span className="w-16">180s</span><span className="w-16">140+</span></> : <><span className="w-16">MPR</span><span className="w-16">Hat</span><span className="w-16">Horse</span></>}
                            <span className="w-16">结镖%</span><span className="w-16">HiFin</span>
                        </div>
                        {group.players.map(p => (
                            <div key={p.id} className="flex gap-2 items-center bg-slate-900/30 p-2 rounded hover:bg-slate-900/50">
                                <span className="w-24 truncate text-sm font-bold">{p.username}</span>
                                <StatInput pid={p.id} field="ppd" ph="均分" />
                                {currentMatchType === 'steel' ? (
                                    <>
                                        <StatInput pid={p.id} field="s180" ph="180" />
                                        <StatInput pid={p.id} field="s140" ph="140+" />
                                    </>
                                ) : (
                                    <>
                                        <StatInput pid={p.id} field="mpr" ph="MPR" />
                                        <StatInput pid={p.id} field="hat" ph="帽子" />
                                        <StatInput pid={p.id} field="horse" ph="白马" />
                                    </>
                                )}
                                <StatInput pid={p.id} field="co_rate" ph="%" />
                                <StatInput pid={p.id} field="high_finish" ph="Hi" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            
            <button onClick={handleSave} className="w-full bg-blue-600 py-4 rounded font-bold hover:bg-blue-500 shadow-lg mt-4">
                💾 保存所有修改
            </button>
        </div>
    </div>
  )
}