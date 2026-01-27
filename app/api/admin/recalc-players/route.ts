'use server'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabaseAdmin'

// 重新汇总指定玩家的生涯数据（使用 service role 绕过 RLS）
export async function POST(req: Request) {
  try {
    const { playerIds } = await req.json()
    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json({ error: 'playerIds required' }, { status: 400 })
    }

    // 取这些玩家的所有比赛数据，带 match_type
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('match_stats')
      .select('*, matches(match_type)')
      .in('player_id', playerIds)

    if (statsError) throw statsError

    const aggregator: any = {}
    stats?.forEach((s: any) => {
      const pid = s.player_id
      const type = s.matches?.match_type || 'steel'
      if (!aggregator[pid]) aggregator[pid] = { steelSum: 0, steelCount: 0, softSum: 0, mprSum: 0, softCount: 0, t180: 0, t140: 0, tHat: 0, tHorse: 0, hiSteel: 0, hiSoft: 0, matches: 0 }
      const p = aggregator[pid]
      p.matches += 1
      p.t180 += s.score_180s || 0
      p.t140 += s.score_140s || 0
      p.tHat += s.hat_trick || 0
      p.tHorse += s.white_horse || 0
      if (type === 'steel' && s.high_finish > p.hiSteel) p.hiSteel = s.high_finish
      if (type === 'soft' && s.high_finish > p.hiSoft) p.hiSoft = s.high_finish
      if (type === 'steel') { p.steelSum += Number(s.ppd || 0); p.steelCount += 1 } 
      else { p.softSum += Number(s.ppd || 0); p.mprSum += Number(s.mpr || 0); p.softCount += 1 }
    })

    for (const [pid, data] of Object.entries(aggregator) as any) {
      const steelAvg = data.steelCount > 0 ? (data.steelSum / data.steelCount) : 0
      const softAvg = data.softCount > 0 ? (data.softSum / data.softCount) : 0
      const mprAvg = data.softCount > 0 ? (data.mprSum / data.softCount) : 0
      const basePPD = steelAvg > 0 ? steelAvg : softAvg
      let level = Math.floor((basePPD - 10) * 1.5)
      if (level < 1) level = 1; if (level > 30) level = 30
      let tier = 'C'
      if (basePPD >= 30) tier = 'SS'; else if (basePPD >= 25) tier = 'S'; else if (basePPD >= 20) tier = 'A'; else if (basePPD >= 15) tier = 'B'

      const { error: updateErr } = await supabaseAdmin.from('profiles').update({
        ppd_steel: steelAvg.toFixed(2), ppd_soft: softAvg.toFixed(2), mpr_avg: mprAvg.toFixed(2),
        level, tier, total_180s: data.t180, total_140s: data.t140, total_hats: data.tHat, total_horses: data.tHorse,
        high_finish_steel: data.hiSteel, high_finish_soft: data.hiSoft, matches_played: data.matches
      }).eq('id', pid)
      if (updateErr) throw updateErr
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('recalc-players error', err?.message || err)
    return NextResponse.json({ error: err?.message || 'unknown error' }, { status: 500 })
  }
}



