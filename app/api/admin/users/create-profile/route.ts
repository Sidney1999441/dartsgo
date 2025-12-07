import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, username } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ 
        error: '缺少服务端配置，无法创建用户资料' 
      }, { status: 500 })
    }

    // 使用服务端 Supabase 客户端（绕过 RLS）
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 创建 profile
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        username: username || `用户_${userId.substring(0, 8)}`
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        // profile 已存在，尝试更新
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ username: username || `用户_${userId.substring(0, 8)}` })
          .eq('id', userId)
          .select()
          .single()

        if (updateError) {
          return NextResponse.json({ 
            error: updateError.message 
          }, { status: 500 })
        }

        return NextResponse.json({ profile: updateData })
      }

      return NextResponse.json({ 
        error: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ profile: data })
  } catch (error: any) {
    console.error('创建用户资料异常:', error)
    return NextResponse.json({ 
      error: error.message || '未知错误' 
    }, { status: 500 })
  }
}


