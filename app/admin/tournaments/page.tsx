'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase' // 确保路径正确
import { useRouter } from 'next/navigation'

export default function AdminTournamentsPage() {
  const router = useRouter()
  
  // === 基础设置 ===
  const [name, setName] = useState('')
  const [format, setFormat] = useState('league') 
  const [dartType, setDartType] = useState('steel') 
  
  // === 积分规则 (新功能) ===
  const [pointsRule, setPointsRule] = useState({ win: 2, draw: 1, loss: 0 })

  // === 排期设置 ===
  // 修正时区问题，获取本地 ISO 时间字符串
  const getDefaultTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }
  const [startTime, setStartTime] = useState(getDefaultTime())
  const [intervalType, setIntervalType] = useState('week') 
  const [matchDuration, setMatchDuration] = useState(30) 

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

  // 计算战力 (用于均衡匹配)
  const getTeamPower = (id: number) => {
    const team = allTeams.find(t => t.id === id)
    if (!team?.team_members?.length) return 0
    // 假设 level 是 1-20，求平均值
    return team.team_members.reduce((s:number, m:any) => s + (m.profiles?.level||0), 0) / team.team_members.length
  }

  // === 贝格尔编排算法 ===
  const generateRoundRobin = (teams: number[]) => {
    const schedule = []
    const n = teams.length
    if (n % 2 !== 0) teams.push(-1) // 轮空标记
    
    const totalRounds = teams.length - 1
    const half = teams.length / 2
    const rotation = [...teams]

    for (let round = 0; round < totalRounds; round++) {
        const roundMatches = []
        for (let i = 0; i < half; i++) {
            const home = rotation[i]
            const away = rotation[teams.length - 1 - i]
            if (home !== -1 && away !== -1) {
                roundMatches.push({ home, away })
            }
        }
        schedule.push(roundMatches)
        const last = rotation.pop()
        if (last) rotation.splice(1, 0, last)
    }
    return schedule
  }

  const handleGenerate = async () => {
    if (!name || selectedTeams.length < 2) return alert('请完善信息并至少选择2支队伍')
    setLoading(true)

    try {
        // 1. 创建赛事 (写入积分规则 scoring_rules)
        const { data: tournament, error: tError } = await supabase
            .from('tournaments')
            .insert({ 
              name, 
              status: 'upcoming', 
              format, 
              dart_type: dartType,
              scoring_rules: format === 'knockout' ? null : pointsRule // 淘汰赛不需要积分规则
            })
            .select().single()

        if (tError) throw tError

        // 2. 准备队伍
        let teams = [...selectedTeams]
        if (balanceMode) teams.sort((a, b) => getTeamPower(b) - getTeamPower(a))
        else teams.sort(() => Math.random() - 0.5)

        const matchesToInsert: any[] = []
        const baseType = dartType === 'mixed' ? 'steel' : dartType

        // === 生成赛程逻辑 ===
        if (format === 'league' || format === 'double_league') {
            const rounds = generateRoundRobin(teams)
            if (format === 'double_league') {
                const secondHalf = rounds.map(round => round.map(m => ({ home: m.away, away: m.home })))
                rounds.push(...secondHalf)
            }

            const baseDate = new Date(startTime)
            rounds.forEach((roundMatches, roundIndex) => {
                const roundDate = new Date(baseDate)
                if (intervalType === 'week') roundDate.setDate(baseDate.getDate() + (roundIndex * 7))
                else if (intervalType === 'day') roundDate.setDate(baseDate.getDate() + (roundIndex * 1))
                
                roundMatches.forEach((m, i) => {
                    let matchTime = new Date(roundDate)
                    if (intervalType === 'manual') matchTime = new Date(baseDate.getTime() + (matchesToInsert.length * matchDuration * 60000))
                    
                    matchesToInsert.push({
                        tournament_id: tournament.id,
                        home_team_id: m.home,
                        away_team_id: m.away,
                        start_time: matchTime.toISOString(),
                        is_finished: false,
                        match_type: baseType,
                        round_name: `Round ${roundIndex + 1}`,
                        round_order: roundIndex + 1
                    })
                })
            })
        } 
        else if (format === 'knockout') {
             // 淘汰赛：只生成第一轮 (例如 8强赛)
             // 后续轮次需要在管理后台根据胜者手动晋级 (这是淘汰赛系统的常规做法)
             const totalMatches = Math.floor(teams.length / 2)
             for(let i=0; i<totalMatches; i++) {
                 matchesToInsert.push({
                    tournament_id: tournament.id,
                    home_team_id: teams[i*2],
                    away_team_id: teams[i*2+1],
                    start_time: startTime,
                    is_finished: false,
                    match_type: baseType,
                    round_name: 'Quarter-Finals', // 这里暂时写死，实际应根据队伍数判断 (Top 16 / Top 8)
                    round_order: 1
                 })
             }
        }

        if (matchesToInsert.length > 0) {
            await supabase.from('matches').insert(matchesToInsert)
        }

        alert('✅ 赛事创建成功！')
        router.push('/admin/schedule')

    } catch (error: any) {
        alert('错误: ' + error.message)
    } finally {
        setLoading(false)
    }
  }

  // DartsGo 极简按钮组件
  const OptionBtn = ({label, active, onClick}:any) => (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium border transition-all ${active ? 'bg-white text-black border-white' : 'bg-transparent text-neutral-400 border-neutral-700 hover:border-neutral-500'}`}>
        {label}
    </button>
  )

  return (
    <div className="max-w-4xl pb-20 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-white">新赛事</h1>
        <div className="text-xs text-neutral-500 uppercase tracking-widest border border-neutral-800 px-2 py-1 rounded">DartsGo Admin</div>
      </div>

      {/* 1. 基本信息 */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">01. 基本信息</h3>
        <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-xs text-neutral-400">赛事名称</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-white transition-colors p-3 text-white outline-none" placeholder="e.g. 2025 Winter League"/>
            </div>
            <div className="space-y-2">
                <label className="text-xs text-neutral-400">比赛类型</label>
                <div className="flex gap-2">
                    <OptionBtn label="Steel" active={dartType==='steel'} onClick={()=>setDartType('steel')} />
                    <OptionBtn label="Soft" active={dartType==='soft'} onClick={()=>setDartType('soft')} />
                    <OptionBtn label="Mixed" active={dartType==='mixed'} onClick={()=>setDartType('mixed')} />
                </div>
            </div>
        </div>
      </section>

      {/* 2. 赛制与积分 (重点修改) */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">02. 规则设置</h3>
        <div className="border border-neutral-800 p-6 space-y-6">
            
            {/* 赛制选择 */}
            <div className="space-y-2">
                <label className="text-xs text-neutral-400">赛制</label>
                <div className="flex gap-2">
                    <OptionBtn label="Single League" active={format==='league'} onClick={()=>setFormat('league')} />
                    <OptionBtn label="Double League" active={format==='double_league'} onClick={()=>setFormat('double_league')} />
                    <OptionBtn label="Knockout" active={format==='knockout'} onClick={()=>setFormat('knockout')} />
                </div>
            </div>

            {/* 积分规则配置 (仅循环赛显示) */}
            {format !== 'knockout' && (
                <div className="space-y-2 animate-in fade-in">
                    <label className="text-xs text-neutral-400">积分规则</label>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">WIN</span>
                            <input type="number" value={pointsRule.win} onChange={e=>setPointsRule({...pointsRule, win: Number(e.target.value)})} className="w-16 bg-[#0a0a0a] border border-neutral-700 text-center text-white py-1 focus:border-white outline-none"/>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">DRAW</span>
                            <input type="number" value={pointsRule.draw} onChange={e=>setPointsRule({...pointsRule, draw: Number(e.target.value)})} className="w-16 bg-[#0a0a0a] border border-neutral-700 text-center text-white py-1 focus:border-white outline-none"/>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">LOSS</span>
                            <input type="number" value={pointsRule.loss} onChange={e=>setPointsRule({...pointsRule, loss: Number(e.target.value)})} className="w-16 bg-[#0a0a0a] border border-neutral-700 text-center text-white py-1 focus:border-white outline-none"/>
                        </div>
                    </div>
                </div>
            )}

            {/* 时间设置 */}
            <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-neutral-800/50">
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400">开始时间</label>
                    <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-[#0a0a0a] border border-neutral-700 text-white p-2 outline-none"/>
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400">比赛频率</label>
                    <select value={intervalType} onChange={e=>setIntervalType(e.target.value)} className="w-full bg-[#0a0a0a] border border-neutral-700 text-white p-2.5 outline-none">
                        <option value="week">Weekly (Every 7 days)</option>
                        <option value="day">Daily (Every 1 day)</option>
                        <option value="manual">Compact (Manual minutes)</option>
                    </select>
                </div>
            </div>
        </div>
      </section>

      {/* 3. 参赛队伍 */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
             <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">03. 参赛队伍</h3>
             <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={balanceMode} onChange={e=>setBalanceMode(e.target.checked)} className="accent-white"/>
                <span className="text-xs text-neutral-400">自动平衡队伍实力</span>
             </label>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-2">
            {allTeams.map(t => (
                <div key={t.id} onClick={()=>toggleTeam(t.id)} className={`cursor-pointer px-3 py-2 border text-xs font-bold truncate transition-all ${selectedTeams.includes(t.id)?'bg-white text-black border-white':'border-neutral-800 bg-[#0a0a0a] text-neutral-400 hover:border-neutral-600'}`}>
                    {selectedTeams.includes(t.id) ? '● ' : ''} {t.name}
                </div>
            ))}
        </div>
      </section>

      <button onClick={handleGenerate} disabled={loading} className="w-full bg-white text-black font-bold py-4 hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'GENERATING...' : '创建赛事'}
      </button>
    </div>
  )
}