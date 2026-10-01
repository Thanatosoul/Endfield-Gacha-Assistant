// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LimitedPityPanel, PityBar, RerunPityPanel } from '@/components/BannerPity';
import type { LimitedCharacterPity, RerunCharacterPity } from '@/modules/stats-engine/banner-rules';

afterEach(cleanup);

const limitedPity: LimitedCharacterPity = {
  poolId: 'special_launch_001',
  sixStarPity: 79,
  sixStarRemaining: 1,
  upPity: 120,
  upRemaining: 0,
  tokenPulls: 240,
  tokenProgress: 0,
  tokensEarned: 1,
};

const rerunPity: RerunCharacterPity = {
  poolId: 'rerun_chr_yvonne',
  upName: '伊冯',
  upPity: 30,
  upRemaining: 90,
  upGuaranteeConsumed: false,
  tokenPulls: 80,
  tokenProgress: 80,
  tokensEarned: 0,
};

function barOf(container: HTMLElement): HTMLElement {
  const bar = container.querySelector<HTMLElement>('div[style*="width"]');
  if (!bar) throw new Error('pity bar not found');
  return bar;
}

describe('PityBar', () => {
  it('renders the value, cap and note', () => {
    render(<PityBar label="六星保底" value={40} cap={80} note="还差 40" />);
    expect(screen.getByText('六星保底')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('/ 80')).toBeInTheDocument();
    expect(screen.getByText('还差 40')).toBeInTheDocument();
  });

  it('scales the bar width to value / cap', () => {
    const { container } = render(<PityBar label="x" value={40} cap={80} />);
    expect(barOf(container).style.width).toBe('50%');
  });

  it('caps the width at 100% when over the cap', () => {
    const { container } = render(<PityBar label="x" value={120} cap={80} />);
    expect(barOf(container).style.width).toBe('100%');
  });

  it('keeps a minimal visible sliver once the value is above zero', () => {
    const { container } = render(<PityBar label="x" value={1} cap={240} />);
    expect(barOf(container).style.width).toBe('4%');
  });
});

describe('LimitedPityPanel', () => {
  it('shows the three limited-banner tracks', () => {
    render(<LimitedPityPanel pity={limitedPity} />);
    expect(screen.getByText('六星保底（跨限定池）')).toBeInTheDocument();
    expect(screen.getByText('UP 保底（本池，出 UP 六星重置）')).toBeInTheDocument();
    expect(screen.getByText('UP 信物（本池 240 抽）')).toBeInTheDocument();
    expect(screen.getByText('已达保底')).toBeInTheDocument();
    expect(screen.getByText('还差 1')).toBeInTheDocument();
    expect(screen.getByText('已获 1')).toBeInTheDocument();
  });

  it('marks reached cumulative reward milestones read-only', () => {
    render(<LimitedPityPanel pity={limitedPity} />);
    expect(screen.getByText('累计奖励（只读参考）')).toBeInTheDocument();
    expect(screen.getByText('累计 30 · 加急招募 ×10 ✓')).toBeInTheDocument();
    expect(screen.getByText('累计 60 · 寻访情报书 ×1 ✓')).toBeInTheDocument();
  });
});

describe('RerunPityPanel', () => {
  it('shows the UP character and the inherited guarantee copy', () => {
    render(<RerunPityPanel pity={rerunPity} />);
    expect(screen.getByText('复刻寻访 · 伊冯')).toBeInTheDocument();
    expect(screen.getByText('120 抽 UP 保底（同角色跨复刻继承）')).toBeInTheDocument();
    expect(screen.getByText('还差 90')).toBeInTheDocument();
  });

  it('shows inherited rerun milestones with only reached ones checked', () => {
    render(<RerunPityPanel pity={rerunPity} />);
    expect(screen.getByText('累计 30 · 加急招募 ×10 ✓')).toBeInTheDocument();
    expect(screen.getByText('累计 60 · 加急招募 ×10 ✓')).toBeInTheDocument();
    expect(screen.getByText('累计 90 · 加急招募 ×10')).toBeInTheDocument();
  });
});
