import { supabase } from '../lib/supabase'; // 引入我们之前配置好的连接器
import Link from 'next/link';

// 这是一个“服务端组件”，它会直接在服务器上请求数据，速度很快，且利于SEO
export default async function RankingsPage() {
  
  // 1. 直接向 Supabase 请求 teams 表的数据，并按积分排序（假设还没积分，先按创建时间）
  // 注意：我们在SQL里还没加积分字段，这里先读取基本信息
  const { data: teams, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return <div className="text-red-500 p-10">数据读取失败: {error.message}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      {/* 顶部导航栏 */}
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-400">战队排行榜</h1>
        <Link href="/" className="px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 text-sm">
          ← 返回首页
        </Link>
      </div>

      {/* 表格区域 */}
      <div className="max-w-4xl mx-auto bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
        <table className="w-full text-left">
          <thead className="bg-slate-950 text-slate-400 uppercase text-sm font-semibold">
            <tr>
              <th className="p-4 w-20">排名</th>
              <th className="p-4">战队名称</th>
              <th className="p-4">队长ID</th>
              <th className="p-4 text-right">积分 (示例)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {/* 2. 这里的 teams 就是从数据库取回来的数组 */}
            {teams && teams.length > 0 ? (
              teams.map((team, index) => (
                <tr key={team.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4 font-mono text-slate-500">#{index + 1}</td>
                  <td className="p-4 font-bold text-lg flex items-center gap-3">
                    {/* 如果有队徽就显示，没有就显示默认圆圈 */}
                    {team.logo_url ? (
                      <img src={team.logo_url} className="w-8 h-8 rounded-full bg-slate-600 object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs">
                        {team.name.substring(0,1)}
                      </div>
                    )}
                    {team.name}
                  </td>
                  <td className="p-4 text-slate-400 text-sm">
                    {team.captain_id ? '已指定' : '暂无'}
                  </td>
                  <td className="p-4 text-right font-mono text-yellow-500">
                    0 {/* 暂时写死，后续我们做积分统计逻辑 */}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  暂无战队数据，请先去 Supabase 后台添加几条测试数据。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}