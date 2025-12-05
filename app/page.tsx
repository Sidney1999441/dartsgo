import Link from 'next/link';
import Navbar from './components/Navbar'; // 确保这里引用了 Navbar，虽然布局文件里有了，但首页可以保持独立性

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      {/* 顶部标题区 */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">
          DARTS.PRO
        </h1>
        <p className="text-slate-400 text-lg">专业的飞镖赛事管理系统</p>
      </div>

      {/* 核心功能入口卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        
        {/* 卡片1：排行榜 */}
        <Link href="/rankings" className="group">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl hover:bg-slate-700 transition-all cursor-pointer h-full hover:border-blue-500/50">
            <h2 className="text-2xl font-bold mb-2 group-hover:text-blue-400">🏆 战队排行榜</h2>
            <p className="text-slate-400">查看当前赛季各大战队的积分排名与详细数据。</p>
          </div>
        </Link>

        {/* 卡片2：比赛日程 */}
        <Link href="/schedule" className="group">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl hover:bg-slate-700 transition-all cursor-pointer h-full hover:border-green-500/50">
            <h2 className="text-2xl font-bold mb-2 group-hover:text-green-400">📅 比赛日程</h2>
            <p className="text-slate-400">查看近期比赛安排、对阵信息及历史赛果。</p>
          </div>
        </Link>

        {/* 卡片3：个人中心 (这里改了链接！) */}
        {/* 以前是 /login，现在改成 /dashboard */}
        <Link href="/dashboard" className="group">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl hover:bg-slate-700 transition-all cursor-pointer h-full hover:border-purple-500/50">
            <h2 className="text-2xl font-bold mb-2 group-hover:text-purple-400">👤 选手中心</h2>
            <p className="text-slate-400">管理个人档案，查看我的战队与比赛数据。</p>
          </div>
        </Link>

        {/* 卡片4：赛事直播 */}
        <div className="bg-slate-800/50 border border-slate-700/50 p-8 rounded-2xl h-full opacity-60">
          <h2 className="text-2xl font-bold mb-2 text-slate-500">📺 赛事直播</h2>
          <p className="text-slate-500">即将上线：实时比分板与直播推流功能。</p>
        </div>

      </div>
      
      <div className="mt-12 text-slate-600 text-sm">
        Powered by Next.js & Supabase
      </div>
    </main>
  );
}