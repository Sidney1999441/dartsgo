import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userIds } = await request.json()

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ profiles: [] })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ 
        error: '缺少服务端配置' 
      }, { status: 500 })
    }

    // 使用服务端 Supabase 客户端（绕过 RLS）
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 批量获取 profiles 信息（注意：profiles 表中没有 email 字段）
    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds)

    // 调试日志
    console.log('API: 查询的 userIds:', userIds)
    console.log('API: 查询结果 profilesData:', JSON.stringify(profilesData, null, 2))
    console.log('API: 查询错误 profilesError:', profilesError)

    if (profilesError) {
      console.error('获取 profiles 失败:', profilesError)
      return NextResponse.json({ 
        error: profilesError.message,
        profiles: []
      }, { status: 500 })
    }

    // 确保返回的数据包含username字段
    const profiles = (profilesData || []).map((p: any) => ({
      id: p.id,
      username: p.username || null, // 确保username字段存在
      avatar_url: p.avatar_url || null
    }))

    console.log('API: 返回的 profiles:', JSON.stringify(profiles, null, 2))
    return NextResponse.json({ profiles })
  } catch (error: any) {
    console.error('获取队员 profiles 异常:', error)
    return NextResponse.json({ 
      error: error.message || '未知错误',
      profiles: []
    }, { status: 500 })
  }
}

