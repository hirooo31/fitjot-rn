import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, Button, ScrollView,
  TouchableOpacity, Alert, StyleSheet, Modal
} from 'react-native';
import { getWeeklyMenu, saveWeeklyMenu, saveRecord } from '../utils/storage';

const weekdays = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

export default function WeeklyMenuScreen({ navigation }) {
  const [menu, setMenu] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setModalVisible(true)} style={{ marginRight: 15 }}>
          <Text style={{ fontSize: 24 }}>＋</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getWeeklyMenu();
        if (data) setMenu(data);
      } catch (error) {
        console.error('メニュー取得エラー:', error);
        Alert.alert('エラー', 'メニューの取得に失敗しました');
      }
    })();
  }, []);

  const persistMenu = async (newMenu) => {
    try {
      setMenu(newMenu);
      await saveWeeklyMenu(newMenu);
    } catch (error) {
      console.error('メニュー保存エラー:', error);
      Alert.alert('エラー', 'メニューの保存に失敗しました');
    }
  };

  const handleDaySelect = (day) => {
    if (menu[day]) {
      Alert.alert('エラー', `${day} はすでに存在します`);
      return;
    }
    setSelectedDay(day);
    setTypeModalVisible(true);
    setModalVisible(false);
  };

  const handleAddType = (type) => {
    const newSet = type === '筋トレ'
      ? [{ type, exercise: '', weight: '', reps: '', sets: '' }]
      : [{ type, exercise: '', distance: '', time: '', sets: '' }];
    const newMenu = { ...menu, [selectedDay]: newSet };
    persistMenu(sortMenu(newMenu));
    setTypeModalVisible(false);
    setSelectedDay(null);
  };

  const handleChange = (day, index, field, value) => {
    const updatedDay = [...menu[day]];
    updatedDay[index][field] = value;
    const newMenu = { ...menu, [day]: updatedDay };
    persistMenu(newMenu);
  };

  const handleAddSet = (day) => {
    const base = menu[day][0]?.type === '筋トレ'
      ? { type: '筋トレ', exercise: '', weight: '', reps: '', sets: '' }
      : { type: '有酸素', exercise: '', distance: '', time: '', sets: '' };
    const updatedDay = [...menu[day], base];
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

    try {
      for (const set of sets) {
        await saveRecord({ ...set, day, date: today });
      }
      Alert.alert(`${day}のメニューを記録しました`);
    } catch (error) {
      console.error(`${day}の記録保存エラー:`, error);
      Alert.alert('エラー', `${day}のメニュー記録に失敗しました`);
    }
  };

  return (
    <ScrollView style={{ padding: 20 }}>
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
              <Text style={{ fontWeight: 'bold' }}>{set.type}</Text>
              <TextInput
                placeholder="種目"
                value={set.exercise}
                onChangeText={(v) => handleChange(day, idx, 'exercise', v)}
                style={styles.input}
              />
              {set.type === '筋トレ' ? (
                <>
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
                </>
              ) : (
                <>
                  <TextInput
                    placeholder="距離(km)"
                    value={set.distance}
                    onChangeText={(v) => handleChange(day, idx, 'distance', v)}
                    style={styles.input}
                    keyboardType="numeric"
                  />
                  <TextInput
                    placeholder="時間(分)"
                    value={set.time}
                    onChangeText={(v) => handleChange(day, idx, 'time', v)}
                    style={styles.input}
                    keyboardType="numeric"
                  />
                </>
              )}
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

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.cardTitle}>曜日を選択</Text>
            {weekdays.map(day => (
              <Button key={day} title={day} onPress={() => handleDaySelect(day)} />
            ))}
            <Button title="キャンセル" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={typeModalVisible}
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.cardTitle}>種別を選択</Text>
            <Button title="筋トレ" onPress={() => handleAddType('筋トレ')} />
            <Button title="有酸素" onPress={() => handleAddType('有酸素')} />
            <Button title="キャンセル" onPress={() => setTypeModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '80%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    gap: 10
  }
});