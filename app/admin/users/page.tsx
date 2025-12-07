'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'with_profile' | 'without_profile'>('all')

  useEffect(() => {
    fetchUsers()
  }, [])

  // 获取所有注册用户（从 Authentication）
  const fetchUsers = async () => {
    setLoading(true)
    try {
      // 通过 API 路由获取所有 auth 用户
      const response = await fetch('/api/admin/users')
      
      // 检查响应类型
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        // 如果返回的不是 JSON，可能是错误页面
        const text = await response.text()
        console.error('API 返回非 JSON 响应:', text.substring(0, 200))
        throw new Error('API 返回格式错误，请检查服务端配置')
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '获取用户列表失败')
      }

      if (result.users) {
        setUsers(result.users)
      } else {
        setUsers([])
      }
      setLoading(false)
    } catch (error: any) {
      console.error('获取用户列表失败:', error)
      
      // 回退方案：直接从 profiles 获取
      try {
        console.log('尝试从 profiles 获取用户列表...')
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (profilesError) {
          throw profilesError
        }

        const users = (profiles || []).map((profile: any) => ({
          id: profile.id,
          email: null,
          created_at: profile.created_at || null,
          last_sign_in_at: null,
          username: profile.username || null,
          is_admin: profile.is_admin || false,
          level: profile.level || null,
          tier: profile.tier || null,
          has_profile: true
        }))

        setUsers(users)
        setLoading(false)
      } catch (fallbackError: any) {
        console.error('回退方案也失败:', fallbackError)
        alert('获取用户列表失败: ' + (error.message || '未知错误') + '\n请检查环境变量配置')
        setUsers([])
        setLoading(false)
      }
    }
  }

  // 将用户转换为选手（创建 profile）
  const handleCreateProfile = async (userId: string) => {
    if (!confirm('确定要将该用户转换为选手吗？')) return

    try {
      const response = await fetch('/api/admin/users/create-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          username: `用户_${userId.substring(0, 8)}`
        })
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.error?.includes('duplicate') || result.error?.includes('23505')) {
          alert('该用户已经是选手了')
        } else {
          alert('创建失败: ' + (result.error || '未知错误'))
        }
        return
      }

      alert('已成功转换为选手')
      fetchUsers()
    } catch (error: any) {
      console.error('创建 profile 失败:', error)
      alert('创建失败: ' + (error.message || '未知错误'))
    }
  }

  // 设置/取消管理员
  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? '取消' : '设置'
    if (!confirm(`确定要${action}该用户的管理员权限吗？`)) return

    try {
      const response = await fetch('/api/admin/users/toggle-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          isAdmin: !currentStatus
        })
      })

      const result = await response.json()

      if (!response.ok) {
        alert('操作失败: ' + (result.error || '未知错误'))
        return
      }

      alert(`${action}管理员权限成功`)
      fetchUsers()
    } catch (error: any) {
      console.error('修改管理员权限失败:', error)
      alert('操作失败: ' + (error.message || '未知错误'))
    }
  }

  // 过滤用户
  const filteredUsers = users.filter(user => {
    if (filter === 'all') return true
    if (filter === 'with_profile') return user.has_profile
    if (filter === 'without_profile') return !user.has_profile
    return true
  })

  if (loading) {
    return <div className="text-white p-8">正在加载用户列表...</div>
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex justify-between items-center border-b border-slate-700 pb-4">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600' : 'bg-slate-700'}`}
          >
            全部
          </button>
          <button
            onClick={() => setFilter('with_profile')}
            className={`px-4 py-2 rounded ${filter === 'with_profile' ? 'bg-blue-600' : 'bg-slate-700'}`}
          >
            已转选手
          </button>
          <button
            onClick={() => setFilter('without_profile')}
            className={`px-4 py-2 rounded ${filter === 'without_profile' ? 'bg-blue-600' : 'bg-slate-700'}`}
          >
            未转选手
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 border-b border-slate-700">
            <tr>
              <th className="text-left p-4 text-sm font-bold text-slate-300">用户信息</th>
              <th className="text-left p-4 text-sm font-bold text-slate-300">用户名</th>
              <th className="text-left p-4 text-sm font-bold text-slate-300">等级</th>
              <th className="text-left p-4 text-sm font-bold text-slate-300">状态</th>
              <th className="text-left p-4 text-sm font-bold text-slate-300">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  暂无用户
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isPlayer = user.has_profile
                const isAdmin = user.is_admin
                
                return (
                  <tr key={user.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-4">
                      <div className="font-mono text-xs text-slate-400">
                        {user.id.substring(0, 8)}...
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {user.email}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white">
                        {user.username || <span className="text-slate-500 italic">未命名</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      {user.level ? (
                        <span className="px-2 py-1 bg-slate-700 rounded text-sm">
                          Lv.{user.level} {user.tier || 'C'}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 flex-wrap">
                        {isPlayer && (
                          <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs border border-green-600/30">
                            选手
                          </span>
                        )}
                        {isAdmin && (
                          <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded text-xs border border-yellow-600/30">
                            管理员
                          </span>
                        )}
                        {!isPlayer && !isAdmin && (
                          <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs">
                            普通用户
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 flex-wrap">
                        {!isPlayer && (
                          <button
                            onClick={() => handleCreateProfile(user.id)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs font-bold"
                          >
                            转为选手
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleAdmin(user.id, isAdmin)}
                          className={`px-3 py-1 rounded text-xs font-bold ${
                            isAdmin
                              ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30'
                              : 'bg-blue-600 hover:bg-blue-500'
                          }`}
                        >
                          {isAdmin ? '取消管理员' : '设为管理员'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-slate-500">
        共 {filteredUsers.length} 个用户（总计 {users.length} 个）
      </div>
    </div>
  )
}

