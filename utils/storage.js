// utils/storage.js
import LegacyAsyncStorage from '@react-native-async-storage/async-storage';
import Storage from 'expo-sqlite/kv-store';

const RECORDS_KEY = 'trainingRecords';
const WEEKLY_KEY = 'weeklyMenu';
const MIGRATED_FLAG = 'kv_migrated_v1';

// 最近セット（履歴）用
const RECENT_KEY = 'recentSets_v1';
const RECENT_CAP = 20;

function getJSON(key, fallback) {
  const v = Storage.getItemSync(key);
  return v ? JSON.parse(v) : fallback;
}
function setJSON(key, value) {
  Storage.setItemSync(key, JSON.stringify(value));
}
function withIdIfMissing(r) {
  return r.id ? r : { id: genId(), ...r };
}
function genId() {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// 最近セット用の同一判定キー
function recentSig(s) {
  return [
    s.type || '',
    s.exercise || '',
    s.weight || '',
    s.reps || '',
    s.distance || '',
    s.time || '',
    s.sets || '',
  ].join('|');
}

export async function migrateFromAsyncStorage() {
  try {
    if (Storage.getItemSync(MIGRATED_FLAG)) return;

    const [rj, wj, recent] = await Promise.all([
      LegacyAsyncStorage.getItem(RECORDS_KEY),
      LegacyAsyncStorage.getItem(WEEKLY_KEY),
      // 以前の実装でAsyncStorageを使っていた場合の移行（存在すれば）
      LegacyAsyncStorage.getItem('@recent_sets_v1'),
    ]);

    const fromASRecords = rj ? JSON.parse(rj) : [];
    const fromASWeekly = wj ? JSON.parse(wj) : {};
    const fromASRecents = recent ? JSON.parse(recent) : [];

    setJSON(RECORDS_KEY, fromASRecords.map(withIdIfMissing));
    setJSON(WEEKLY_KEY, fromASWeekly);
    if (fromASRecents && Array.isArray(fromASRecents)) {
      setJSON(RECENT_KEY, fromASRecents);
    }

    await Promise.all([
      LegacyAsyncStorage.removeItem(RECORDS_KEY),
      LegacyAsyncStorage.removeItem(WEEKLY_KEY),
      LegacyAsyncStorage.removeItem('@recent_sets_v1'),
    ]);

    Storage.setItemSync(MIGRATED_FLAG, '1');
  } catch {}
}

export async function getRecords({ search } = {}) {
  const all = getJSON(RECORDS_KEY, []);
  if (!search || !search.trim()) return all;
  const q = search.toLowerCase();
  return all.filter((r) => (r.exercise || '').toLowerCase().includes(q));
}

export async function saveRecord(record) {
  const all = getJSON(RECORDS_KEY, []);
  const withId = withIdIfMissing(record);
  all.push(withId);
  setJSON(RECORDS_KEY, all);
  return withId;
}

export async function updateRecordById(id, patch) {
  const all = getJSON(RECORDS_KEY, []);
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...patch, id };
  setJSON(RECORDS_KEY, all);
}

export async function deleteRecordById(id) {
  const all = getJSON(RECORDS_KEY, []);
  const next = all.filter((r) => r.id !== id);
  setJSON(RECORDS_KEY, next);
}

export async function getWeeklyMenu() {
  return getJSON(WEEKLY_KEY, {});
}

export async function saveWeeklyMenu(menu) {
  setJSON(WEEKLY_KEY, menu);
}

/* =========================
   最近セット（履歴）
   ========================= */

// 先頭に追加し、同内容は重複排除。最大RECENT_CAP件保持。
export async function addRecentSet(set) {
  try {
    const list = getJSON(RECENT_KEY, []);
    const entry = { ...set, _at: Date.now() };
    const sig = recentSig(entry);
    const deduped = [entry, ...list.filter((x) => recentSig(x) !== sig)].slice(0, RECENT_CAP);
    setJSON(RECENT_KEY, deduped);
  } catch {}
}

// 直近順にlimit件返す（_atの降順）。_atは返却時に除外。
export async function getRecentSets(limit = 12) {
  try {
    const list = getJSON(RECENT_KEY, []);
    const sorted = [...list].sort((a, b) => (b._at || 0) - (a._at || 0));
    return sorted.slice(0, limit).map(({ _at, ...rest }) => rest);
  } catch {
    return [];
  }
}
