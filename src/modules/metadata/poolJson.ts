export interface ParsedPoolJson {
  poolId?: string;
  poolName?: string;
  up6Name?: string;
  up6ItemId?: string;
}

export function parsePoolJson(raw: unknown): ParsedPoolJson {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const top = raw as Record<string, unknown>;

  // 新简化格式:
  // pool_ID, pool_name, up6_name, start_time, end_time
  const simplePoolId = typeof top.pool_ID === 'string' ? top.pool_ID : undefined;
  const simplePoolName = typeof top.pool_name === 'string' ? top.pool_name : undefined;
  const simpleUp6Name = typeof top.up6_name === 'string' ? top.up6_name : undefined;
  const simpleUp6ItemId = typeof top.up6_item_id === 'string' ? top.up6_item_id : undefined;

  const data = (top.data && typeof top.data === 'object') ? (top.data as Record<string, unknown>) : undefined;
  const pool = (data?.pool && typeof data.pool === 'object') ? (data.pool as Record<string, unknown>) : undefined;
  const all = Array.isArray(pool?.all) ? (pool?.all as Array<Record<string, unknown>>) : [];

  const legacyPoolId = typeof pool?.pool_id === 'string' ? pool.pool_id : undefined;
  const legacyPoolName = typeof pool?.pool_name === 'string' ? pool.pool_name : undefined;
  const legacyUp6Name = typeof pool?.up6_name === 'string' ? pool.up6_name : undefined;

  const upName = (simpleUp6Name ?? legacyUp6Name)?.trim();
  const matched = upName
    ? all.find((entry) => typeof entry.name === 'string' && entry.name.trim() === upName)
    : undefined;
  const legacyUp6ItemId = typeof matched?.id === 'string' ? matched.id : undefined;

  return {
    poolId: simplePoolId ?? legacyPoolId,
    poolName: simplePoolName ?? legacyPoolName,
    up6Name: upName,
    up6ItemId: simpleUp6ItemId ?? legacyUp6ItemId,
  };
}

