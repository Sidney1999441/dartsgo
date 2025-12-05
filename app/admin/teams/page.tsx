'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([]) // 所有候选用户
  
  // 新建/编辑状态
  const [isCreating, setIsCreating] = useState(false)
  const [teamForm, setTeamForm] = useState({ name: '', logo_url: '' })

  useEffect(() => {
    fetchTeams()
    fetchAllUsers()
  }, [])

  // 1. 获取队伍列表
  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('id')
    if (data) setTeams(data)
  }

  // 2. 获取所有注册用户（用于拉人入队）
  const fetchAllUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, username, email')
    if (data) setAllUsers(data)
  }

  // 3. 选中某个队伍时，获取它的队员
  const handleSelectTeam = async (team: any) => {
    setSelectedTeam(team)
    setIsCreating(false)
    setTeamForm({ name: team.name, logo_url: team.logo_url || '' })
    
    // 查队员
    const { data } = await supabase
      .from('team_members')
      .select('id, profiles(id, username, email, avatar_url)')
      .eq('team_id', team.id)
    
    if (data) setMembers(data.map((m: any) => ({ ...m.profiles, membership_id: m.id })))
  }

  // 保存队伍信息 (新建或更新)
  const handleSaveTeam = async () => {
    if (!teamForm.name) return alert('队名不能为空')

    if (isCreating) {
        // 新建
        const { error } = await supabase.from('teams').insert(teamForm)
        if (!error) {
            alert('创建成功')
            fetchTeams()
            setIsCreating(false)
        }
    } else {
        // 更新
        const { error } = await supabase.from('teams').update(teamForm).eq('id', selectedTeam.id)
        if (!error) {
            alert('更新成功')
            fetchTeams()
        }
    }
  }

  // 删除队伍
  const handleDeleteTeam = async (id: number) => {
    if (!confirm('确定删除该战队吗？这将同时解散所有队员关联。')) return
    // 先删队员关联
    await supabase.from('team_members').delete().eq('team_id', id)
    // 再删比赛关联 (为了安全，这里暂时不写删比赛逻辑，如果有比赛关联会报错)
    const { error } = await supabase.from('teams').delete().eq('id', id)
    
    if (error) alert('删除失败：该队伍可能有比赛记录，请先删除相关赛程。')
    else {
        setSelectedTeam(null)
        fetchTeams()
    }
  }

  // 添加队员
  const handleAddMember = async (userId: string) => {
    if (!selectedTeam) return
    // 检查是否已经在队里
    if (members.find(m => m.id === userId)) return alert('该选手已在队中')

    const { error } = await supabase.from('team_members').insert({
        team_id: selectedTeam.id,
        user_id: userId
    })
    
    if (!error) handleSelectTeam(selectedTeam) // 刷新队员列表
  }

  // 踢出队员
  const handleRemoveMember = async (membershipId: number) => {
    if (!confirm('确定移除该队员吗？')) return
    const { error } = await supabase.from('team_members').delete().eq('id', membershipId) // 注意这里删的是关联表ID
    if (!error) handleSelectTeam(selectedTeam)
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] gap-6 text-white">
      
      {/* 左侧：队伍列表 */}
      <div className="w-full md:w-1/3 bg-slate-800 rounded-xl border border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h2 className="font-bold">战队列表 ({teams.length})</h2>
            <button 
                onClick={() => { setIsCreating(true); setSelectedTeam(null); setTeamForm({name:'', logo_url:''}) }}
                className="bg-green-600 hover:bg-green-500 text-xs px-3 py-1.5 rounded font-bold"
            >
                + 新建战队
            </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {teams.map(team => (
                <div 
                    key={team.id}
                    onClick={() => handleSelectTeam(team)}
                    className={`p-3 rounded cursor-pointer flex items-center gap-3 transition ${selectedTeam?.id === team.id ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
                >
                    <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center overflow-hidden">
                        {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover"/> : team.name[0]}
                    </div>
                    <span className="font-bold">{team.name}</span>
                </div>
            ))}
        </div>
      </div>

      {/* 右侧：编辑区域 */}
      <div className="w-full md:w-2/3 bg-slate-800 rounded-xl border border-slate-700 p-6 overflow-y-auto">
        {(selectedTeam || isCreating) ? (
            <div className="space-y-8">
                {/* 1. 基本信息 */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold border-b border-slate-700 pb-2">
                        {isCreating ? '新建战队' : '编辑战队信息'}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-400">战队名称</label>
                            <input 
                                value={teamForm.name}
                                onChange={e => setTeamForm({...teamForm, name: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-600 p-2 rounded mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400">Logo 图片链接 (URL)</label>
                            <input 
                                value={teamForm.logo_url}
                                onChange={e => setTeamForm({...teamForm, logo_url: e.target.value})}
                                placeholder="https://..."
                                className="w-full bg-slate-900 border border-slate-600 p-2 rounded mt-1"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleSaveTeam} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold">
                            {isCreating ? '立即创建' : '保存修改'}
                        </button>
                        {!isCreating && (
                            <button onClick={() => handleDeleteTeam(selectedTeam.id)} className="bg-red-900/50 text-red-400 hover:bg-red-900 border border-red-800 px-4 py-2 rounded text-sm">
                                删除战队
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. 队员管理 (仅在编辑模式显示) */}
                {!isCreating && (
                    <div className="space-y-4">
                         <h3 className="text-xl font-bold border-b border-slate-700 pb-2 flex justify-between items-center">
                            <span>现有队员 ({members.length})</span>
                         </h3>
                         
                         {/* 添加队员搜索框 */}
                         <div className="bg-slate-900 p-3 rounded border border-slate-600">
                            <label className="text-xs text-slate-400 mb-2 block">添加新队员 (从所有用户中选择)</label>
                            <select 
                                className="w-full bg-slate-800 p-2 rounded"
                                onChange={(e) => {
                                    if(e.target.value) handleAddMember(e.target.value);
                                    e.target.value = ''; // 选中后重置
                                }}
                            >
                                <option value="">-- 点击选择用户加入该队 --</option>
                                {allUsers.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.username || u.email} (ID: {u.id.substring(0,4)})
                                    </option>
                                ))}
                            </select>
                         </div>

                         {/* 队员列表 */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {members.map(m => (
                                <div key={m.id} className="bg-slate-700/50 p-3 rounded flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-600 overflow-hidden">
                                            {m.avatar_url ? <img src={m.avatar_url} /> : <div className="p-1 text-xs text-center">{m.username?.[0]}</div>}
                                        </div>
                                        <span>{m.username || '未命名'}</span>
                                    </div>
                                    <button onClick={() => handleRemoveMember(m.membership_id)} className="text-red-400 text-xs hover:underline">
                                        移除
                                    </button>
                                </div>
                            ))}
                            {members.length === 0 && <div className="text-slate-500 text-sm">暂无队员</div>}
                         </div>
                    </div>
                )}
            </div>
        ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
                请在左侧选择一个战队进行管理
            </div>
        )}
      </div>
    </div>
  )
}