export function toDateMs(ts: number): number {
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

export function formatDateTime(ts: number): string {
  return new Date(toDateMs(ts)).toLocaleString();
}

export function formatDate(ts: number): string {
  return new Date(toDateMs(ts)).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: '2-digit' });
}
