'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [myTeam, setMyTeam] = useState<any>(null)
  const [myTournaments, setMyTournaments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // 编辑弹窗状态
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ username: '', avatar_url: '' })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setUser(user)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      setEditForm({ username: p?.username || '', avatar_url: p?.avatar_url || '' })

      const { data: m } = await supabase.from('team_members').select('team_id, teams(*)').eq('user_id', user.id).single()
      if (m?.teams) setMyTeam(m.teams)

      const { data: matches } = await supabase
        .from('matches')
        .select(`tournament_id, tournaments (id, name, status, format)`)
        .or(`home_team_id.eq.${m?.team_id},away_team_id.eq.${m?.team_id}`)
        .order('id', { ascending: false })

      if (matches) {
        const uniqueTournaments = new Map()
        matches.forEach((m: any) => {
            if (m.tournaments && !uniqueTournaments.has(m.tournaments.id)) {
                uniqueTournaments.set(m.tournaments.id, m.tournaments)
            }
        })
        setMyTournaments(Array.from(uniqueTournaments.values()))
      }
      setLoading(false)
    }
    init()
  }, [router])

  const handleSaveProfile = async () => {
    if (!user) return
    const { error } = await supabase.from('profiles').update({
        username: editForm.username,
        avatar_url: editForm.avatar_url
    }).eq('id', user.id)

    if (error) alert('保存失败: ' + error.message)
    else {
        alert('个人资料已更新')
        setIsEditOpen(false)
        setProfile({ ...profile, ...editForm })
    }
  }

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-neutral-500">正在加载数据...</div>

  // === UI 组件: 段位铭牌 (汉化版) ===
  const LevelBadge = ({ level, tier }: { level: number, tier: string }) => {
    let colorClass = "from-neutral-700 to-neutral-900 border-neutral-700 text-neutral-400"
    let glowClass = "bg-neutral-500/10"
    
    if (['S', 'SS', 'SSS'].includes(tier)) {
        colorClass = "from-yellow-900/80 to-neutral-900 border-yellow-600/50 text-yellow-500"
        glowClass = "bg-yellow-500/20"
    } else if (['A', 'AA'].includes(tier)) {
        colorClass = "from-blue-900/80 to-neutral-900 border-blue-500/50 text-blue-400"
        glowClass = "bg-blue-500/20"
    } else if (['B', 'BB'].includes(tier)) {
        colorClass = "from-orange-900/80 to-neutral-900 border-orange-600/50 text-orange-400"
        glowClass = "bg-orange-500/20"
    }

    return (
        <div className={`relative w-28 h-32 rounded-xl border ${colorClass.split(' ')[2]} bg-gradient-to-b ${colorClass.split(' ')[0]} ${colorClass.split(' ')[1]} flex flex-col items-center justify-center shadow-2xl overflow-hidden group`}>
             <div className={`absolute top-0 inset-x-0 h-1/2 ${glowClass} blur-xl`}></div>
             
             {/* 上半部分：Tier (段位) */}
             <div className="flex-1 flex flex-col items-center justify-center z-10 pt-2">
                 <div className="text-[10px] font-bold tracking-[0.2em] opacity-60 uppercase">段位</div>
                 <div className={`text-5xl font-black italic tracking-tighter ${colorClass.split(' ')[3]} drop-shadow-lg scale-110 group-hover:scale-125 transition-transform duration-500`}>
                     {tier}
                 </div>
             </div>
             
             {/* 下半部分：Level (等级) */}
             <div className="w-full bg-black/40 backdrop-blur-sm py-1.5 text-center border-t border-white/5 z-10">
                 <div className="text-xs font-mono font-bold text-white tracking-widest">
                     LV.<span className="text-lg">{level}</span>
                 </div>
             </div>
        </div>
    )
  }

  // === UI 组件: 战队通行证 (汉化版) ===
  const TeamPass = ({ team }: { team: any }) => {
    if (!team) return (
        <div className="flex items-center justify-between bg-neutral-900/50 border border-dashed border-neutral-700 rounded-lg p-3 hover:bg-neutral-800 transition-colors group cursor-pointer">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-white transition-colors">
                    +
                </div>
                <div className="text-sm text-neutral-500 group-hover:text-neutral-300">
                    暂无战队
                </div>
            </div>
            <div className="text-xs text-neutral-600 px-3 py-1 rounded border border-neutral-800">
                自由人
            </div>
        </div>
    )

    return (
        <Link href={`/teams/${team.id}`} className="block group">
            <div className="relative overflow-hidden bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex items-center justify-between hover:border-neutral-600 transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/10">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                
                <div className="flex items-center gap-4 pl-2">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0">
                         {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold">{team.name[0]}</div>}
                    </div>
                    <div>
                        <div className="text-xs text-neutral-500 font-bold uppercase tracking-wider mb-0.5">我的战队</div>
                        <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{team.name}</div>
                    </div>
                </div>

                <div className="pr-2 text-neutral-600 group-hover:text-white group-hover:translate-x-1 transition-all">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                </div>
            </div>
        </Link>
    )
  }

  // === UI 组件: 数据方块 ===
  const StatBox = ({ label, value, color = "text-white", sub }: any) => (
    <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 flex flex-col items-center justify-center relative overflow-hidden group hover:border-neutral-700 hover:bg-neutral-900 transition-all duration-300">
        <div className="text-[10px] text-neutral-500 font-bold mb-1 z-10 uppercase tracking-wider group-hover:text-neutral-400">{label}</div>
        <div className={`text-2xl font-black font-mono ${color} z-10 group-hover:scale-110 transition-transform`}>{value || 0}</div>
        {sub && <div className="text-[10px] text-neutral-600 mt-1 z-10">{sub}</div>}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 pb-20 animate-in fade-in">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* === 1. 头部区域 === */}
        <div className="relative">
            <div className="bg-[#0f0f0f] rounded-3xl border border-neutral-800 p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-8 shadow-2xl relative overflow-hidden">
                {/* 背景装饰光 */}
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

                {/* 头像 */}
                <div className="relative group shrink-0">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-[#1a1a1a] overflow-hidden shadow-lg bg-neutral-800">
                         {profile?.avatar_url ? (
                             <img src={profile.avatar_url} className="w-full h-full object-cover"/>
                         ) : (
                             <div className="w-full h-full flex items-center justify-center text-4xl text-neutral-600 font-black">{profile?.username?.[0] || 'P'}</div>
                         )}
                    </div>
                    <button onClick={() => setIsEditOpen(true)} className="absolute bottom-0 right-0 bg-white text-black p-1.5 rounded-full border-4 border-[#0f0f0f] hover:bg-neutral-200 transition-colors shadow-lg" title="修改头像">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                </div>

                {/* 个人信息中心 */}
                <div className="flex-1 flex flex-col items-center md:items-start gap-4 w-full">
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-1">{profile?.username || '未命名选手'}</h1>
                        <div className="flex items-center justify-center md:justify-start gap-2">
                             <span className="font-mono text-xs text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                                 UID: {user?.id.slice(0,8).toUpperCase()}
                             </span>
                        </div>
                    </div>

                    {/* 战队通行证 */}
                    <div className="w-full md:w-auto md:min-w-[240px]">
                        <TeamPass team={myTeam} />
                    </div>
                </div>

                {/* 右侧：段位铭牌 */}
                <div className="shrink-0 mt-2 md:mt-0">
                    <LevelBadge level={profile?.level || 1} tier={profile?.tier || 'C'} />
                </div>
            </div>
        </div>

        {/* === 2. 核心数据 === */}
        <div>
            <div className="flex items-center gap-2 mb-4 pl-1">
                <div className="w-1 h-4 bg-white rounded-full"></div>
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">综合能力数据</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
                <StatBox label="硬镖 PPD" value={profile?.ppd_steel} color="text-white" sub="分数/镖" />
                <StatBox label="软镖 PPD" value={profile?.ppd_soft} color="text-blue-400" sub="分数/镖" />
                <StatBox label="软镖 MPR" value={profile?.mpr_avg} color="text-green-400" sub="马克/轮" />
            </div>
        </div>

        {/* === 3. 生涯明细 === */}
        <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-2 border-l-2 border-orange-500">硬镖生涯 (Steel)</h3>
                <div className="grid grid-cols-2 gap-3">
                    <StatBox label="180 次数" value={profile?.total_180s} />
                    <StatBox label="140+ 次数" value={profile?.total_140s} />
                    <StatBox label="最高结镖" value={profile?.high_finish_steel} color="text-yellow-500"/>
                    <StatBox label="结镖率" value={`${profile?.checkout_rate || 0}%`} />
                </div>
            </div>
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-2 border-l-2 border-blue-500">软镖生涯 (Soft)</h3>
                <div className="grid grid-cols-2 gap-3">
                    <StatBox label="帽子戏法" value={profile?.total_hats} />
                    <StatBox label="白马" value={profile?.total_horses} />
                    <StatBox label="最高结镖" value={profile?.high_finish_soft} color="text-yellow-500"/>
                    <StatBox label="比赛场次" value={profile?.matches_played} />
                </div>
            </div>
        </div>

        {/* === 4. 参赛记录 === */}
        <div>
             <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4 pl-1 border-l-2 border-neutral-700">近期参赛记录</h3>
             {myTournaments.length > 0 ? (
                 <div className="grid gap-3">
                     {myTournaments.map(t => (
                         <div key={t.id} className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex justify-between items-center hover:border-neutral-600 transition-colors">
                             <div>
                                 <div className="text-white font-bold">{t.name}</div>
                                 <div className="text-[10px] text-neutral-500 mt-1 uppercase tracking-wider font-bold">
                                     {t.format === 'league' ? '循环赛' : t.format === 'knockout' ? '淘汰赛' : '双循环'}
                                 </div>
                             </div>
                             <div className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${t.status === 'ongoing' ? 'text-green-400 border-green-900 bg-green-900/10' : 'text-neutral-500 border-neutral-800'}`}>
                                 {t.status === 'ongoing' ? '进行中' : t.status === 'completed' ? '已结束' : '未开始'}
                             </div>
                         </div>
                     ))}
                 </div>
             ) : (
                 <div className="text-neutral-600 text-sm p-8 border border-dashed border-neutral-800 rounded-xl text-center flex flex-col items-center gap-2">
                     <span className="text-2xl opacity-50">📅</span>
                     <span>暂无参赛记录</span>
                 </div>
             )}
        </div>

        {/* 底部操作 */}
        <div className="text-center pt-8 border-t border-neutral-900">
            <button onClick={async()=>{await supabase.auth.signOut();router.push('/login')}} className="text-neutral-500 hover:text-red-400 text-xs font-bold uppercase tracking-widest transition-colors">
                退出登录
            </button>
        </div>
      </div>

      {/* === 编辑资料弹窗 === */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#0f0f0f] border border-neutral-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
                <button onClick={() => setIsEditOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">✕</button>
                <h3 className="text-xl font-black text-white mb-6">修改资料</h3>
                <div className="space-y-5">
                    <div>
                        <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">显示昵称</label>
                        <input 
                            value={editForm.username} 
                            onChange={e => setEditForm({...editForm, username: e.target.value})}
                            className="w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg mt-1 focus:border-white outline-none transition-colors"
                            placeholder="请输入新的昵称"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">头像链接</label>
                        <input 
                            value={editForm.avatar_url} 
                            onChange={e => setEditForm({...editForm, avatar_url: e.target.value})}
                            className="w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg mt-1 focus:border-white outline-none font-mono text-xs transition-colors"
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => setIsEditOpen(false)} className="bg-neutral-900 text-neutral-400 font-bold py-3 rounded-lg hover:bg-neutral-800 transition-colors">取消</button>
                    <button onClick={handleSaveProfile} className="bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 transition-colors">保存修改</button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}