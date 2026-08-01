const projects = [
  { name: "Asiri Music OS", phase: "Web Stable", progress: 78, status: "نشط" },
  { name: "Asiri Capital", phase: "Architecture", progress: 18, status: "مخطط" },
  { name: "AGIP", phase: "Product Definition", progress: 12, status: "مخطط" },
];

const decisions = [
  {
    title: "إيقاف تشغيل Spotify داخل Safari",
    project: "Asiri Music OS",
    reason: "عدم استقرار Web Playback SDK على iOS وظهور Device not found.",
  },
];

export default function HomePage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#06100a] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-emerald-900 bg-[#0b1910] p-7">
          <p className="text-xs font-bold tracking-[0.25em] text-emerald-400">ASIRI INTELLIGENCE CORE</p>
          <h1 className="mt-3 text-4xl font-black">صباح الخير أحمد</h1>
          <p className="mt-2 text-slate-400">المشاريع والمهام والقرارات والذاكرة في نواة واحدة.</p>
          <div className="mt-6 flex gap-3">
            <input className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/30 px-4 py-3" placeholder="ابحث في جميع المشاريع والقرارات والذاكرة" />
            <button className="rounded-2xl bg-emerald-400 px-6 font-black text-black">بحث</button>
          </div>
        </header>

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl font-black">المشاريع</h2><span className="text-sm text-slate-400">{projects.length} مشاريع</span></div>
          <div className="grid gap-4 md:grid-cols-3">
            {projects.map((project) => (
              <article key={project.name} className="rounded-3xl border border-slate-800 bg-[#101712] p-5">
                <div className="flex items-start justify-between"><h3 className="text-xl font-black">{project.name}</h3><span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300">{project.status}</span></div>
                <p className="mt-2 text-sm text-slate-400">{project.phase}</p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${project.progress}%` }} /></div>
                <p className="mt-2 text-left text-sm font-bold text-emerald-300">{project.progress}%</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-800 bg-[#101712] p-6">
            <h2 className="text-xl font-black">آخر القرارات</h2>
            {decisions.map((decision) => (
              <div key={decision.title} className="mt-4 rounded-2xl bg-black/25 p-4">
                <strong>{decision.title}</strong>
                <p className="mt-1 text-sm text-emerald-300">{decision.project}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{decision.reason}</p>
              </div>
            ))}
          </article>
          <article className="rounded-3xl border border-slate-800 bg-[#101712] p-6">
            <h2 className="text-xl font-black">المهام الحالية</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-black/25 p-4">ربط قاعدة بيانات Supabase</div>
              <div className="rounded-2xl bg-black/25 p-4">تفعيل المصادقة وسياسات RLS</div>
              <div className="rounded-2xl bg-black/25 p-4">بناء البحث الموحد الحقيقي</div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
