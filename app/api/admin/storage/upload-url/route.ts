'use server'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabaseAdmin'

// 生成带签名上传凭证（绕过 Storage RLS），仅限白名单 bucket
export async function POST(req: Request) {
  try {
    const { bucket, path } = await req.json()
    const allow = ['avatars', 'team-logos']
    if (!allow.includes(bucket)) {
      return NextResponse.json({ error: 'bucket not allowed' }, { status: 400 })
    }
    if (!path) {
      return NextResponse.json({ error: 'path required' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path, 60) // 60s 有效
    if (error || !data) throw error || new Error('no signed url')
    return NextResponse.json({ bucket, path, token: data.token, signedUrl: data.signedUrl })
  } catch (err: any) {
    console.error('upload-url error', err?.message || err)
    return NextResponse.json({ error: err?.message || 'unknown error' }, { status: 500 })
  }
}



