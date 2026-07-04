import { getPreference } from '@/modules/storage/queries';
import { savePreference } from '@/modules/storage/repositories';

export interface CheckInConfig {
  lastCheckInAt: number | null;
  lastResults: CheckInConfigLastResult[];
}

export interface CheckInConfigLastResult {
  game: string;
  nickname: string;
  success: boolean;
  awards: string[];
  error: string;
  at: number;
}

function makeKey(hgUid: string, suffix: string): string {
  return `checkin.${suffix}.${hgUid}`;
}

export async function getCheckInConfig(hgUid: string): Promise<CheckInConfig | null> {
  if (!hgUid || !hgUid.trim()) return null;

  const lastEntry = await getPreference(makeKey(hgUid, 'last'));
  if (!lastEntry?.value) return null;

  let lastResults: CheckInConfigLastResult[] = [];
  try {
    lastResults = JSON.parse(lastEntry.value);
  } catch {
    lastResults = [];
  }
  const lastCheckInAt = lastEntry.updated_at ?? null;

  return { lastCheckInAt, lastResults };
}

export async function enableCheckInConfig(hgUid: string): Promise<void> {
  if (!hgUid || !hgUid.trim()) return;
  await savePreference(makeKey(hgUid, 'last'), '[]');
}

export async function saveCheckInLastResults(
  hgUid: string,
  results: CheckInConfigLastResult[],
): Promise<void> {
  await savePreference(makeKey(hgUid, 'last'), JSON.stringify(results));
}

export async function deleteCheckInConfig(hgUid: string): Promise<void> {
  await savePreference(makeKey(hgUid, 'last'), '');
}
