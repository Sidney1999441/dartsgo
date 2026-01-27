'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase' // 确保路径正确
import { useRouter } from 'next/navigation'

export default function AdminTournamentsPage() {
  const router = useRouter()
  
  // === 基础设置 ===
  const [name, setName] = useState('')
  const [tournamentType, setTournamentType] = useState<'team' | 'individual'>('team') // 新增：团队赛/个人赛
  const [format, setFormat] = useState('league') 
  const [dartType, setDartType] = useState('steel') 
  const [winTarget, setWinTarget] = useState<number>(3) // 每场几局几胜（胜场）
  
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

  // === 团队赛相关 ===
  const [balanceMode, setBalanceMode] = useState(false)
  const [selectedTeams, setSelectedTeams] = useState<number[]>([])
  const [allTeams, setAllTeams] = useState<any[]>([])

  // === 个人赛相关 ===
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [allPlayers, setAllPlayers] = useState<any[]>([])

  const [loading, setLoading] = useState(false)

  useEffect(() => { 
    fetchTeams()
    fetchPlayers()
  }, [])

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select(`*, team_members( profiles(level) )`)
    if (data) setAllTeams(data)
  }

  const fetchPlayers = async () => {
    const { data } = await supabase.from('profiles')
      .select('id, username, level, tier, avatar_url')
      .not('username', 'is', null)
      .order('level', { ascending: false })
    if (data) setAllPlayers(data)
  }

  const toggleTeam = (id: number) => {
    if (selectedTeams.includes(id)) setSelectedTeams(selectedTeams.filter(t => t !== id))
    else setSelectedTeams([...selectedTeams, id])
  }

  const togglePlayer = (id: string) => {
    if (selectedPlayers.includes(id)) setSelectedPlayers(selectedPlayers.filter(p => p !== id))
    else setSelectedPlayers([...selectedPlayers, id])
  }

  // 计算战力 (用于均衡匹配)
  const getTeamPower = (id: number) => {
    const team = allTeams.find(t => t.id === id)
    if (!team?.team_members?.length) return 0
    // 假设 level 是 1-20，求平均值
    return team.team_members.reduce((s:number, m:any) => s + (m.profiles?.level||0), 0) / team.team_members.length
  }

  // === 贝格尔编排算法 (团队赛) ===
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

  // === 瑞士轮算法 (支持个人赛/团队赛) ===
  const generateSwissRound = <T extends string | number>(players: T[], existingMatches: any[] = [], roundNumber: number = 1) => {
    if (players.length < 2) return []

    // 计算每个选手的积分和对手历史
    const playerStats = new Map<T, { points: number, opponents: Set<T>, wins: number, losses: number }>()
    
    players.forEach(p => {
      playerStats.set(p, { points: 0, opponents: new Set<T>(), wins: 0, losses: 0 })
    })

    // 从已有比赛中计算积分
    existingMatches.forEach(m => {
      if (!m.is_finished) return
      const homeId = (m.home_player_id ?? m.home_team_id) as T | undefined
      const awayId = (m.away_player_id ?? m.away_team_id) as T | undefined
      
      if (homeId !== undefined && awayId !== undefined && playerStats.has(homeId) && playerStats.has(awayId)) {
        const home = playerStats.get(homeId)!
        const away = playerStats.get(awayId)!
        
        home.opponents.add(awayId)
        away.opponents.add(homeId)
        
        if (m.home_score > m.away_score) {
          home.points += pointsRule.win
          home.wins++
          away.points += pointsRule.loss
          away.losses++
        } else if (m.home_score < m.away_score) {
          away.points += pointsRule.win
          away.wins++
          home.points += pointsRule.loss
          home.losses++
        } else {
          home.points += pointsRule.draw
          away.points += pointsRule.draw
        }
      }
    })

    // 按积分排序（积分相同按胜场数，再相同随机）
    const sortedPlayers = [...players].sort((a, b) => {
      const statsA = playerStats.get(a)!
      const statsB = playerStats.get(b)!
      if (statsB.points !== statsA.points) return statsB.points - statsA.points
      if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins
      return Math.random() - 0.5
    })

    // 配对：尽量让积分相近的选手对战，避免重复对战
    const matches: { home: string, away: string }[] = []
    const used = new Set<string>()

    for (let i = 0; i < sortedPlayers.length; i++) {
      if (used.has(sortedPlayers[i])) continue

      let paired = false
      // 尝试与积分相近且未对战过的选手配对
      for (let j = i + 1; j < sortedPlayers.length; j++) {
        if (used.has(sortedPlayers[j])) continue
        
        const statsI = playerStats.get(sortedPlayers[i])!
        // 检查是否已对战过
        if (!statsI.opponents.has(sortedPlayers[j])) {
          matches.push({ home: sortedPlayers[i], away: sortedPlayers[j] })
          used.add(sortedPlayers[i])
          used.add(sortedPlayers[j])
          paired = true
          break
        }
      }

      // 如果找不到未对战过的，选择积分最接近的
      if (!paired) {
        for (let j = i + 1; j < sortedPlayers.length; j++) {
          if (used.has(sortedPlayers[j])) continue
          matches.push({ home: sortedPlayers[i], away: sortedPlayers[j] })
          used.add(sortedPlayers[i])
          used.add(sortedPlayers[j])
          break
        }
      }
    }

    // 如果人数为奇数，最后一人轮空
    if (sortedPlayers.length % 2 !== 0 && !used.has(sortedPlayers[sortedPlayers.length - 1])) {
      // 轮空选手本轮不参与比赛，但可以记录
    }

    return matches
  }

  const handleGenerate = async () => {
    // 验证
    if (!name) return alert('请输入赛事名称')
    if (tournamentType === 'team' && selectedTeams.length < 2) return alert('请至少选择2支队伍')
    if (tournamentType === 'individual' && selectedPlayers.length < 2) return alert('请至少选择2名选手')
    
    setLoading(true)

    try {
        // 1. 创建赛事
        // 构建插入对象
        const insertData: any = { 
          name, 
          status: 'upcoming', 
          format, 
          dart_type: dartType,
          scoring_rules: format === 'knockout' ? null : pointsRule
        }
        
        // 添加 tournament_type（如果字段不存在，会在插入时失败，我们会重试）
        insertData.tournament_type = tournamentType
        
        let tournament: any = null
        const { data: tournamentData, error: tError } = await supabase
            .from('tournaments')
            .insert(insertData)
            .select().single()

        if (tError) {
          // 如果是因为 tournament_type 字段不存在，尝试不包含该字段重新插入
          if (tError.message?.includes('tournament_type') || tError.message?.includes('column')) {
            console.warn('tournament_type 字段不存在，使用默认团队赛模式')
            const { data: retryTournament, error: retryError } = await supabase
            .from('tournaments')
            .insert({ 
              name, 
              status: 'upcoming', 
              format, 
              dart_type: dartType,
                scoring_rules: format === 'knockout' ? null : pointsRule
            })
            .select().single()

            if (retryError) throw retryError
            // 使用重试的结果，并在内存中标记 tournament_type
            tournament = retryTournament ? { ...retryTournament, tournament_type: tournamentType } : null
          } else {
            throw tError
          }
        } else {
          tournament = tournamentData
        }

        if (!tournament) throw new Error('创建赛事失败')

        const matchesToInsert: any[] = []
        const baseType = dartType === 'mixed' ? 'steel' : dartType
        const baseDate = new Date(startTime)

        // === 团队赛逻辑 ===
        if (tournamentType === 'team') {
        let teams = [...selectedTeams]
        if (balanceMode) teams.sort((a, b) => getTeamPower(b) - getTeamPower(a))
        else teams.sort(() => Math.random() - 0.5)

        if (format === 'league' || format === 'double_league') {
            const rounds = generateRoundRobin(teams)
            if (format === 'double_league') {
                const secondHalf = rounds.map(round => round.map(m => ({ home: m.away, away: m.home })))
                rounds.push(...secondHalf)
            }

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
                            round_order: roundIndex + 1,
                            win_target: winTarget || null
                    })
                })
            })
            } 
            else if (format === 'swiss') {
                const numRounds = Math.ceil(Math.log2(teams.length)) + 1
                let existingMatches: any[] = []

                for (let roundIndex = 0; roundIndex < numRounds; roundIndex++) {
                    const roundMatches = generateSwissRound<number>(teams, existingMatches, roundIndex + 1)

                    const roundDate = new Date(baseDate)
                    if (intervalType === 'week') roundDate.setDate(baseDate.getDate() + (roundIndex * 7))
                    else if (intervalType === 'day') roundDate.setDate(baseDate.getDate() + (roundIndex * 1))

                    roundMatches.forEach((m) => {
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
                            round_order: roundIndex + 1,
                            win_target: winTarget || null
                        })
                    })
                }
        } 
        else if (format === 'knockout') {
             const totalMatches = Math.floor(teams.length / 2)
             for(let i=0; i<totalMatches; i++) {
                 matchesToInsert.push({
                    tournament_id: tournament.id,
                    home_team_id: teams[i*2],
                    away_team_id: teams[i*2+1],
                    start_time: startTime,
                    is_finished: false,
                    match_type: baseType,
                        round_name: 'Quarter-Finals',
                        round_order: 1,
                        win_target: winTarget || null
                    })
                }
            }
        }
        // === 个人赛逻辑 ===
        else if (tournamentType === 'individual') {
            let players = [...selectedPlayers]
            players.sort(() => Math.random() - 0.5) // 第一轮随机排序

            if (format === 'swiss') {
                // 瑞士轮：生成多轮（通常为 log2(选手数) 向上取整 + 1）
                const numRounds = Math.ceil(Math.log2(players.length)) + 1
                let existingMatches: any[] = []

                for (let roundIndex = 0; roundIndex < numRounds; roundIndex++) {
                    const roundMatches = generateSwissRound(players, existingMatches, roundIndex + 1)
                    
                    const roundDate = new Date(baseDate)
                    if (intervalType === 'week') roundDate.setDate(baseDate.getDate() + (roundIndex * 7))
                    else if (intervalType === 'day') roundDate.setDate(baseDate.getDate() + (roundIndex * 1))

                    roundMatches.forEach((m, i) => {
                        let matchTime = new Date(roundDate)
                        if (intervalType === 'manual') matchTime = new Date(baseDate.getTime() + (matchesToInsert.length * matchDuration * 60000))
                        
                        matchesToInsert.push({
                            tournament_id: tournament.id,
                            home_player_id: m.home,
                            away_player_id: m.away,
                            start_time: matchTime.toISOString(),
                            is_finished: false,
                            match_type: baseType,
                            round_name: `Round ${roundIndex + 1}`,
                            round_order: roundIndex + 1,
                            win_target: winTarget || null
                        })
                    })

                    // 模拟已完成的比赛（用于下一轮配对计算）
                    // 注意：实际比赛中，这些比赛需要完成后才能生成下一轮
                    // 这里先全部生成，管理员可以在完成后手动生成下一轮
                }
            }
            else if (format === 'league' || format === 'double_league') {
                // 个人赛循环赛：类似团队赛的贝格尔编排
                // 使用索引数组，然后映射回player ID
                const playerIndices = players.map((_, i) => i)
                const rounds = generateRoundRobin(playerIndices)
                if (format === 'double_league') {
                    const secondHalf = rounds.map(round => round.map(m => ({ home: m.away, away: m.home })))
                    rounds.push(...secondHalf)
                }

                rounds.forEach((roundMatches, roundIndex) => {
                    const roundDate = new Date(baseDate)
                    if (intervalType === 'week') roundDate.setDate(baseDate.getDate() + (roundIndex * 7))
                    else if (intervalType === 'day') roundDate.setDate(baseDate.getDate() + (roundIndex * 1))
                    
                    roundMatches.forEach((m, i) => {
                        let matchTime = new Date(roundDate)
                        if (intervalType === 'manual') matchTime = new Date(baseDate.getTime() + (matchesToInsert.length * matchDuration * 60000))
                        
                        matchesToInsert.push({
                            tournament_id: tournament.id,
                            home_player_id: players[m.home],
                            away_player_id: players[m.away],
                            start_time: matchTime.toISOString(),
                            is_finished: false,
                            match_type: baseType,
                            round_name: `Round ${roundIndex + 1}`,
                            round_order: roundIndex + 1,
                            win_target: winTarget || null
                        })
                    })
                })
            }
            else if (format === 'knockout') {
                const totalMatches = Math.floor(players.length / 2)
                for(let i=0; i<totalMatches; i++) {
                    matchesToInsert.push({
                        tournament_id: tournament.id,
                        home_player_id: players[i*2],
                        away_player_id: players[i*2+1],
                        start_time: startTime,
                        is_finished: false,
                        match_type: baseType,
                        round_name: 'Quarter-Finals',
                        round_order: 1,
                        win_target: winTarget || null
                    })
                }
             }
        }

        if (matchesToInsert.length > 0) {
            let { error: matchesError } = await supabase.from('matches').insert(matchesToInsert)
            // 如果 win_target 列不存在，降级重试（去掉该字段）
            if (matchesError?.message?.includes('win_target')) {
              const stripped = matchesToInsert.map(m => {
                const { win_target, ...rest } = m
                return rest
              })
              const retry = await supabase.from('matches').insert(stripped)
              matchesError = retry.error
            }
            if (matchesError) throw matchesError
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
        <div className="text-xs text-neutral-500 uppercase tracking-widest border border-neutral-800 px-2 py-1 rounded">SydArts Admin</div>
      </div>

      {/* 1. 基本信息 */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">01. 基本信息</h3>
        <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label htmlFor="tournament-name" className="text-xs text-neutral-400 block">赛事名称</label>
                <input 
                  id="tournament-name"
                  type="text"
                  value={name || ''} 
                  onChange={(e) => {
                    const newValue = e.target.value
                    setName(newValue)
                  }}
                  onInput={(e) => {
                    const newValue = (e.target as HTMLInputElement).value
                    setName(newValue)
                  }}
                  className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-white transition-colors p-3 text-white outline-none placeholder:text-neutral-600 focus:ring-0 focus-visible:ring-0" 
                  placeholder="e.g. 2025 Winter League"
                  disabled={loading}
                  readOnly={loading}
                  autoComplete="off"
                  tabIndex={loading ? -1 : 0}
                />
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

      {/* 2. 赛事类型选择 */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">02. 赛事类型</h3>
        <div className="border border-neutral-800 p-6 space-y-6">
            <div className="space-y-2">
                <label className="text-xs text-neutral-400">选择赛事类型</label>
                <div className="flex gap-2">
                    <OptionBtn label="团队赛" active={tournamentType==='team'} onClick={()=>{setTournamentType('team'); setFormat('league')}} />
                    <OptionBtn label="个人赛" active={tournamentType==='individual'} onClick={()=>{setTournamentType('individual'); setFormat('swiss')}} />
                </div>
            </div>
        </div>
      </section>

      {/* 3. 赛制与积分 */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">03. 规则设置</h3>
        <div className="border border-neutral-800 p-6 space-y-6">
            
            {/* 赛制选择 */}
            <div className="space-y-2">
                <label className="text-xs text-neutral-400">赛制</label>
                <div className="flex gap-2 flex-wrap">
                    {tournamentType === 'team' ? (
                        <>
                            <OptionBtn label="Single League" active={format==='league'} onClick={()=>setFormat('league')} />
                            <OptionBtn label="Double League" active={format==='double_league'} onClick={()=>setFormat('double_league')} />
                            <OptionBtn label="Swiss Round" active={format==='swiss'} onClick={()=>setFormat('swiss')} />
                            <OptionBtn label="Knockout" active={format==='knockout'} onClick={()=>setFormat('knockout')} />
                        </>
                    ) : (
                        <>
                            <OptionBtn label="Swiss Round" active={format==='swiss'} onClick={()=>setFormat('swiss')} />
                    <OptionBtn label="Single League" active={format==='league'} onClick={()=>setFormat('league')} />
                    <OptionBtn label="Double League" active={format==='double_league'} onClick={()=>setFormat('double_league')} />
                    <OptionBtn label="Knockout" active={format==='knockout'} onClick={()=>setFormat('knockout')} />
                        </>
                    )}
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

            {/* 时间/场次设置 */}
            <div className="grid md:grid-cols-3 gap-6 pt-4 border-t border-neutral-800/50">
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400">开始时间</label>
                    <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-[#0a0a0a] border border-neutral-700 text-white p-2 outline-none"/>
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-neutral-400">几局几胜（胜场）</label>
                    <input type="number" min={1} value={winTarget} onChange={e=>setWinTarget(Number(e.target.value)||0)} className="w-full bg-[#0a0a0a] border border-neutral-700 text-white p-2 outline-none"/>
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

      {/* 4. 参赛队伍/选手 */}
      {tournamentType === 'team' ? (
      <section className="space-y-4">
        <div className="flex justify-between items-end">
               <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">04. 参赛队伍</h3>
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
      ) : (
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">04. 参赛选手</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-2">
              {allPlayers.map(p => (
                  <div key={p.id} onClick={()=>togglePlayer(p.id)} className={`cursor-pointer px-3 py-2 border text-xs font-bold truncate transition-all ${selectedPlayers.includes(p.id)?'bg-white text-black border-white':'border-neutral-800 bg-[#0a0a0a] text-neutral-400 hover:border-neutral-600'}`}>
                      {selectedPlayers.includes(p.id) ? '● ' : ''} {p.username || `用户_${p.id.substring(0, 8)}`}
                      <span className="block text-[10px] text-neutral-500 mt-0.5">Lv.{p.level} {p.tier}</span>
                  </div>
              ))}
          </div>
          {allPlayers.length === 0 && (
            <div className="text-center py-8 text-neutral-500 text-sm">
              暂无选手，请先在用户管理中创建选手档案
            </div>
          )}
        </section>
      )}

      <button 
        onClick={handleGenerate} 
        disabled={loading || (tournamentType === 'team' ? selectedTeams.length < 2 : selectedPlayers.length < 2)} 
        className="w-full bg-white text-black font-bold py-4 hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
          {loading ? 'GENERATING...' : '创建赛事'}
      </button>
    </div>
  )
}