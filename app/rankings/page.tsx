import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default async function RankingsPage() {
  const { data: teams, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: true }); // 暂时按时间，以后按 points

  if (error) return <div className="p-8 text-center text-red-400">数据加载异常</div>;

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter">
            LEAGUE <span className="text-blue-500">RANKINGS</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">常规赛积分榜 / Season 1</p>
        </div>
        <Link href="/" className="text-sm font-medium text-slate-400 hover:text-white transition flex items-center gap-1">
          <span className="text-lg">↩</span> 返回首页
        </Link>
      </div>

      {/* 列表容器 */}
      <div className="max-w-5xl mx-auto space-y-3">
        
        {/* 表头 (仅在大屏显示) */}
        <div className="hidden md:grid grid-cols-12 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest pb-2">
          <div className="col-span-1">Rank</div>
          <div className="col-span-5">Team Name</div>
          <div className="col-span-3">Captain</div>
          <div className="col-span-3 text-right">Points</div>
        </div>

        {/* 数据行 */}
        {teams && teams.length > 0 ? (
          teams.map((team, index) => {
            // 计算前三名的样式
            const isTop3 = index < 3;
            const rankColor = index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-slate-500';
            const borderColor = index === 0 ? 'border-yellow-500/50' : 'border-white/5';
            
            return (
              <div 
                key={team.id} 
                className={`group relative grid grid-cols-12 items-center bg-slate-800/50 backdrop-blur hover:bg-slate-800 border ${borderColor} rounded-xl p-4 transition-all hover:scale-[1.01] hover:shadow-xl`}
              >
                {/* 排名 */}
                <div className={`col-span-2 md:col-span-1 text-2xl font-black italic ${rankColor}`}>
                  #{index + 1}
                </div>

                {/* 战队信息 */}
                <div className="col-span-7 md:col-span-5 flex items-center gap-4">
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-slate-700 ring-2 ring-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {team.logo_url ? (
                      <img src={team.logo_url} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-slate-400 text-sm">{team.name.substring(0,1)}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-white text-lg leading-tight group-hover:text-blue-400 transition-colors">
                      {team.name}
                    </div>
                    {/* 手机端显示的次要信息 */}
                    <div className="md:hidden text-xs text-slate-500 mt-1">
                      CPT: {team.captain_id ? '已指定' : '-'}
                    </div>
                  </div>
                </div>

                {/* 队长 (大屏显示) */}
                <div className="hidden md:block col-span-3 text-sm text-slate-400">
                  {team.captain_id ? <span className="bg-slate-900 px-2 py-1 rounded text-xs">Captain Set</span> : '未指定'}
                </div>

                {/* 积分 */}
                <div className="col-span-3 text-right">
                  <span className="font-mono text-xl md:text-2xl font-bold text-white tracking-widest">0</span>
                  <span className="text-xs text-slate-500 ml-1">PTS</span>
                </div>
              </div>
            )
          })
        ) : (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
            暂无战队数据
          </div>
        )}
      </div>
    </div>
  );
}