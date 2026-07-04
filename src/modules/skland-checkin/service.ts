import CryptoJS from 'crypto-js';
import * as pako from 'pako';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriRuntime } from '@/lib/runtime';

const fetchImpl: typeof fetch = isTauriRuntime() ? tauriFetch : fetch;

const RSA_PUBLIC_KEY_B64 =
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmxMNr7n8ZeT0tE1R9j/mPixoinPkeM+k4VGIn/s0k7N5rJAfnZ0eMER+QhwFvshzo0LNmeUkpR8uIlU/GEVr8mN28sKmwd2gpygqj0ePnBmOW4v0ZVwbSYK+izkhVFk2V/doLoMbWy6b+UnA8mkjvg0iYWRByfRsK2gdl7llqCwIDAQAB';

const DES_RULES: Record<string, { key?: string; obf: string; encrypt: boolean }> = {
  appId: { key: 'uy7mzc4h', obf: 'xx', encrypt: true },
  box: { obf: 'jf', encrypt: false },
  canvas: { key: 'snrn887t', obf: 'yk', encrypt: true },
  clientSize: { key: 'cpmjjgsu', obf: 'zx', encrypt: true },
  organization: { key: '78moqjfc', obf: 'dp', encrypt: true },
  os: { key: 'je6vk6t4', obf: 'pj', encrypt: true },
  platform: { key: 'pakxhcd2', obf: 'gm', encrypt: true },
  plugins: { key: 'v51m3pzl', obf: 'kq', encrypt: true },
  pmf: { key: '2mdeslu3', obf: 'vw', encrypt: true },
  protocol: { obf: 'protocol', encrypt: false },
  referer: { key: 'y7bmrjlc', obf: 'ab', encrypt: true },
  res: { key: 'whxqm2a7', obf: 'hf', encrypt: true },
  rtype: { key: 'x8o2h2bl', obf: 'lo', encrypt: true },
  sdkver: { key: '9q3dcxp2', obf: 'sc', encrypt: true },
  status: { key: '2jbrxxw4', obf: 'an', encrypt: true },
  subVersion: { key: 'eo3i2puh', obf: 'ns', encrypt: true },
  svm: { key: 'fzj3kaeh', obf: 'qr', encrypt: true },
  time: { key: 'q2t3odsk', obf: 'nb', encrypt: true },
  timezone: { key: '1uv05lj5', obf: 'as', encrypt: true },
  tn: { key: 'x9nzj1bp', obf: 'py', encrypt: true },
  trees: { key: 'acfs0xo4', obf: 'pi', encrypt: true },
  ua: { key: 'k92crp1t', obf: 'bj', encrypt: true },
  url: { key: 'y95hjkoo', obf: 'cf', encrypt: true },
  version: { obf: 'version', encrypt: false },
  vpw: { key: 'r9924ab5', obf: 'ca', encrypt: true },
};

const BROWSER_ENV: Record<string, string> = {
  plugins: 'MicrosoftEdgePDFPluginPortableDocumentFormatinternal-pdf-viewer1,MicrosoftEdgePDFViewermhjfbmdgcfjbbpaeojofohoefgiehjai1',
  ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  canvas: '259ffe69',
  timezone: '-480',
  platform: 'Win32',
  url: 'https://www.skland.com/',
  referer: '',
  res: '1920_1080_24_1.25',
  clientSize: '0_0_1080_1920_1920_1080_1920_1080',
  status: '0011',
};

const UA_SKLAND =
  'Mozilla/5.0 (Linux; Android 12; SM-A5560 Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/101.0.4951.61 Safari/537.36; SKLand/1.52.1';

export interface CheckInAward {
  name: string;
  count: number;
}

export interface CheckInGameResult {
  success: boolean;
  game: string;
  nickname: string;
  channel: string;
  awards: CheckInAward[];
  error: string;
}

export interface CheckInUserResult {
  nickname: string;
  results: CheckInGameResult[];
}

function md5Hex(data: string): string {
  return CryptoJS.MD5(data).toString();
}

function uuidV4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function smid(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr =
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  const ruid = uuidV4();
  const v = `${timeStr}${md5Hex(ruid)}00`;
  const smsk = md5Hex(`smsk_web_${v}`);
  const suffix = smsk.slice(0, 14);
  return `${v}${suffix}0`;
}

// ─── RSA PKCS1v1.5 ───

function parseRsaPublicKeyDer(derBase64: string): { n: bigint; e: bigint } {
  const der = base64ToBytes(derBase64);
  let pos = 0;

  function readLength(): number {
    const b = der[pos++];
    if (b < 0x80) return b;
    const len = b & 0x7f;
    let val = 0;
    for (let i = 0; i < len; i++) {
      val = (val << 8) | der[pos++];
    }
    return val;
  }

  function skipTag(expected: number) {
    if (der[pos++] !== expected) throw new Error(`Expected tag ${expected}`);
  }

  // SEQUENCE
  skipTag(0x30);
  readLength();
  // SEQUENCE (algorithm)
  skipTag(0x30);
  const algLen = readLength();
  pos += algLen;
  // BIT STRING
  skipTag(0x03);
  readLength(); // BIT STRING length
  void der[pos++]; // unused bits (0)
  // SEQUENCE inside BIT STRING
  skipTag(0x30);
  readLength();
  // INTEGER n
  skipTag(0x02);
  const nLen = readLength();
  let nBytes = der.slice(pos, pos + nLen);
  pos += nLen;
  if (nBytes[0] === 0) nBytes = nBytes.slice(1); // strip leading zero
  const n = bytesToBigInt(nBytes);
  // INTEGER e
  skipTag(0x02);
  const eLen = readLength();
  const eBytes = der.slice(pos, pos + eLen);
  const e = bytesToBigInt(eBytes);
  return { n, e };
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  return BigInt('0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''));
}

function bigIntToBytes(value: bigint, byteLen: number): Uint8Array {
  const hex = value.toString(16).padStart(byteLen * 2, '0');
  const bytes = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function rsaPkcs1v15Encrypt(message: Uint8Array): Uint8Array {
  const pub = parseRsaPublicKeyDer(RSA_PUBLIC_KEY_B64);
  const k = 128; // 1024-bit key = 128 bytes
  const mLen = message.length;
  if (mLen > k - 11) throw new Error('Message too long');

  // PKCS#1 v1.5 padding
  const padded = new Uint8Array(k);
  padded[0] = 0x00;
  padded[1] = 0x02;
  for (let i = 2; i < k - mLen - 1; i++) {
    padded[i] = 1 + Math.floor(Math.random() * 255);
  }
  padded[k - mLen - 1] = 0x00;
  padded.set(message, k - mLen);

  const m = bytesToBigInt(padded);
  const c = modPow(m, pub.e, pub.n);
  return bigIntToBytes(c, k);
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

// ─── DES-ECB ───

function desEncryptEcbNullPad(key: string, data: string): string {
  const keyWordArray = CryptoJS.enc.Utf8.parse(key.padEnd(8, '\0').slice(0, 8));
  const dataWordArray = CryptoJS.enc.Utf8.parse(data);
  const encrypted = CryptoJS.DES.encrypt(dataWordArray, keyWordArray, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.ZeroPadding,
  });
  return encrypted.toString();
}

// ─── AES-128-CBC ───

function aes128CbcEncrypt(keyHex: string, data: Uint8Array): string {
  const iv = CryptoJS.enc.Utf8.parse('0102030405060708');  // 16 bytes ASCII
  const key = CryptoJS.enc.Utf8.parse(keyHex);             // 16 bytes ASCII
  const wordArray = CryptoJS.lib.WordArray.create(data);
  const b64 = CryptoJS.enc.Base64.stringify(wordArray);
  const padLen = (16 - (b64.length % 16)) % 16;
  let paddedStr = b64;
  if (padLen > 0) {
    paddedStr += '\0'.repeat(padLen);
  }
  const encrypted = CryptoJS.AES.encrypt(paddedStr, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.ciphertext.toString();
}

// ─── HMAC-SHA256 → MD5 ───

function generateSignature(token: string, path: string, bodyOrQuery: string, did: string): { sign: string; headerCa: Record<string, string> } {
  const ts = Math.floor(Date.now() / 1000);
  const headerCa = {
    platform: '3',
    timestamp: String(ts),
    dId: did,
    vName: '1.0.0',
  };
  const headerCaStr = JSON.stringify(headerCa);
  const s = `${path}${bodyOrQuery}${ts}${headerCaStr}`;
  const hmac = CryptoJS.HmacSHA256(s, token);
  const sign = md5Hex(hmac.toString());
  return { sign, headerCa };
}

// ─── Helpers ───

function base64ToBytes(b64: string): Uint8Array {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new Error('Invalid base64 input');
  }
}

function baseHeaders(did: string): Record<string, string> {
  return {
    'User-Agent': UA_SKLAND,
    'X-Requested-With': 'com.hypergryph.skland',
    dId: did,
  };
}

function signedHeaders(
  token: string,
  cred: string,
  url: string,
  method: string,
  body: string,
  did: string,
): Record<string, string> {
  const parsed = new URL(url);
  const path = parsed.pathname;
  const query = parsed.search.slice(1);

  const { sign, headerCa } =
    method === 'GET'
      ? generateSignature(token, path, query, did)
      : generateSignature(token, path, body, did);

  return {
    ...baseHeaders(did),
    cred,
    sign,
    ...headerCa,
  };
}

// ─── Device ID ───

async function getDeviceId(): Promise<string> {
  const uid = uuidV4();
  const priIdHash = CryptoJS.MD5(uid).toString().slice(0, 16);

  // RSA encrypt UUID
  const enc = new TextEncoder();
  const encryptedUid = rsaPkcs1v15Encrypt(enc.encode(uid));
  const epBase64 = btoa(String.fromCharCode(...encryptedUid));

  // Build fingerprint
  const inMs = Date.now();
  const target: Record<string, string | number> = {
    protocol: 102,
    organization: 'UWXspnCCJN4sfYlNfqps',
    appId: 'default',
    os: 'web',
    version: '3.0.0',
    sdkver: '3.0.0',
    box: '',
    rtype: 'all',
    subVersion: '1.0.0',
    time: 0,
    smid: smid(),
    vpw: uuidV4(),
    trees: uuidV4(),
    svm: inMs,
    pmf: inMs,
    ...BROWSER_ENV,
  };

  // Generate tn
  const sortedKeys = Object.keys(target).sort();
  let tnInput = '';
  for (const k of sortedKeys) {
    const v = target[k];
    if (typeof v === 'number') {
      tnInput += String(v * 10000);
    } else {
      tnInput += v;
    }
  }
  target['tn'] = md5Hex(tnInput);

  // Apply DES encryption
  const desResult: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(target)) {
    const strVal = String(value);
    const rule = DES_RULES[key];
    if (rule && rule.encrypt && rule.key) {
      desResult[rule.obf] = desEncryptEcbNullPad(rule.key, strVal);
    } else if (rule) {
      desResult[rule.obf] = value;
    } else {
      desResult[key] = value;
    }
  }

  // Gzip + AES
  const jsonStr = JSON.stringify(desResult);
  const compressed = pako.gzip(enc.encode(jsonStr), { level: 2 });
  const encrypted = aes128CbcEncrypt(priIdHash, compressed);

  // POST to deviceprofile
  const resp = await fetchImpl('https://fp-it.portal101.cn/deviceprofile/v4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: 'default',
      compress: 2,
      data: encrypted,
      encode: 5,
      ep: epBase64,
      organization: 'UWXspnCCJN4sfYlNfqps',
      os: 'web',
    }),
  });
  const json = await resp.json();
  if (json.code !== 1100 || !json.detail?.deviceId) {
    throw new Error(`Device ID generation failed: ${JSON.stringify(json)}`);
  }
  return `B${json.detail.deviceId}`;
}

// ─── Main check-in flow ───

export async function performCheckIn(userToken: string): Promise<CheckInUserResult[]> {
  if (!userToken || !userToken.trim()) {
    throw new Error('签到 Token 不能为空');
  }

  try {
    // 1. Device ID
    console.log('[skland] Getting device ID...');
    const did = await getDeviceId();

  // 2. Authorization
  console.log('[skland] Getting authorization...');
  let resp = await fetchImpl('https://as.hypergryph.com/user/oauth2/v2/grant', {
    method: 'POST',
    headers: { ...baseHeaders(did), 'Content-Type': 'application/json' },
    body: JSON.stringify({ appCode: '4ca99fa6b56cc2ba', token: userToken, type: 0 }),
  });
  let json = await resp.json();
  if (json.status !== 0) {
    throw new Error(`Authorization failed: ${json.msg || 'Unknown error'}`);
  }
  const authCode = json.data.code as string;

  // 3. Credential
  console.log('[skland] Getting credential...');
  resp = await fetchImpl('https://zonai.skland.com/web/v1/user/auth/generate_cred_by_code', {
    method: 'POST',
    headers: { ...baseHeaders(did), 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: authCode, kind: 1 }),
  });
  json = await resp.json();
  if (json.code !== 0) {
    throw new Error(`Credential failed: ${json.message || 'Unknown error'}`);
  }
  const credToken: string = json.data.token;
  const credVal: string = json.data.cred;

  // 4. Bindings
  console.log('[skland] Getting bindings...');
  const bindUrl = 'https://zonai.skland.com/api/v1/game/player/binding';
  resp = await fetchImpl(bindUrl, {
    headers: signedHeaders(credToken, credVal, bindUrl, 'GET', '', did),
  });
  json = await resp.json();
  if (json.code !== 0) {
    const msg = json.message || 'Unknown error';
    if (msg === '用户未登录') throw new Error('用户登录已过期，请重新登录');
    throw new Error(`获取绑定列表失败: ${msg}`);
  }

  const bindingList = (json.data?.list ?? []) as Array<{
    appCode: string;
    bindingList: Array<{
      nickName: string;
      channelName: string;
      uid: string;
      gameId: number;
      roles: Array<{ nickname: string; roleId: string; serverId: string }>;
    }>;
  }>;

  const allResults: CheckInUserResult[] = [];

  for (const item of bindingList) {
    const appCode = item.appCode;
    if (appCode !== 'arknights' && appCode !== 'endfield') continue;

    for (const binding of item.bindingList ?? []) {
      const nick = binding.nickName || 'Unknown';
      const channelName = binding.channelName || 'Unknown';

      if (appCode === 'arknights') {
        console.log(`[skland] Signing Arknights: ${nick}`);
        const akUrl = 'https://zonai.skland.com/api/v1/game/attendance';
        const akBody = JSON.stringify({ gameId: binding.gameId, uid: binding.uid });
        const akResp = await fetchImpl(akUrl, {
          method: 'POST',
          headers: { ...signedHeaders(credToken, credVal, akUrl, 'POST', akBody, did), 'Content-Type': 'application/json' },
          body: akBody,
        });
        const akJson = await akResp.json();
        const akCode = akJson.code as number;

        let result: CheckInGameResult;
        if (akCode !== 0) {
          const errMsg = (akJson.message as string) || 'Unknown error';
          const isAlready = ['已签到', '重复', 'already'].some((k) => errMsg.toLowerCase().includes(k) || errMsg.includes(k));
          if (isAlready) {
            result = { success: true, game: '明日方舟', nickname: nick, channel: channelName, awards: [], error: '已签到' };
          } else {
            result = { success: false, game: '明日方舟', nickname: nick, channel: channelName, awards: [], error: errMsg };
          }
        } else {
          const awards: CheckInAward[] = ((akJson.data?.awards ?? []) as Array<{ resource: { name: string }; count: number }>).map(
            (a) => ({ name: a.resource?.name ?? 'Unknown', count: a.count ?? 1 }),
          );
          result = { success: true, game: '明日方舟', nickname: nick, channel: channelName, awards, error: '' };
        }
        allResults.push({ nickname: nick, results: [result] });
      } else if (appCode === 'endfield') {
        console.log(`[skland] Signing Endfield: ${nick}`);
        const roles = binding.roles ?? [];
        if (roles.length === 0) {
          allResults.push({
            nickname: nick,
            results: [{ success: false, game: '终末地', nickname: nick, channel: channelName, awards: [], error: '没有角色数据' }],
          });
          continue;
        }

        const efUrl = 'https://zonai.skland.com/web/v1/game/endfield/attendance';
        const efResults: CheckInGameResult[] = [];

        for (const role of roles) {
          const roleNick = role.nickname?.trim() || nick || role.roleId;
          const efHeaders = {
            ...signedHeaders(credToken, credVal, efUrl, 'POST', '', did),
            'Content-Type': 'application/json',
            'sk-game-role': `3_${role.roleId}_${role.serverId}`,
            referer: 'https://game.skland.com/',
            origin: 'https://game.skland.com/',
          };
          const efResp = await fetchImpl(efUrl, { method: 'POST', headers: efHeaders });
          const efJson = await efResp.json();
          const efCode = efJson.code as number;

          if (efCode !== 0) {
            const errMsg = (efJson.message as string) || 'Unknown error';
            const isAlready = ['已签到', '重复', 'already'].some((k) => errMsg.toLowerCase().includes(k) || errMsg.includes(k));
            efResults.push({
              success: isAlready,
              game: '终末地',
              nickname: roleNick,
              channel: channelName,
              awards: [],
              error: isAlready ? '已签到' : errMsg,
            });
          } else {
            const awards: CheckInAward[] = [];
            const awardIds: Array<{ id: string }> = efJson.data?.awardIds ?? [];
            const resourceMap: Record<string, { name: string; count: number }> = efJson.data?.resourceInfoMap ?? {};
            for (const aid of awardIds) {
              const info = resourceMap[aid.id];
              if (info) awards.push({ name: info.name ?? 'Unknown', count: info.count ?? 1 });
            }
            efResults.push({ success: true, game: '终末地', nickname: roleNick, channel: channelName, awards, error: '' });
          }
        }
        allResults.push({ nickname: nick, results: efResults });
      }
    }
  }

  console.log(`[skland] Done. ${allResults.length} user(s) processed.`);
  return allResults;
  } catch (e) {
    console.error('[skland] Check-in failed:', e);
    throw e;
  }
}
