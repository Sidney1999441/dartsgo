'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function TeamGeneratorPage() {
  const [users, setUsers] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [teamSize, setTeamSize] = useState(2) // 2人队 或 4人队
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
        const { data } = await supabase.from('profiles').select('*').order('level', { ascending: false })
        if (data) setUsers(data)
    }
    fetchUsers()
  }, [])

  const toggleUser = (id: string) => {
    if (selectedUsers.includes(id)) setSelectedUsers(selectedUsers.filter(u => u !== id))
    else setSelectedUsers([...selectedUsers, id])
  }

  // === 蛇形分组算法 (Snake Draft) ===
  // 能够保证每个队伍的总等级尽可能接近
  // 顺序：1, 4, 5, 8 (Team A) vs 2, 3, 6, 7 (Team B)
  const handleGenerateTeams = async () => {
    if (selectedUsers.length < teamSize) return alert('人数不足以组成一个队')
    if (selectedUsers.length % teamSize !== 0) return alert(`选中人数 (${selectedUsers.length}) 无法被 ${teamSize} 整除，请增减人数。`)

    setLoading(true)
    
    // 1. 获取选中用户对象并按等级排序
    const pool = users.filter(u => selectedUsers.includes(u.id)).sort((a, b) => b.level - a.level)
    
    // 2. 准备空队伍桶
    const numTeams = pool.length / teamSize
    const teamsBuckets: any[][] = Array.from({ length: numTeams }, () => [])

    // 3. 蛇形分发
    // 例如 2个队：
    // Round 1: User1 -> Team 0, User2 -> Team 1
    // Round 2: User3 -> Team 1, User4 -> Team 0
    pool.forEach((user, index) => {
        const round = Math.floor(index / numTeams)
        let teamIndex
        if (round % 2 === 0) {
            teamIndex = index % numTeams // 正序
        } else {
            teamIndex = numTeams - 1 - (index % numTeams) // 倒序
        }
        teamsBuckets[teamIndex].push(user)
    })

    try {
        // 4. 批量写入数据库
        for (let i = 0; i < teamsBuckets.length; i++) {
            const members = teamsBuckets[i]
            const avgLv = (members.reduce((sum, m) => sum + m.level, 0) / members.length).toFixed(0)
            const teamName = `随机战队 ${String.fromCharCode(65 + i)} (Lv.${avgLv})` // 队名：随机战队 A (Lv.20)

            // 建队
            const { data: team, error: tErr } = await supabase.from('teams').insert({ name: teamName }).select().single()
            if (tErr) throw tErr

            // 加人
            const membersPayload = members.map(m => ({ team_id: team.id, user_id: m.id }))
            await supabase.from('team_members').insert(membersPayload)
        }

        alert(`✅ 成功组建 ${numTeams} 支队伍！请前往“战队管理”查看。`)
        setSelectedUsers([]) // 清空选择

    } catch (e: any) {
        alert('出错: ' + e.message)
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="space-y-6 text-white max-w-5xl">
      <h1 className="text-2xl font-bold">🎲 随机组队生成器</h1>
      
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <div className="flex justify-between items-center mb-4">
            <div className="space-x-4">
                <label className="text-slate-400 text-sm">每队人数：</label>
                <button onClick={() => setTeamSize(2)} className={`px-3 py-1 rounded text-sm ${teamSize===2 ? 'bg-blue-600' : 'bg-slate-700'}`}>2人 (双打)</button>
                <button onClick={() => setTeamSize(4)} className={`px-3 py-1 rounded text-sm ${teamSize===4 ? 'bg-blue-600' : 'bg-slate-700'}`}>4人 (团体)</button>
            </div>
            <div className="text-sm">
                已选: <span className="text-yellow-400 font-bold text-lg">{selectedUsers.length}</span> 人 
                {selectedUsers.length > 0 && selectedUsers.length % teamSize !== 0 && (
                    <span className="text-red-400 ml-2">(还差 {teamSize - (selectedUsers.length % teamSize)} 人)</span>
                )}
            </div>
        </div>

        {/* 选人池 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto bg-slate-900 p-4 rounded border border-slate-600">
            {users.map(u => (
                <div 
                    key={u.id} 
                    onClick={() => toggleUser(u.id)}
                    className={`cursor-pointer p-2 rounded border flex items-center justify-between text-sm transition ${selectedUsers.includes(u.id) ? 'bg-green-600/30 border-green-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                >
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${selectedUsers.includes(u.id) ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                        <span className="truncate w-20">{u.username || '未命名'}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500">Lv.{u.level}</span>
                </div>
            ))}
        </div>

        <button 
            onClick={handleGenerateTeams}
            disabled={loading || selectedUsers.length === 0}
            className="w-full mt-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white font-bold py-3 rounded-lg shadow-lg disabled:opacity-50"
        >
            {loading ? '正在分配...' : '⚡️ 按等级均衡实力并生成队伍'}
        </button>
        <p className="text-center text-xs text-slate-500 mt-2">系统将使用蛇形排列算法 (Snake Draft) 确保各队总战力尽可能接近。</p>
      </div>
    </div>
  )
}