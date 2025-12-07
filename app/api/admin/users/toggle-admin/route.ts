import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, isAdmin } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ 
        error: '缺少服务端配置，无法修改管理员权限' 
      }, { status: 500 })
    }

    // 使用服务端 Supabase 客户端（绕过 RLS）
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 更新管理员权限
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ is_admin: isAdmin })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ profile: data })
  } catch (error: any) {
    console.error('修改管理员权限异常:', error)
    return NextResponse.json({ 
      error: error.message || '未知错误' 
    }, { status: 500 })
  }
}


