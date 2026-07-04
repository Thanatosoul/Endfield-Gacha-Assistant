import { memo } from 'react';

export const AboutPage = memo(function AboutPage() {
  return (
    <div className="grid gap-4">
      <section className="panel rounded-[28px] p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">关于</p>
        <h3 className="mt-2 text-xl font-semibold">Endfield 抽卡助手</h3>
        <p className="mt-4 text-sm text-muted">本工具用于本地抽卡记录同步、浏览与统计分析。</p>
      </section>
    </div>
  );
});
