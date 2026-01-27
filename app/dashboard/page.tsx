'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [isCaptain, setIsCaptain] = useState(false)
  
  // 编辑弹窗状态
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ username: '', avatar_url: '' })
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  
  // 战队管理弹窗状态
  const [isTeamEditOpen, setIsTeamEditOpen] = useState(false)
  const [teamForm, setTeamForm] = useState({ name: '', logo_url: '' })
  const [uploadingTeamLogo, setUploadingTeamLogo] = useState(false)

  // 裁剪器状态
  const cropContainerSize = 360
  const cropperRef = useRef<HTMLDivElement>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [cropMode, setCropMode] = useState<'avatar' | 'team'>('avatar')
  const [cropImageUrl, setCropImageUrl] = useState('')
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [displayBox, setDisplayBox] = useState({ w: 0, h: 0, offsetX: 0, offsetY: 0 })
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, size: 200 })
  const [dragging, setDragging] = useState(false)
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 })

  // 打开裁剪器
  const openCropper = (file: File, mode: 'avatar' | 'team') => {
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件（JPG/PNG/WebP）')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB')
      return
    }

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const container = cropContainerSize
      let dw = container
      let dh = container
      if (img.width >= img.height) {
        dh = container * (img.height / img.width)
      } else {
        dw = container * (img.width / img.height)
      }
      const offsetX = (container - dw) / 2
      const offsetY = (container - dh) / 2
      const baseSize = Math.min(dw, dh) * 0.8
      const startX = offsetX + (dw - baseSize) / 2
      const startY = offsetY + (dh - baseSize) / 2

      // 清理旧 URL
      if (cropImageUrl) URL.revokeObjectURL(cropImageUrl)

      setNaturalSize({ w: img.width, h: img.height })
      setDisplayBox({ w: dw, h: dh, offsetX, offsetY })
      setCropBox({ x: startX, y: startY, size: baseSize })
      setCropFile(file)
      setCropImageUrl(url)
      setCropMode(mode)
      setIsCropping(true)
    }
    img.onerror = () => {
      alert('图片加载失败，请更换文件')
    }
    img.src = url
  }

  const closeCropper = () => {
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl)
    setIsCropping(false)
    setCropImageUrl('')
    setCropFile(null)
  }

  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCropping) return
    const rect = cropperRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setDragging(true)
    setDragDelta({ x: x - cropBox.x, y: y - cropBox.y })
  }

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return
    const rect = cropperRef.current?.getBoundingClientRect()
    if (!rect) return
    const rawX = e.clientX - rect.left - dragDelta.x
    const rawY = e.clientY - rect.top - dragDelta.y
    const minX = displayBox.offsetX
    const minY = displayBox.offsetY
    const maxX = displayBox.offsetX + displayBox.w - cropBox.size
    const maxY = displayBox.offsetY + displayBox.h - cropBox.size
    setCropBox(prev => ({
      ...prev,
      x: Math.min(Math.max(rawX, minX), maxX),
      y: Math.min(Math.max(rawY, minY), maxY)
    }))
  }

  const handleCropMouseUp = () => setDragging(false)

  const handleCropSizeChange = (val: number) => {
    const minDim = Math.min(displayBox.w, displayBox.h)
    const newSize = Math.max(40, minDim * val)
    const maxX = displayBox.offsetX + displayBox.w - newSize
    const maxY = displayBox.offsetY + displayBox.h - newSize
    setCropBox(prev => ({
      size: newSize,
      x: Math.min(Math.max(prev.x, displayBox.offsetX), maxX),
      y: Math.min(Math.max(prev.y, displayBox.offsetY), maxY)
    }))
  }

  const confirmCropAndUpload = () => {
    if (!cropFile || !cropImageUrl) return
    const img = new Image()
    img.onload = () => {
      const scale = displayBox.w > 0 ? (naturalSize.w / displayBox.w) : 1
      const sx = (cropBox.x - displayBox.offsetX) * scale
      const sy = (cropBox.y - displayBox.offsetY) * scale
      const sSize = cropBox.size * scale

      const canvas = document.createElement('canvas')
      canvas.width = sSize
      canvas.height = sSize
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        alert('浏览器不支持裁剪')
        return
      }
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, sSize, sSize)
      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('裁剪失败，请重试')
          return
        }
        if (cropMode === 'avatar') {
          await uploadAvatarFile(blob)
        } else {
          await uploadTeamLogoFile(blob)
        }
        closeCropper()
      }, 'image/png')
    }
    img.onerror = () => alert('裁剪失败，图片读取异常')
    img.src = cropImageUrl
  }

  const handleSelectAvatarFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) openCropper(file, 'avatar')
    event.target.value = ''
  }

  const handleSelectTeamLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!myTeam) {
      alert('请先选择战队')
      return
    }
    if (file) openCropper(file, 'team')
    event.target.value = ''
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setUser(user)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      setEditForm({ username: p?.username || '', avatar_url: p?.avatar_url || '' })

      const { data: m } = await supabase.from('team_members').select('team_id, teams(*)').eq('user_id', user.id).single()
      if (m?.teams) {
        // 处理 teams 可能是数组或对象的情况
        const team = Array.isArray(m.teams) ? m.teams[0] : m.teams
        if (team) {
          setMyTeam(team)
          // 检查是否是队长
          setIsCaptain(team.captain_id === user.id)
          setTeamForm({ name: team.name || '', logo_url: team.logo_url || '' })
        }
      }

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

  // 上传头像（接受已裁剪好的 Blob）
  const uploadAvatarFile = async (file: Blob) => {
    if (!user) {
      alert('请先登录后再上传头像')
      return
    }
    setUploadingAvatar(true)
    try {
      const fileName = `${user.id}-${Date.now()}.png`
      // 通过后端获取签名上传凭证（绕过 RLS）
      const signedRes = await fetch('/api/admin/storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'avatars', path: fileName })
      })
      if (!signedRes.ok) {
        const msg = await signedRes.text()
        throw new Error(`获取签名失败: ${msg}`)
      }
      const { token } = await signedRes.json()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .uploadToSignedUrl(fileName, token, file, { contentType: 'image/png', upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setEditForm({ ...editForm, avatar_url: data.publicUrl })
      alert('头像上传成功！请点击保存按钮保存更改。')
    } catch (error: any) {
      console.error('上传失败:', error)
      alert(`上传失败: ${error.message || '未知错误'}\n请确认文件小于 5MB，格式为 JPG/PNG/WebP`)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return
    
    const trimmedUsername = editForm.username.trim()
    
    // 验证用户名长度
    if (trimmedUsername && trimmedUsername.length < 3) {
      alert('用户名至少需要 3 个字符')
      return
    }
    
    if (trimmedUsername && trimmedUsername.length > 20) {
      alert('用户名不能超过 20 个字符')
      return
    }
    
    const { error } = await supabase.from('profiles').update({
        username: trimmedUsername || null,
        avatar_url: editForm.avatar_url
    }).eq('id', user.id)

    if (error) {
      if (error.message.includes('username_length')) {
        alert('用户名长度不符合要求（3-20 个字符）')
      } else {
        alert('保存失败: ' + error.message)
      }
    } else {
        alert('个人资料已更新')
        setIsEditOpen(false)
        setProfile({ ...profile, ...editForm, username: trimmedUsername })
    }
  }

  // 上传战队 LOGO（接受已裁剪好的 Blob）
  const uploadTeamLogoFile = async (file: Blob) => {
    if (!myTeam) {
      alert('请先选择战队')
      return
    }
    setUploadingTeamLogo(true)
    try {
      const fileName = `team-${myTeam.id}-${Date.now()}.png`
      const signedRes = await fetch('/api/admin/storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'team-logos', path: fileName })
      })
      if (!signedRes.ok) {
        const msg = await signedRes.text()
        throw new Error(`获取签名失败: ${msg}`)
      }
      const { token } = await signedRes.json()

      const { error: uploadError } = await supabase.storage
        .from('team-logos')
        .uploadToSignedUrl(fileName, token, file, { contentType: 'image/png', upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('team-logos').getPublicUrl(fileName)
      setTeamForm({ ...teamForm, logo_url: data.publicUrl })
      alert('战队 LOGO 上传成功！请点击保存按钮保存更改。')
    } catch (error: any) {
      console.error('上传失败:', error)
      alert(`上传失败: ${error.message || '未知错误'}\n请确认文件小于 5MB，格式为 JPG/PNG/WebP`)
    } finally {
      setUploadingTeamLogo(false)
    }
  }

  // 保存战队信息
  const handleSaveTeam = async () => {
    if (!myTeam || !isCaptain) return
    const { error } = await supabase.from('teams').update({
        name: teamForm.name,
        logo_url: teamForm.logo_url
    }).eq('id', myTeam.id)

    if (error) alert('保存失败: ' + error.message)
    else {
        alert('战队信息已更新')
        setIsTeamEditOpen(false)
        setMyTeam({ ...myTeam, ...teamForm })
    }
  }

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-neutral-500">正在加载数据...</div>

  // === UI 组件: 段位铭牌 (美化彩色版) ===
  const LevelBadge = ({ level, tier }: { level: number, tier: string }) => {
    // 根据段位设置不同的颜色方案
    let borderClass = "border-neutral-700"
    let bgGradient = "from-neutral-800 to-neutral-950"
    let textClass = "text-neutral-400"
    let glowClass = "bg-neutral-500/10"
    let accentColor = "neutral"
    
    if (tier === 'SSS') {
        borderClass = "border-yellow-500/60"
        bgGradient = "from-yellow-600/20 via-yellow-500/10 to-neutral-950"
        textClass = "text-yellow-400"
        glowClass = "bg-yellow-500/20"
        accentColor = "yellow"
    } else if (tier === 'SS') {
        borderClass = "border-yellow-400/50"
        bgGradient = "from-yellow-500/15 via-yellow-400/8 to-neutral-950"
        textClass = "text-yellow-300"
        glowClass = "bg-yellow-400/15"
        accentColor = "yellow"
    } else if (tier === 'S') {
        borderClass = "border-yellow-300/40"
        bgGradient = "from-yellow-400/10 via-yellow-300/5 to-neutral-950"
        textClass = "text-yellow-200"
        glowClass = "bg-yellow-300/10"
        accentColor = "yellow"
    } else if (tier === 'AA') {
        borderClass = "border-blue-500/60"
        bgGradient = "from-blue-600/20 via-blue-500/10 to-neutral-950"
        textClass = "text-blue-400"
        glowClass = "bg-blue-500/20"
        accentColor = "blue"
    } else if (tier === 'A') {
        borderClass = "border-blue-400/50"
        bgGradient = "from-blue-500/15 via-blue-400/8 to-neutral-950"
        textClass = "text-blue-300"
        glowClass = "bg-blue-400/15"
        accentColor = "blue"
    } else if (tier === 'BB') {
        borderClass = "border-purple-500/60"
        bgGradient = "from-purple-600/20 via-purple-500/10 to-neutral-950"
        textClass = "text-purple-400"
        glowClass = "bg-purple-500/20"
        accentColor = "purple"
    } else if (tier === 'B') {
        borderClass = "border-purple-400/50"
        bgGradient = "from-purple-500/15 via-purple-400/8 to-neutral-950"
        textClass = "text-purple-300"
        glowClass = "bg-purple-400/15"
        accentColor = "purple"
    } else if (tier === 'CB') {
        borderClass = "border-emerald-500/60"
        bgGradient = "from-emerald-600/20 via-emerald-500/10 to-neutral-950"
        textClass = "text-emerald-400"
        glowClass = "bg-emerald-500/20"
        accentColor = "emerald"
    } else if (tier === 'C') {
        borderClass = "border-neutral-600"
        bgGradient = "from-neutral-800 to-neutral-950"
        textClass = "text-neutral-400"
        glowClass = "bg-neutral-500/10"
        accentColor = "neutral"
    }

    return (
        <div className={`relative w-28 h-32 rounded-xl border-2 ${borderClass} bg-gradient-to-b ${bgGradient} flex flex-col items-center justify-center overflow-hidden group shadow-lg shadow-black/50 hover:shadow-xl hover:shadow-black/70 transition-all duration-300`}>
             {/* 发光效果 */}
             <div className={`absolute top-0 inset-x-0 h-1/2 ${glowClass} blur-xl opacity-50 group-hover:opacity-75 transition-opacity`}></div>
             
             {/* 装饰性边框高光 */}
             <div className={`absolute inset-0 rounded-xl border ${borderClass} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
             
             {/* 上半部分：Tier (段位) */}
             <div className="flex-1 flex flex-col items-center justify-center z-10 pt-2 relative">
                 <div className={`text-[10px] font-bold tracking-[0.2em] uppercase ${textClass} opacity-70 group-hover:opacity-100 transition-opacity`}>段位</div>
                 <div className={`text-5xl font-black italic tracking-tighter ${textClass} drop-shadow-lg scale-110 group-hover:scale-125 transition-transform duration-500`}>
                     {tier}
                 </div>
                 {/* 段位文字的光晕效果 */}
                 <div className={`absolute inset-0 ${glowClass} blur-2xl opacity-30 group-hover:opacity-50 transition-opacity`}></div>
             </div>
             
             {/* 下半部分：Level (等级) */}
             <div className={`w-full bg-black/60 backdrop-blur-sm py-1.5 text-center border-t ${borderClass} border-opacity-30 z-10`}>
                 <div className="text-xs font-mono font-bold text-white tracking-widest">
                     LV.<span className="text-lg">{level}</span>
                 </div>
             </div>
             
             {/* 底部装饰线 */}
             <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${borderClass} opacity-50`}></div>
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
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-white"></div>
                
                <div className="flex items-center gap-4 pl-2">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0">
                         {team.logo_url ? <img src={team.logo_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold">{team.name[0]}</div>}
                    </div>
                    <div>
                        <div className="text-xs text-neutral-500 font-bold uppercase tracking-wider mb-0.5">我的战队</div>
                        <div className="text-sm font-bold text-white group-hover:text-neutral-300 transition-colors">{team.name}</div>
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
                    <div className="w-full md:w-auto md:min-w-[240px] space-y-2">
                        <TeamPass team={myTeam} />
                        {isCaptain && myTeam && (
                            <button 
                                onClick={() => setIsTeamEditOpen(true)}
                                className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-neutral-800 hover:border-neutral-700 transition-colors"
                            >
                                ⚙️ 管理战队
                            </button>
                        )}
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
                <StatBox label="软镖 PPD" value={profile?.ppd_soft} color="text-white" sub="分数/镖" />
                <StatBox label="软镖 MPR" value={profile?.mpr_avg} color="text-white" sub="马克/轮" />
            </div>
        </div>

        {/* === 3. 生涯明细 === */}
        <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-2 border-l-2 border-orange-500">硬镖生涯 (Steel)</h3>
                <div className="grid grid-cols-2 gap-3">
                    <StatBox label="180 次数" value={profile?.total_180s} />
                    <StatBox label="140+ 次数" value={profile?.total_140s} />
                    <StatBox label="最高结镖" value={profile?.high_finish_steel} color="text-white"/>
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
                             <div className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${t.status === 'ongoing' ? 'text-white border-neutral-700 bg-neutral-900' : 'text-neutral-500 border-neutral-800'}`}>
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
            <button onClick={async()=>{await supabase.auth.signOut();router.push('/login')}} className="text-neutral-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
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
                            placeholder="请输入新的昵称（3-20 个字符）"
                            minLength={3}
                            maxLength={20}
                        />
                        <p className="text-xs text-neutral-600 mt-1">用户名长度：3-20 个字符</p>
                    </div>
                    <div>
                        <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2 block">头像</label>
                        <div className="space-y-3">
                            <div>
                                <label className="block w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg cursor-pointer hover:bg-neutral-800 hover:border-neutral-600 transition-colors text-center">
                                    {uploadingAvatar ? '上传中...' : '📤 选择图片上传'}
                                    <input 
                                        type="file" 
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={handleSelectAvatarFile}
                                        className="hidden"
                                        disabled={uploadingAvatar}
                                    />
                                </label>
                                <p className="text-[11px] text-neutral-500 mt-2 text-center">建议 1:1 方图，JPG/PNG/WebP，≤5MB</p>
                            </div>
                            <div className="text-xs text-neutral-500 text-center">或</div>
                        <input 
                            value={editForm.avatar_url} 
                            onChange={e => setEditForm({...editForm, avatar_url: e.target.value})}
                                className="w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg focus:border-white outline-none font-mono text-xs transition-colors"
                            placeholder="https://example.com/image.jpg"
                        />
                            {editForm.avatar_url && (
                                <div className="mt-2 flex justify-center">
                                    <img src={editForm.avatar_url} alt="预览" className="w-20 h-20 rounded-full object-cover border border-neutral-700" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => setIsEditOpen(false)} className="bg-neutral-900 text-neutral-400 font-bold py-3 rounded-lg hover:bg-neutral-800 transition-colors">取消</button>
                    <button onClick={handleSaveProfile} className="bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 transition-colors">保存修改</button>
                </div>
            </div>
        </div>
      )}

      {/* === 战队管理弹窗 === */}
      {isTeamEditOpen && myTeam && isCaptain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#0f0f0f] border border-neutral-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
                <button onClick={() => setIsTeamEditOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">✕</button>
                <h3 className="text-xl font-black text-white mb-6">管理战队</h3>
                <div className="space-y-5">
                    <div>
                        <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">战队名称</label>
                        <input 
                            value={teamForm.name} 
                            onChange={e => setTeamForm({...teamForm, name: e.target.value})}
                            className="w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg mt-1 focus:border-white outline-none transition-colors"
                            placeholder="请输入战队名称"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2 block">战队 LOGO</label>
                        <div className="space-y-3">
                            <div>
                                <label className="block w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg cursor-pointer hover:bg-neutral-800 hover:border-neutral-600 transition-colors text-center">
                                    {uploadingTeamLogo ? '上传中...' : '📤 选择图片上传'}
                                    <input 
                                        type="file" 
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={handleSelectTeamLogoFile}
                                        className="hidden"
                                        disabled={uploadingTeamLogo}
                                    />
                                </label>
                                <p className="text-[11px] text-neutral-500 mt-2 text-center">建议 1:1 方图，JPG/PNG/WebP，≤5MB</p>
                            </div>
                            <div className="text-xs text-neutral-500 text-center">或</div>
                            <input 
                                value={teamForm.logo_url} 
                                onChange={e => setTeamForm({...teamForm, logo_url: e.target.value})}
                                className="w-full bg-neutral-900 border border-neutral-700 text-white px-4 py-3 rounded-lg focus:border-white outline-none font-mono text-xs transition-colors"
                                placeholder="https://example.com/image.jpg"
                            />
                            {teamForm.logo_url && (
                                <div className="mt-2 flex justify-center">
                                    <img src={teamForm.logo_url} alt="预览" className="w-20 h-20 rounded-full object-cover border border-neutral-700" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => setIsTeamEditOpen(false)} className="bg-neutral-900 text-neutral-400 font-bold py-3 rounded-lg hover:bg-neutral-800 transition-colors">取消</button>
                    <button onClick={handleSaveTeam} className="bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 transition-colors">保存修改</button>
                </div>
            </div>
        </div>
      )}

      {/* 裁剪器弹窗 */}
      {isCropping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" 
             onMouseUp={handleCropMouseUp} onMouseLeave={handleCropMouseUp}>
          <div className="bg-[#0f0f0f] border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6 relative">
            <h3 className="text-lg font-bold text-white mb-4">裁剪{cropMode === 'avatar' ? '头像' : '战队 LOGO'}</h3>
            <div className="flex flex-col md:flex-row gap-6">
              <div 
                ref={cropperRef}
                className="relative bg-neutral-900 border border-neutral-800 rounded-xl"
                style={{ width: cropContainerSize, height: cropContainerSize }}
                onMouseMove={handleCropMouseMove}
              >
                {cropImageUrl && (
                  <>
                    <img 
                      src={cropImageUrl} 
                      className="absolute inset-0 w-full h-full object-contain select-none"
                      draggable={false}
                    />
                    <div 
                      onMouseDown={handleCropMouseDown}
                      className="absolute border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-move"
                      style={{
                        width: cropBox.size,
                        height: cropBox.size,
                        left: cropBox.x,
                        top: cropBox.y,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)'
                      }}
                    >
                      <div className="absolute inset-0 border border-white/30 pointer-events-none"></div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                  <div className="text-xs text-neutral-500 mb-2">裁剪尺寸</div>
                  <input 
                    type="range" 
                    min={0.3} max={1} step={0.01} 
                    value={Math.min(1, cropBox.size / Math.max(1, Math.min(displayBox.w, displayBox.h)))} 
                    onChange={e => handleCropSizeChange(Number(e.target.value))}
                    className="w-full accent-white"
                  />
                  <div className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
                    提示：支持非正方形原图，自由拖动选择裁剪区域，建议保持关键元素置中。
                  </div>
                </div>
                <div className="text-[11px] text-neutral-500 leading-relaxed bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                  推荐上传 JPG/PNG/WebP，大小 ≤ 5MB。裁剪后的图片将以 1:1 输出并自动压缩为 PNG。
                </div>
                <div className="flex gap-3">
                  <button onClick={closeCropper} className="flex-1 bg-neutral-900 text-neutral-400 font-bold py-3 rounded-lg hover:bg-neutral-800 transition-colors">取消</button>
                  <button onClick={confirmCropAndUpload} className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 transition-colors">裁剪并上传</button>
                </div>
              </div>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}