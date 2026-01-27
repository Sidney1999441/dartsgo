import { createClient } from '@supabase/supabase-js'

// 服务端专用 Supabase 客户端，使用 service role key（必须保存在服务端）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Supabase URL 未配置 (NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_URL)')
}

if (!serviceRoleKey) {
  throw new Error('Supabase service role key 未配置 (SUPABASE_SERVICE_ROLE_KEY)')
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})



