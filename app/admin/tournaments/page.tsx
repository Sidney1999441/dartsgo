'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminTournamentsPage() {
  const router = useRouter()
  // 基础设置
  const [name, setName] = useState('')
  const [format, setFormat] = useState('league') 
  const [dartType, setDartType] = useState('steel') 
  
  // === 排期设置 ===
  const defaultTime = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const [startTime, setStartTime] = useState(defaultTime)
  const [intervalType, setIntervalType] = useState('week') // week(每周), day(每天), manual(手动/紧凑)
  const [matchDuration, setMatchDuration] = useState(30) // 紧凑模式下的单场间隔

  const [balanceMode, setBalanceMode] = useState(false)
  const [selectedTeams, setSelectedTeams] = useState<number[]>([])
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchTeams() }, [])
  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select(`*, team_members( profiles(level) )`)
    if (data) setAllTeams(data)
  }

  const toggleTeam = (id: number) => {
    if (selectedTeams.includes(id)) setSelectedTeams(selectedTeams.filter(t => t !== id))
    else setSelectedTeams([...selectedTeams, id])
  }

  const getTeamPower = (id: number) => {
    const team = allTeams.find(t => t.id === id)
    if (!team?.team_members?.length) return 0
    return team.team_members.reduce((s:number, m:any) => s + (m.profiles?.level||0), 0) / team.team_members.length
  }

  // === 核心：贝格尔编排法生成器 ===
  const generateRoundRobin = (teams: number[]) => {
    const schedule = []
    const n = teams.length
    // 如果队伍是奇数，添加一个 -1 作为轮空标记 (Dummy Team)
    if (n % 2 !== 0) {
        teams.push(-1) 
    }
    
    const totalRounds = teams.length - 1
    const half = teams.length / 2
    
    // 复制一份队伍列表用于轮转
    const rotation = [...teams]

    for (let round = 0; round < totalRounds; round++) {
        const roundMatches = []
        for (let i = 0; i < half; i++) {
            const home = rotation[i]
            const away = rotation[teams.length - 1 - i]
            
            // 只要不是轮空(-1)，就生成比赛
            if (home !== -1 && away !== -1) {
                roundMatches.push({ home, away })
            }
        }
        schedule.push(roundMatches)

        // === 轮转数组 (贝格尔算法核心) ===
        // 固定第一个元素(rotation[0])，剩下的元素循环右移
        // [0, 1, 2, 3] -> Round 1: 0-3, 1-2
        // 下一轮: 固定0，[1, 2, 3] 变成 [3, 1, 2] -> [0, 3, 1, 2]
        const last = rotation.pop()
        if (last) rotation.splice(1, 0, last)
    }

    return schedule
  }

  const handleGenerate = async () => {
    if (!name || selectedTeams.length < 2) return alert('请完善信息')
    setLoading(true)

    try {
        const { data: tournament, error: tError } = await supabase
            .from('tournaments')
            .insert({ name, status: 'upcoming', format, dart_type: dartType })
            .select().single()
        if (tError) throw tError

        let teams = [...selectedTeams]
        if (balanceMode) teams.sort((a, b) => getTeamPower(b) - getTeamPower(a))
        else teams.sort(() => Math.random() - 0.5)

        const matchesToInsert: any[] = []
        const baseType = dartType === 'mixed' ? 'steel' : dartType

        // === 1. 单循环 / 双循环生成逻辑 ===
        if (format === 'league' || format === 'double_league') {
            const rounds = generateRoundRobin(teams) // 生成基本对阵轮次
            
            // 如果是双循环，把刚才的轮次复制一份，主客对调，追加到后面
            if (format === 'double_league') {
                const secondHalf = rounds.map(round => round.map(m => ({ home: m.away, away: m.home })))
                rounds.push(...secondHalf)
            }

            // === 2. 分配时间 (按周/按天) ===
            const baseDate = new Date(startTime)
            
            rounds.forEach((roundMatches, roundIndex) => {
                // 计算这一轮的基准时间
                const roundDate = new Date(baseDate)
                
                if (intervalType === 'week') {
                    // 每周一轮：Start + 7天 * 轮次
                    roundDate.setDate(baseDate.getDate() + (roundIndex * 7))
                } else if (intervalType === 'day') {
                    // 每天一轮：Start + 1天 * 轮次
                    roundDate.setDate(baseDate.getDate() + (roundIndex * 1))
                } else {
                    // 紧凑模式：所有比赛按分钟堆叠，不分轮次概念
                    // (但在数据库里还是记作 Round N 方便筛选)
                }

                roundMatches.forEach((m, matchIndex) => {
                    // 具体的开赛时间
                    let matchTime = new Date(roundDate)
                    
                    if (intervalType === 'manual') {
                        // 紧凑模式：累计叠加时间
                        const globalIndex = matchesToInsert.length
                        matchTime = new Date(baseDate.getTime() + globalIndex * matchDuration * 60000)
                    } else {
                        // 联赛模式：同一轮的比赛，时间可以设为一样，或者稍微错开5分钟防止并发写入冲突
                        // 这里默认同一轮的所有比赛都是同一天同一个时间点开打（标准联赛做法）
                        // 如果你想同一天内错开，可以用 matchIndex * 10 分钟
                    }

                    matchesToInsert.push({
                        tournament_id: tournament.id,
                        home_team_id: m.home,
                        away_team_id: m.away,
                        start_time: matchTime.toISOString(),
                        is_finished: false,
                        match_type: baseType,
                        round_name: `第 ${roundIndex + 1} 轮`, // 写入 "第 1 轮"
                        round_order: roundIndex + 1
                    })
                })
            })
        } 
        // === 3. 淘汰赛逻辑 (简单处理) ===
        else if (format === 'knockout') {
             // 淘汰赛第一轮
             const totalMatches = Math.floor(teams.length / 2)
             for(let i=0; i<totalMatches; i++) {
                 matchesToInsert.push({
                    tournament_id: tournament.id,
                    home_team_id: teams[i*2],
                    away_team_id: teams[i*2+1],
                    start_time: startTime,
                    is_finished: false,
                    match_type: baseType,
                    round_name: '第一轮',
                    round_order: 1
                 })
             }
        }

        if (matchesToInsert.length > 0) {
            await supabase.from('matches').insert(matchesToInsert)
        }

        alert(`✅ 成功生成 ${matchesToInsert.length} 场比赛！\n已按【${intervalType==='week'?'每周一轮':intervalType==='day'?'每天一轮':'紧凑模式'}】排期。`)
        router.push('/admin/schedule')

    } catch (error: any) {
        alert('失败: ' + error.message)
    } finally {
        setLoading(false)
    }
  }

  // 样式辅助
  const Btn = ({label, active, onClick}:any) => (
    <div onClick={onClick} className={`cursor-pointer p-3 rounded border text-center text-sm font-bold transition-all select-none ${active ? 'bg-blue-600 border-blue-400 text-white shadow-lg ring-2 ring-blue-500/50' : 'bg-slate-900 border-slate-600 text-slate-400'}`}>
        {label}
    </div>
  )

  return (
    <div className="space-y-6 text-white max-w-4xl pb-20">
      <h1 className="text-2xl font-bold">⚡️ 创建职业联赛</h1>
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-6">
        
        {/* 基础信息 */}
        <div className="grid md:grid-cols-2 gap-4">
            <div>
                <label className="text-xs text-slate-400 block mb-1">赛事名称</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2" placeholder="2025 S1 赛季"/>
            </div>
            <div>
                <label className="text-xs text-slate-400 block mb-1">飞镖类型</label>
                <div className="grid grid-cols-3 gap-2">
                    <Btn label="硬镖" active={dartType==='steel'} onClick={()=>setDartType('steel')} />
                    <Btn label="软镖" active={dartType==='soft'} onClick={()=>setDartType('soft')} />
                    <Btn label="混合" active={dartType==='mixed'} onClick={()=>setDartType('mixed')} />
                </div>
            </div>
        </div>

        {/* 赛制与排期 (核心升级) */}
        <div className="bg-slate-900/50 p-4 rounded border border-slate-600/50 space-y-4">
            <h3 className="text-sm font-bold text-yellow-400">📅 赛制与排期</h3>
            
            {/* 赛制 */}
            <div className="grid grid-cols-3 gap-2">
                <Btn label="单循环 (League)" active={format==='league'} onClick={()=>setFormat('league')} />
                <Btn label="双循环 (Home/Away)" active={format==='double_league'} onClick={()=>setFormat('double_league')} />
                <Btn label="淘汰赛 (Knockout)" active={format==='knockout'} onClick={()=>setFormat('knockout')} />
            </div>

            {/* 时间间隔设置 */}
            <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
                <div>
                    <label className="text-xs text-slate-400 block mb-1">首轮开赛时间</label>
                    <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"/>
                </div>
                <div>
                    <label className="text-xs text-slate-400 block mb-1">排期频率</label>
                    <select value={intervalType} onChange={e=>setIntervalType(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white">
                        <option value="week">📅 每周一轮 (Week 1, Week 2...)</option>
                        <option value="day">🌙 每天一轮 (Round 1, Round 2...)</option>
                        <option value="manual">⚡ 紧凑模式 (按分钟顺延)</option>
                    </select>
                </div>
            </div>
            {intervalType === 'manual' && (
                <div>
                    <label className="text-xs text-slate-400 block mb-1">单场间隔 (分钟)</label>
                    <input type="number" value={matchDuration} onChange={e=>setMatchDuration(Number(e.target.value))} className="w-20 bg-slate-800 border border-slate-600 rounded p-2"/>
                </div>
            )}
        </div>

        {/* 队伍选择 */}
        <div>
            <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">选择战队 ({selectedTeams.length})</span>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={balanceMode} onChange={e=>setBalanceMode(e.target.checked)} className="w-4 h-4"/><span className="text-xs text-slate-400">均衡匹配</span></label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {allTeams.map(t => (
                    <div key={t.id} onClick={()=>toggleTeam(t.id)} className={`cursor-pointer p-2 rounded border text-xs font-bold truncate transition-colors ${selectedTeams.includes(t.id)?'bg-blue-600/30 border-blue-500 text-blue-200':'border-slate-700 bg-slate-800 hover:bg-slate-700'}`}>
                        {selectedTeams.includes(t.id) && '✓ '} {t.name}
                    </div>
                ))}
            </div>
        </div>

        <button onClick={handleGenerate} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-blue-500/20 transition-all">
            {loading ? '正在计算赛程...' : '🚀 生成职业赛程表'}
        </button>
      </div>
    </div>
  )
}