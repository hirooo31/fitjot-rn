import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORDS_KEY = 'trainingRecords';
const WEEKLY_KEY = 'weeklyMenu';

export async function getRecords() {
  const json = await AsyncStorage.getItem(RECORDS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveRecord(record) {
  const records = await getRecords();
  records.push(record);
  await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export async function getWeeklyMenu() {
  const json = await AsyncStorage.getItem(WEEKLY_KEY);
  return json ? JSON.parse(json) : {};
}

export async function saveWeeklyMenu(menu) {
  await AsyncStorage.setItem(WEEKLY_KEY, JSON.stringify(menu));
}
