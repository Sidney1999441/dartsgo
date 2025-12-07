'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([]) // 所有候选用户
  const [loading, setLoading] = useState(false)
  
  // 新建/编辑状态
  const [isCreating, setIsCreating] = useState(false)
  const [teamForm, setTeamForm] = useState({ name: '', logo_url: '' })

  useEffect(() => {
    fetchTeams()
    fetchAllUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 1. 获取队伍列表（包含队长信息）
  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('id')
    if (data) setTeams(data)
  }

  // 2. 获取所有注册用户（用于拉人入队）
  // 优化：使用 useCallback 避免重复创建函数，减少不必要的重新渲染
  const fetchAllUsers = useCallback(async () => {
    try {
      // 先尝试通过 API 获取所有 auth 用户（包括没有 profile 的）
      try {
        const response = await fetch('/api/admin/users')
        if (response.ok) {
          const result = await response.json()
          if (result.users) {
            // 获取所有已有战队的用户ID（优化：只查询一次）
            const { data: teamMembers } = await supabase
              .from('team_members')
              .select('user_id')
            
            const usersInTeams = new Set(teamMembers?.map((tm: any) => tm.user_id) || [])
            
            // 过滤出无战队的用户，并格式化数据
            const usersWithoutTeam = result.users
              .filter((user: any) => !usersInTeams.has(user.id))
              .map((user: any) => ({
                id: user.id,
                username: user.username, // 确保使用 username（昵称）
                email: user.email,
                avatar_url: null
              }))
            
            // 批量获取 avatar_url（优化：只在有用户时查询）
            if (usersWithoutTeam.length > 0) {
              const userIds = usersWithoutTeam.map((u: any) => u.id)
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, avatar_url')
                .in('id', userIds)
              
              if (profiles) {
                const avatarMap = new Map(profiles.map((p: any) => [p.id, p.avatar_url]))
                usersWithoutTeam.forEach((user: any) => {
                  user.avatar_url = avatarMap.get(user.id) || null
                })
              }
            }
            
            setAllUsers(usersWithoutTeam)
            return
          }
        }
      } catch (apiError) {
        console.warn('API 获取用户失败，回退到 profiles 查询:', apiError)
      }
      
      // 回退方案：从 profiles 获取（只包括已有 profile 的用户，注意：profiles 表中没有 email 字段）
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
      
      if (profilesError) {
        console.error('获取用户列表失败:', profilesError)
        setAllUsers([])
        return
      }
      
      if (!allProfiles || allProfiles.length === 0) {
        setAllUsers([])
        return
      }
      
      // 获取所有已有战队的用户ID
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id')
      
      const usersInTeams = new Set(teamMembers?.map((tm: any) => tm.user_id) || [])
      
      // 过滤出无战队的用户
      const usersWithoutTeam = allProfiles.filter((user: any) => !usersInTeams.has(user.id))
      
      setAllUsers(usersWithoutTeam)
    } catch (err) {
      console.error('获取无战队用户时发生异常:', err)
      setAllUsers([])
    }
  }, [])

  // 3. 选中某个队伍时，获取它的队员
  // 优化：使用 useCallback 并减少不必要的 fetchAllUsers 调用
  const handleSelectTeam = useCallback(async (team: any) => {
    setSelectedTeam(team)
    setIsCreating(false)
    setTeamForm({ name: team.name, logo_url: team.logo_url || '' })
    setLoading(true)
    
    try {
      // 第一步：获取队员列表
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('id, user_id')
        .eq('team_id', team.id)
      
      if (membersError) {
        console.error('获取队员列表失败:', membersError)
        setMembers([])
        setLoading(false)
        return
      }
      
      if (!membersData || membersData.length === 0) {
        setMembers([])
        setLoading(false)
        return
      }
      
      // 第二步：批量获取所有队员的 profiles 信息（使用服务端 API 绕过 RLS）
      const userIds = membersData.map((m: any) => m.user_id)
      console.log('前端: 查询的 userIds:', userIds)
      
      // 尝试使用服务端 API 获取 profiles（绕过 RLS）
      let profilesData: any[] = []
      try {
        const response = await fetch('/api/admin/teams/members', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userIds })
        })
        
        if (response.ok) {
          const result = await response.json()
          profilesData = result.profiles || []
          console.log('前端: 通过 API 获取到 profiles:', JSON.stringify(profilesData, null, 2))
        } else {
          const errorText = await response.text()
          console.warn('前端: API 获取失败，状态:', response.status, '错误:', errorText)
          // 回退到客户端查询（注意：profiles 表中没有 email 字段）
          const { data: clientProfiles, error: clientError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds)
          console.log('前端: 客户端查询结果:', clientProfiles, '错误:', clientError)
          profilesData = clientProfiles || []
        }
      } catch (apiError) {
        console.warn('前端: API 调用异常:', apiError)
        // 回退到客户端查询
        const { data: clientProfiles, error: clientError } = await supabase
          .from('profiles')
          .select('id, username, email, avatar_url')
          .in('id', userIds)
        console.log('前端: 客户端查询结果:', clientProfiles, '错误:', clientError)
        profilesData = clientProfiles || []
      }
      
      // 创建 profiles 映射表（使用 user_id 作为 key）
      const profilesMap = new Map<string, any>()
      if (profilesData && profilesData.length > 0) {
        profilesData.forEach((p: any) => {
          profilesMap.set(p.id, p)
          console.log(`前端: 映射 profile ${p.id} -> username: "${p.username}"`)
        })
      } else {
        console.warn('前端: 未获取到任何 profiles 数据')
      }
      
      // 第三步：组合数据，确保显示 username（昵称）
      const membersWithProfiles = membersData.map((m: any) => {
        const profile = profilesMap.get(m.user_id) || {}
        console.log(`前端: 队员 ${m.user_id} 的 profile:`, profile, 'username:', profile.username)
        
        // 优先显示 username（昵称），如果没有则显示 user_id
        // 注意：如果 username 是 null 或空字符串，也应该使用 fallback
        const displayName = (profile.username && profile.username.trim()) 
          ? profile.username.trim() 
          : `用户_${m.user_id.substring(0, 8)}`
        
        console.log(`前端: 队员 ${m.user_id} 最终显示名称: "${displayName}"`)
        
        return {
          id: m.user_id,
          username: displayName, // 确保使用 username（昵称）
          avatar_url: profile.avatar_url || null,
          membership_id: m.id,
          user_id: m.user_id,
          is_captain: team.captain_id === m.user_id
        }
      })
      
      console.log('前端: 最终组合的队员数据:', JSON.stringify(membersWithProfiles, null, 2))
      setMembers(membersWithProfiles)
    } catch (err: any) {
      console.error('获取队员时发生异常:', err)
      setMembers([])
    } finally {
      setLoading(false)
    }
    
    // 优化：只在需要时刷新无战队用户列表（例如添加/移除队员后）
    // 这里不自动刷新，减少不必要的查询
  }, [])

  // 保存队伍信息 (新建或更新)
  const handleSaveTeam = async () => {
    if (!teamForm.name.trim()) {
      alert('队名不能为空')
      return
    }

    if (isCreating) {
        // 新建
        const { error } = await supabase.from('teams').insert(teamForm)
        if (error) {
          alert('创建失败: ' + error.message)
        } else {
            alert('创建成功')
            await fetchTeams()
            setIsCreating(false)
            setTeamForm({ name: '', logo_url: '' })
            // 刷新无战队用户列表（虽然新建战队时还没有队员，但保持数据同步）
            fetchAllUsers()
        }
    } else {
        // 更新
        const { error } = await supabase.from('teams').update(teamForm).eq('id', selectedTeam.id)
        if (error) {
          alert('更新失败: ' + error.message)
        } else {
            alert('更新成功')
            await fetchTeams()
            // 如果选中了该战队，更新本地状态（优化：避免重新查询）
            if (selectedTeam) {
              const updatedTeam = { ...selectedTeam, ...teamForm }
              setSelectedTeam(updatedTeam)
              // 只更新表单，不重新查询队员
            }
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
    
    if (error) {
      alert('删除失败：该队伍可能有比赛记录，请先删除相关赛程。')
    } else {
        setSelectedTeam(null)
        await fetchTeams()
        // 刷新无战队用户列表（因为删除战队后，原队员变成无战队状态）
        fetchAllUsers()
    }
  }

  // 添加队员（优化：减少不必要的刷新）
  const handleAddMember = async (userId: string) => {
    if (!selectedTeam) return
    // 检查是否已经在队里
    if (members.find(m => m.id === userId || m.user_id === userId)) {
      alert('该选手已在队中')
      return
    }

    const { error } = await supabase.from('team_members').insert({
        team_id: selectedTeam.id,
        user_id: userId
    })
    
    if (error) {
      alert('添加失败: ' + error.message)
    } else {
      // 刷新队员列表和无战队用户列表
      await handleSelectTeam(selectedTeam)
      // 延迟刷新无战队用户列表，避免阻塞 UI
      setTimeout(() => fetchAllUsers(), 100)
    }
  }

  // 踢出队员（优化：减少不必要的刷新）
  const handleRemoveMember = async (membershipId: number, userId: string) => {
    if (!confirm('确定移除该队员吗？')) return
    
    // 如果移除的是队长，需要清除队长设置
    if (selectedTeam?.captain_id === userId) {
      const { error: updateError } = await supabase
        .from('teams')
        .update({ captain_id: null })
        .eq('id', selectedTeam.id)
      
      if (updateError) {
        alert('移除队长设置失败: ' + updateError.message)
        return
      }
      // 更新本地状态
      setSelectedTeam({ ...selectedTeam, captain_id: null })
    }
    
    const { error } = await supabase.from('team_members').delete().eq('id', membershipId)
    if (error) {
      alert('移除失败: ' + error.message)
    } else {
      await handleSelectTeam(selectedTeam)
      // 延迟刷新无战队用户列表
      setTimeout(() => fetchAllUsers(), 100)
    }
  }

  // 设置队长（优化：减少不必要的刷新）
  const handleSetCaptain = async (userId: string) => {
    if (!selectedTeam) return
    
    // 检查该用户是否在队伍中
    if (!members.find(m => m.id === userId || m.user_id === userId)) {
      alert('该用户不在当前队伍中')
      return
    }
    
    const { error } = await supabase
      .from('teams')
      .update({ captain_id: userId })
      .eq('id', selectedTeam.id)
    
    if (error) {
      alert('设置队长失败: ' + error.message)
    } else {
      alert('队长设置成功')
      // 更新本地状态，避免重新查询
      const updatedTeam = { ...selectedTeam, captain_id: userId }
      setSelectedTeam(updatedTeam)
      // 更新队员列表中的队长标识
      setMembers(members.map(m => ({
        ...m,
        is_captain: m.id === userId || m.user_id === userId
      })))
    }
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
                    className={`p-3 rounded cursor-pointer flex items-center justify-between transition ${selectedTeam?.id === team.id ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
                >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
                            {team.logo_url ? (
                                <img src={team.logo_url} className="w-full h-full object-cover" alt={team.name} />
                            ) : (
                                <span className="text-xs font-bold">{team.name?.[0] || '?'}</span>
                            )}
                        </div>
                        <span className="font-bold truncate">{team.name}</span>
                    </div>
                    {team.captain_id && (
                        <span className="text-[10px] text-yellow-400 font-bold shrink-0 ml-2">👑</span>
                    )}
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
                            {loading && <span className="text-xs text-slate-500">加载中...</span>}
                         </h3>
                         
                         {/* 添加队员搜索框 */}
                         <div className="bg-slate-900 p-3 rounded border border-slate-600">
                            <label className="text-xs text-slate-400 mb-2 block">
                              添加新队员 (无战队用户: {allUsers.length} 人)
                            </label>
                            {allUsers.length === 0 ? (
                              <div className="text-slate-500 text-sm py-2">所有用户都已加入战队</div>
                            ) : (
                              <select 
                                  className="w-full bg-slate-800 p-2 rounded text-white"
                                  onChange={(e) => {
                                      if(e.target.value) handleAddMember(e.target.value);
                                      e.target.value = ''; // 选中后重置
                                  }}
                              >
                                  <option value="">-- 点击选择无战队用户加入该队 --</option>
                                  {allUsers.map(u => {
                                    const displayName = u.username || `用户_${u.id.substring(0, 8)}`
                                    // 如果有 email 则显示，否则显示用户ID
                                    const identifier = u.email ? u.email.split('@')[0] : u.id.substring(0, 8)
                                    return (
                                      <option key={u.id} value={u.id}>
                                        {displayName} ({identifier})
                                      </option>
                                    )
                                  })}
                              </select>
                            )}
                         </div>

                         {/* 队员列表 */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {members.map(m => {
                              // 确保使用正确的 ID（user_id 作为唯一标识）
                              const memberId = m.user_id || m.id
                              return (
                                <div key={memberId} className={`bg-slate-700/50 p-3 rounded border ${m.is_captain ? 'border-yellow-500/50 bg-yellow-900/10' : 'border-slate-600'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-slate-600 overflow-hidden border-2 border-slate-500 shrink-0">
                                                {m.avatar_url ? (
                                                    <img src={m.avatar_url} className="w-full h-full object-cover" alt={m.username || '用户'} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-300">
                                                        {(m.username || '?')[0].toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-white truncate">{m.username || '未命名用户'}</span>
                                                    {m.is_captain && (
                                                        <span className="px-2 py-0.5 bg-yellow-500 text-black text-[10px] font-black uppercase rounded shrink-0">
                                                            队长
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400 truncate">
                                                  ID: {memberId.substring(0, 8)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2 shrink-0">
                                            {!m.is_captain && (
                                                <button 
                                                    onClick={() => handleSetCaptain(memberId)} 
                                                    className="text-yellow-400 text-xs hover:text-yellow-300 hover:underline whitespace-nowrap"
                                                    title="设为队长"
                                                >
                                                    设队长
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleRemoveMember(m.membership_id, memberId)} 
                                                className="text-red-400 text-xs hover:text-red-300 hover:underline whitespace-nowrap"
                                            >
                                                移除
                                            </button>
                                        </div>
                                    </div>
                                </div>
                              )
                            })}
                            {members.length === 0 && (
                                <div className="text-slate-500 text-sm col-span-2 text-center py-4">
                                    暂无队员，请从上方选择用户添加
                                </div>
                            )}
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