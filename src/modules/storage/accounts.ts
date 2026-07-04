import Database from '@tauri-apps/plugin-sql';
import type { BoundAccount } from '@/modules/official-api/types';
import type { GameAccount } from '@/domain/types';
import { upsertGameAccount } from '@/modules/storage/repositories';

export function makeAccountId(serverId: string, roleId: string): string {
  return `${serverId}:${roleId}`;
}

export function parseAccountId(accountId: string): { serverId: string; roleId: string } | null {
  if (!accountId) {
    return null;
  }

  const index = accountId.indexOf(':');
  if (index <= 0 || index === accountId.length - 1) {
    return null;
  }

  return {
    serverId: accountId.slice(0, index),
    roleId: accountId.slice(index + 1),
  };
}

export function accountsFromBinding(binding: BoundAccount): GameAccount[] {
  const now = Date.now();
  return (binding.roles ?? []).map((role) => ({
    id: makeAccountId(role.serverId, role.roleId),
    region: 'cn',
    uid: role.roleId,
    hg_uid: binding.uid,
    nickname: role.nickName || role.roleId,
    channel: role.serverName ? `${binding.channelName} · ${role.serverName}` : binding.channelName,
    created_at: now,
    updated_at: now,
  }));
}

export async function saveAccountsFromBindings(
  bindings: BoundAccount[],
  database?: Database,
): Promise<GameAccount[]> {
  const accounts = bindings.flatMap((binding) => accountsFromBinding(binding));

  for (const account of accounts) {
    await upsertGameAccount(account, database);
  }

  return accounts;
}
