import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default async function SchedulePage() {
  // 1. 获取比赛列表 (无需身份验证，所有人可见)
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, start_time, is_finished, home_score, away_score,
      tournament:tournaments(name),
      home_team:teams!home_team_id(name, logo_url),
      away_team:teams!away_team_id(name, logo_url)
    `)
    .order('start_time', { ascending: false }); // 最近的比赛排上面

  const formatDate = (dateString: string) => {
    if (!dateString) return '时间待定';
    return new Date(dateString).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
            📅 赛季赛程
          </h1>
       </div>

       <div className="grid gap-4">
          {matches?.map((match: any) => (
            <div key={match.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex flex-col md:flex-row items-center hover:border-slate-500 transition-colors">
              
              {/* 比赛信息 */}
              <div className="flex-1 p-4 flex items-center justify-between w-full">
                 {/* 主队 */}
                 <div className="flex items-center gap-3 w-1/3 justify-end">
                    <span className="font-bold text-right hidden md:block">{match.home_team?.name}</span>
                    <span className="font-bold text-right md:hidden">{match.home_team?.name.substring(0,4)}</span>
                    {match.home_team?.logo_url ? (
                        <img src={match.home_team.logo_url} className="w-10 h-10 rounded-full border border-slate-600"/>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center font-bold text-xs">A</div>
                    )}
                 </div>
                 
                 {/* 比分/时间 */}
                 <div className="px-2 text-center min-w-[100px]">
                    {match.is_finished ? (
                        <div className="text-2xl font-black font-mono text-white">{match.home_score} - {match.away_score}</div>
                    ) : (
                        <div className="text-xl font-black text-slate-500">VS</div>
                    )}
                    <div className="text-xs text-slate-500 mt-1">{formatDate(match.start_time)}</div>
                 </div>

                 {/* 客队 */}
                 <div className="flex items-center gap-3 w-1/3 justify-start">
                    {match.away_team?.logo_url ? (
                        <img src={match.away_team.logo_url} className="w-10 h-10 rounded-full border border-slate-600"/>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center font-bold text-xs">B</div>
                    )}
                    <span className="font-bold text-left hidden md:block">{match.away_team?.name}</span>
                    <span className="font-bold text-left md:hidden">{match.away_team?.name.substring(0,4)}</span>
                 </div>
              </div>

              {/* 操作区：只读 */}
              <div className="w-full md:w-auto p-4 bg-slate-900/30 md:border-l border-t md:border-t-0 border-slate-700 flex justify-center">
                 {match.is_finished ? (
                    <Link href={`/matches/${match.id}`} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full text-sm transition font-medium">
                       📊 查看战报
                    </Link>
                 ) : (
                    <span className="px-6 py-2 text-slate-500 text-sm border border-slate-700 rounded-full">
                       ⏳ 即将开始
                    </span>
                 )}
              </div>

            </div>
          ))}
          
          {(!matches || matches.length === 0) && (
              <div className="text-center py-12 text-slate-500">暂无比赛安排</div>
          )}
       </div>
    </div>
  );
}