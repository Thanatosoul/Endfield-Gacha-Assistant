import { memo } from 'react';

export const AboutPage = memo(function AboutPage() {
  return (
    <div className="grid gap-4">
      <section className="ef-sec p-5 sm:p-6">
        <p className="ef-kicker">关于</p>
        <h3 className="ef-title mt-2 text-xl">Endfield 抽卡助手</h3>
        <p className="mt-4 text-sm text-muted">本工具用于本地抽卡记录同步、浏览与统计分析。</p>
        <p className="ef-code mt-6">EGA-LOCAL // RECORD-UTILITY</p>
      </section>
    </div>
  );
});
