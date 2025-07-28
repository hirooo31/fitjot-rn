import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, Button, ScrollView,
  TouchableOpacity, Alert, StyleSheet
} from 'react-native';
import { getWeeklyMenu, saveWeeklyMenu, saveRecord } from '../utils/storage';

const weekdays = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

export default function WeeklyMenuScreen({ navigation }) {
  const [menu, setMenu] = useState({});
  const [showDaySelector, setShowDaySelector] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setShowDaySelector(!showDaySelector)} style={{ marginRight: 15 }}>
          <Text style={{ fontSize: 24 }}>＋</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, showDaySelector]);

  useEffect(() => {
    (async () => {
      const data = await getWeeklyMenu();
      if (data) setMenu(data);
    })();
  }, []);

  const persistMenu = (newMenu) => {
    setMenu(newMenu);
    saveWeeklyMenu(newMenu);
  };

  const handleAddDay = (day) => {
    if (menu[day]) {
      Alert.alert('エラー', `${day} はすでに存在します`);
      return;
    }
    const newMenu = { ...menu, [day]: [{ exercise: '', weight: '', reps: '', sets: '' }] };
    persistMenu(sortMenu(newMenu));
    setShowDaySelector(false);
  };

  const handleChange = (day, index, field, value) => {
    const updatedDay = [...menu[day]];
    updatedDay[index][field] = value;
    const newMenu = { ...menu, [day]: updatedDay };
    persistMenu(newMenu);
  };

  const handleAddSet = (day) => {
    const updatedDay = [...menu[day], { exercise: '', weight: '', reps: '', sets: '' }];
    const newMenu = { ...menu, [day]: updatedDay };
    persistMenu(newMenu);
  };

  const handleRemoveSet = (day, index) => {
    const updatedDay = [...menu[day]];
    updatedDay.splice(index, 1);
    const newMenu = { ...menu, [day]: updatedDay };
    persistMenu(newMenu);
  };

  const handleRemoveDay = (day) => {
    const newMenu = { ...menu };
    delete newMenu[day];
    persistMenu(sortMenu(newMenu));
  };

  const sortMenu = (menuObj) => {
    const sorted = {};
    weekdays.forEach(day => {
      if (menuObj[day]) {
        sorted[day] = menuObj[day];
      }
    });
    return sorted;
  };

  const handleSubmitDay = async (day) => {
    const today = new Date().toISOString().slice(0, 10);
    const sets = menu[day];

    for (const set of sets) {
      await saveRecord({ ...set, day, date: today });
    }

    Alert.alert(`${day}のメニューを記録しました`);
  };

  return (
    <ScrollView style={{ padding: 20 }}>
      {showDaySelector &&
        weekdays.map((day) => (
          <TouchableOpacity key={day} onPress={() => handleAddDay(day)} style={styles.dayButton}>
            <Text>{day}</Text>
          </TouchableOpacity>
        ))
      }

      {Object.entries(menu).map(([day, sets]) => (
        <View key={day} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{day}</Text>
            <TouchableOpacity onPress={() => handleRemoveDay(day)}>
              <Text style={styles.delete}>🗑</Text>
            </TouchableOpacity>
          </View>
          {sets.map((set, idx) => (
            <View key={idx} style={styles.setBlock}>
              <TextInput
                placeholder="種目"
                value={set.exercise}
                onChangeText={(v) => handleChange(day, idx, 'exercise', v)}
                style={styles.input}
              />
              <TextInput
                placeholder="重さ(kg)"
                value={set.weight}
                onChangeText={(v) => handleChange(day, idx, 'weight', v)}
                style={styles.input}
                keyboardType="numeric"
              />
              <TextInput
                placeholder="回数"
                value={set.reps}
                onChangeText={(v) => handleChange(day, idx, 'reps', v)}
                style={styles.input}
                keyboardType="numeric"
              />
              <TextInput
                placeholder="セット数"
                value={set.sets}
                onChangeText={(v) => handleChange(day, idx, 'sets', v)}
                style={styles.input}
                keyboardType="numeric"
              />
              <TouchableOpacity onPress={() => handleRemoveSet(day, idx)}>
                <Text style={styles.delete}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Button title="セット追加" onPress={() => handleAddSet(day)} />
          <Button title="記録送信" onPress={() => handleSubmitDay(day)} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dayButton: {
    padding: 10,
    backgroundColor: '#eee',
    marginVertical: 5,
    borderRadius: 5,
    alignItems: 'center',
  },
  card: {
    padding: 15,
    marginBottom: 20,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  delete: {
    color: 'red',
    fontSize: 18,
  },
  setBlock: {
    marginBottom: 10,
    gap: 5
  },
  input: {
    borderWidth: 1,
    padding: 5,
    borderRadius: 5,
    marginBottom: 5,
  },
});
