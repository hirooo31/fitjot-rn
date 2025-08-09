// utils/storage.js
import LegacyAsyncStorage from '@react-native-async-storage/async-storage';
import Storage from 'expo-sqlite/kv-store';

const RECORDS_KEY = 'trainingRecords';
const WEEKLY_KEY = 'weeklyMenu';
const MIGRATED_FLAG = 'kv_migrated_v1';

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

export async function migrateFromAsyncStorage() {
  try {
    if (Storage.getItemSync(MIGRATED_FLAG)) return;

    const [rj, wj] = await Promise.all([
      LegacyAsyncStorage.getItem(RECORDS_KEY),
      LegacyAsyncStorage.getItem(WEEKLY_KEY),
    ]);

    const fromASRecords = rj ? JSON.parse(rj) : [];
    const fromASWeekly = wj ? JSON.parse(wj) : {};

    setJSON(RECORDS_KEY, fromASRecords.map(withIdIfMissing));
    setJSON(WEEKLY_KEY, fromASWeekly);

    await Promise.all([
      LegacyAsyncStorage.removeItem(RECORDS_KEY),
      LegacyAsyncStorage.removeItem(WEEKLY_KEY),
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
