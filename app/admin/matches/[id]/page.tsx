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
  const [winTarget, setWinTarget] = useState<number>(3) // 几局几胜（胜场目标）
  
  // 新增：时间和轮次编辑
  const [startTime, setStartTime] = useState('')
  const [roundName, setRoundName] = useState('')

  const [statsMap, setStatsMap] = useState<any>({})

  useEffect(() => {
    if (!matchId) return
    const initData = async () => {
      try {
        // 先尝试带关联查询
        const { data: matchData, error } = await supabase
        .from('matches')
          .select(`*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), home_player:profiles!home_player_id(id, username, avatar_url), away_player:profiles!away_player_id(id, username, avatar_url), tournaments(tournament_type)`)
        .eq('id', matchId)
        .single()
      
        let finalMatch = matchData

        if (error || !matchData) {
          console.warn('match join fetch error, fallback to base fields', error?.message || error)
          const { data: baseMatch, error: baseErr } = await supabase
            .from('matches')
            .select('*')
            .eq('id', matchId)
            .single()
          if (baseErr) {
            console.error('match base fetch error', baseErr?.message || baseErr)
            alert('读取比赛失败: ' + (baseErr?.message || JSON.stringify(baseErr)))
            setMatch({})
            return
          }
          finalMatch = baseMatch
          const { data: tData } = await supabase.from('tournaments').select('tournament_type').eq('id', baseMatch.tournament_id).single()
          if (tData) finalMatch = { ...finalMatch, tournaments: tData }
        }
        
        if (finalMatch) {
          setMatch(finalMatch)
          setHomeScore(finalMatch.home_score || 0)
          setAwayScore(finalMatch.away_score || 0)
          setIsFinished(finalMatch.is_finished || false)
          setCurrentMatchType(finalMatch.match_type || 'steel')
          setRoundName(finalMatch.round_name || '')
          setWinTarget(finalMatch.win_target || 3)

          if (finalMatch.start_time) {
              const dt = new Date(finalMatch.start_time)
            const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            setStartTime(localIso)
        }

          const isIndividual = finalMatch.tournaments?.tournament_type === 'individual' || finalMatch.home_player_id

          if (isIndividual) {
            if (finalMatch.home_player) setHomePlayers([finalMatch.home_player])
            else if (finalMatch.home_player_id) {
              const { data: hp } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', finalMatch.home_player_id).single()
              if (hp) setHomePlayers([hp])
            }
            if (finalMatch.away_player) setAwayPlayers([finalMatch.away_player])
            else if (finalMatch.away_player_id) {
              const { data: ap } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', finalMatch.away_player_id).single()
              if (ap) setAwayPlayers([ap])
            }
          } else {
        const { data: members } = await supabase
          .from('team_members')
          .select('team_id, profiles(id, username)')
              .in('team_id', [finalMatch.home_team_id, finalMatch.away_team_id])
        
        if (members) {
                setHomePlayers(members.filter((m: any) => m.team_id === finalMatch.home_team_id).map((m: any) => m.profiles))
                setAwayPlayers(members.filter((m: any) => m.team_id === finalMatch.away_team_id).map((m: any) => m.profiles))
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
      } catch (err: any) {
        console.error('initData error', err?.message || err, err)
        alert('加载比赛数据异常: ' + (err?.message || JSON.stringify(err)))
        setMatch({})
      }
    }
    initData()
  }, [matchId])

  const handleStatChange = (pid: string, field: string, val: string) => {
    setStatsMap((prev: any) => ({ ...prev, [pid]: { ...prev[pid], [field]: val } }))
  }

  // 通过服务端 API 重新汇总指定选手生涯数据（绕过 RLS）
  const recalcPlayers = async (playerIds: string[]) => {
    if (!playerIds.length) return
    const res = await fetch('/api/admin/recalc-players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds })
    })
    if (!res.ok) {
      const msg = await res.text()
      console.error('recalcPlayers failed', msg)
      alert('生涯数据更新失败: ' + msg)
    }
  }

  const handleSave = async () => {
    // 自动完赛判定：达到胜场目标则标记完赛
    const target = Number(winTarget || 0)
    const autoFinished = target > 0 && (homeScore >= target || awayScore >= target)
    const finishedFlag = autoFinished ? true : isFinished

    // 保存基本信息（带 win_target，列不存在则降级不写）
    const basePayload: any = {
      home_score: homeScore, 
      away_score: awayScore, 
      is_finished: finishedFlag, 
      match_type: currentMatchType,
      start_time: startTime ? new Date(startTime).toISOString() : null,
      round_name: roundName,
      win_target: target || null
    }
    let updateError = null
    const { error: firstErr } = await supabase.from('matches').update(basePayload).eq('id', matchId)
    if (firstErr?.message?.includes('win_target')) {
      const { error: retryErr } = await supabase.from('matches').update({
        home_score: homeScore, 
        away_score: awayScore, 
        is_finished: finishedFlag, 
        match_type: currentMatchType,
        start_time: startTime ? new Date(startTime).toISOString() : null,
        round_name: roundName
    }).eq('id', matchId)
      updateError = retryErr
    } else {
      updateError = firstErr
    }
    if (updateError) {
      alert('保存失败: ' + updateError.message)
      return
    }

    // 保存详细数据
    const statsArray: any[] = []
    const allPlayers = [...homePlayers, ...awayPlayers]
    allPlayers.forEach(p => {
       const s = statsMap[p.id] || {}
       if (Object.values(s).some(val => val)) {
         statsArray.push({
            match_id: matchId, player_id: p.id,
            team_id: (match?.tournaments?.tournament_type === 'individual' || match?.home_player_id || match?.away_player_id)
              ? null
              : (homePlayers.find(hp => hp.id === p.id) ? match?.home_team_id : match?.away_team_id),
            ppd: Number(s.ppd || 0), score_180s: Number(s.s180 || 0), score_140s: Number(s.s140 || 0),
            hat_trick: Number(s.hat || 0), white_horse: Number(s.horse || 0), mpr: Number(s.mpr || 0),
            checkout_rate: Number(s.co_rate || 0), high_finish: Number(s.high_finish || 0)
         })
       }
    })
    
    if (statsArray.length > 0) {
        await supabase.from('match_stats').delete().eq('match_id', matchId)
        await supabase.from('match_stats').insert(statsArray)
    } else {
        // 没有输入任何数据时清空原有记录
        await supabase.from('match_stats').delete().eq('match_id', matchId)
    }

    // 更新相关选手生涯数据（增量版）
    const playerIds = Array.from(new Set(allPlayers.map(p => p.id))) as string[]
    await recalcPlayers(playerIds)

    alert('✅ 比赛信息已更新')
    router.push('/admin/schedule')
  }

  if (!match) return <div className="p-8">Loading...</div>

  const StatInput = ({ pid, field, ph, width = 'w-16' }: any) => (
    <input 
      type="text"
      inputMode="decimal"
      pattern="[0-9.]*"
      placeholder={ph} 
      value={statsMap[pid]?.[field] ?? ''} 
      onChange={e => handleStatChange(pid, field, e.target.value)} 
      className={`bg-slate-900 ${width} px-2 py-1 text-sm rounded border border-slate-700 text-center focus:border-blue-500 outline-none`} 
    />
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
            <div className="ml-4 flex items-center gap-2 text-sm text-slate-400">
              <span>几局几胜</span>
              <input 
                type="number" 
                min={1} 
                value={winTarget} 
                onChange={e => setWinTarget(Number(e.target.value) || 0)}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-center"
              />
            </div>
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