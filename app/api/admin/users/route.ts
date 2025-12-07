import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // 检查环境变量
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('缺少 SUPABASE_SERVICE_ROLE_KEY，使用 profiles 查询作为回退')
      // 回退方案：只返回 profiles 数据
      const supabaseClient = createClient(supabaseUrl || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profilesError) {
        return NextResponse.json({ error: profilesError.message }, { status: 500 })
      }

      // 将 profiles 转换为用户格式
      const users = (profiles || []).map((profile: any) => ({
        id: profile.id,
        email: null, // profiles 表中可能没有 email
        created_at: profile.created_at || null,
        last_sign_in_at: null,
        username: profile.username || null,
        is_admin: profile.is_admin || false,
        level: profile.level || null,
        tier: profile.tier || null,
        has_profile: true
      }))

      return NextResponse.json({ users })
    }

    // 使用服务端 Supabase 客户端（需要服务端密钥）
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 获取所有 auth 用户
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('获取 auth 用户失败:', authError)
      // 如果获取 auth 用户失败，回退到 profiles
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('*')

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

      return NextResponse.json({ users })
    }

    // 获取所有 profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')

    if (profilesError) {
      console.error('获取 profiles 失败:', profilesError)
      // 即使 profiles 查询失败，也返回 auth 用户
    }

    // 创建 profiles 映射
    const profilesMap = new Map()
    if (profiles) {
      profiles.forEach((p: any) => {
        profilesMap.set(p.id, p)
      })
    }

    // 合并数据
    const usersWithProfiles = users.map((user: any) => {
      const profile = profilesMap.get(user.id) || {}
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        username: profile.username || null,
        is_admin: profile.is_admin || false,
        level: profile.level || null,
        tier: profile.tier || null,
        has_profile: !!profile.id
      }
    })

    return NextResponse.json({ users: usersWithProfiles })
  } catch (error: any) {
    console.error('获取用户列表异常:', error)
    return NextResponse.json({ 
      error: error.message || '未知错误',
      details: error.toString()
    }, { status: 500 })
  }
}

