import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORDS_KEY = 'trainingRecords';
const WEEKLY_KEY = 'weeklyMenu';

export async function getRecords() {
  try {
    const json = await AsyncStorage.getItem(RECORDS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('getRecords failed:', error);
    return [];
  }
}

export async function saveRecord(record) {
  try {
    const records = await getRecords();
    records.push(record);
    await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('saveRecord failed:', error);
  }
}

export async function getWeeklyMenu() {
  try {
    const json = await AsyncStorage.getItem(WEEKLY_KEY);
    return json ? JSON.parse(json) : {};
  } catch (error) {
    console.error('getWeeklyMenu failed:', error);
    return {};
  }
}

export async function saveWeeklyMenu(menu) {
  try {
    await AsyncStorage.setItem(WEEKLY_KEY, JSON.stringify(menu));
  } catch (error) {
    console.error('saveWeeklyMenu failed:', error);
  }
}
