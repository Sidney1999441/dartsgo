import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[85vh] px-4 animate-in fade-in duration-700">
      
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-20 mt-10">
        <div className="inline-flex items-center justify-center px-3 py-1 mb-6 border border-neutral-800 rounded-full bg-neutral-900/50">
          <span className="w-1.5 h-1.5 rounded-full bg-white mr-2 animate-pulse"></span>
          <span className="text-xs text-neutral-400 tracking-wide uppercase">Season 2025 Live</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-white mb-6">
          DartsGo
        </h1>
        <p className="text-lg md:text-xl text-neutral-500 max-w-xl mx-auto leading-relaxed">
          纯粹的飞镖赛事管理系统<br/>
          千里之行，始于足下
        </p>
        
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/schedule" className="btn-primary min-w-[160px] text-center">
            浏览赛程
          </Link>
          <Link href="/rankings" className="btn-secondary min-w-[160px] text-center">
            查看榜单
          </Link>
        </div>
      </div>

      {/* Grid Menu */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl">
        
        <Link href="/rankings" className="group minimal-card p-6 rounded-lg relative overflow-hidden">
          <div className="absolute top-4 right-4 text-neutral-800 group-hover:text-white transition-colors duration-300">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Rankings</h3>
          <p className="text-sm text-neutral-500 group-hover:text-neutral-400 transition-colors">
            实时积分排名与战队数据分析。
          </p>
        </Link>

        <Link href="/schedule" className="group minimal-card p-6 rounded-lg relative overflow-hidden">
          <div className="absolute top-4 right-4 text-neutral-800 group-hover:text-white transition-colors duration-300">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Schedule</h3>
          <p className="text-sm text-neutral-500 group-hover:text-neutral-400 transition-colors">
            掌握最新的比赛对阵与时间安排。
          </p>
        </Link>

        <Link href="/dashboard" className="group minimal-card p-6 rounded-lg relative overflow-hidden">
          <div className="absolute top-4 right-4 text-neutral-800 group-hover:text-white transition-colors duration-300">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Player</h3>
          <p className="text-sm text-neutral-500 group-hover:text-neutral-400 transition-colors">
            选手个人中心，管理你的生涯数据。
          </p>
        </Link>

      </div>

      <footer className="mt-20 border-t border-neutral-900 w-full py-8 text-center text-xs text-neutral-600">
        <p>© 2025 DartsGo System. Designed for Sidney.</p>
      </footer>
    </main>
  );
}