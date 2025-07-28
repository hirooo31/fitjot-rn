import React, { useState } from 'react';
import {
  View, Text, TextInput, Button, ScrollView,
  TouchableOpacity, StyleSheet, Keyboard, Platform, Modal
} from 'react-native';
import { saveRecord, getRecords } from '../utils/storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';

export default function AddRecordScreen() {
  const [sets, setSets] = useState([]);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [showDateOption, setShowDateOption] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);

  const handleChange = (index, field, value) => {
    const updated = [...sets];
    updated[index][field] = value;
    setSets(updated);
  };

  const handleAddSet = (type) => {
    const newSet = type === '筋トレ'
      ? { type, exercise: '', weight: '', reps: '', sets: '' }
      : { type, exercise: '', distance: '', time: '', sets: '' };
    setSets([...sets, newSet]);
    setModalVisible(false);
  };

  const handleRemoveSet = (index) => {
    const updated = [...sets];
    updated.splice(index, 1);
    setSets(updated);
  };

  const handleSubmit = () => {
    setShowDateOption(true);
    setShowPicker(false);
  };

  const isHalfWidthNumeric = (value) => /^\d+$/.test(value);

  const isSetValid = (set) => {
    if (!set.exercise.trim() || !isHalfWidthNumeric(set.sets)) return false;
    if (set.type === '筋トレ') {
      return isHalfWidthNumeric(set.weight) && isHalfWidthNumeric(set.reps);
    } else {
      return isHalfWidthNumeric(set.distance) && isHalfWidthNumeric(set.time);
    }
  };

  const submitWithDate = async (useToday) => {
    const finalDate = useToday ? dayjs().format('YYYY-MM-DD') : dayjs(tempDate).format('YYYY-MM-DD');

    for (const set of sets) {
      if (!isSetValid(set)) {
        alert('すべての必須項目は半角数字で入力してください');
        return;
      }
    }

    try {
      const newRecords = sets.map((set) => ({
        ...set,
        date: finalDate,
      }));
      for (const record of newRecords) {
        await saveRecord(record);
      }
      alert('記録を保存しました');
      setSets([]);
      Keyboard.dismiss();
    } catch (error) {
      console.error('記録保存に失敗しました:', error);
      alert('記録の保存に失敗しました');
    } finally {
      setShowDateOption(false);
      setShowPicker(false);
    }
  };

  const handleSave = async () => {
    try {
      const saved = await getRecords();
      console.log('現在の記録:', saved);
      alert('一時保存しました（Submitしないと一覧には表示されません）');
    } catch (error) {
      console.error('一時保存に失敗しました:', error);
      alert('一時保存に失敗しました');
    }
  };

  const onChangeDate = (event, selectedDate) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleNumericInput = (v, index, field) => {
    if (/^\d*$/.test(v)) {
      handleChange(index, field, v);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>トレーニング記録</Text>

      {sets.map((set, index) => (
        <View key={index} style={styles.setBlock}>
          <Text style={styles.setType}>{set.type}</Text>
          <TextInput
            placeholder="種目"
            value={set.exercise}
            onChangeText={(v) => handleChange(index, 'exercise', v)}
            style={styles.input}
            returnKeyType="done"
          />
          {set.type === '筋トレ' ? (
            <>
              <TextInput
                placeholder="重さ(kg)"
                value={set.weight}
                onChangeText={(v) => handleNumericInput(v, index, 'weight')}
                style={styles.input}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <TextInput
                placeholder="回数"
                value={set.reps}
                onChangeText={(v) => handleNumericInput(v, index, 'reps')}
                style={styles.input}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </>
          ) : (
            <>
              <TextInput
                placeholder="距離(km)"
                value={set.distance}
                onChangeText={(v) => handleNumericInput(v, index, 'distance')}
                style={styles.input}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <TextInput
                placeholder="時間(分)"
                value={set.time}
                onChangeText={(v) => handleNumericInput(v, index, 'time')}
                style={styles.input}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </>
          )}
          <TextInput
            placeholder="セット数"
            value={set.sets}
            onChangeText={(v) => handleNumericInput(v, index, 'sets')}
            style={styles.input}
            keyboardType="numeric"
            returnKeyType="done"
          />
          {sets.length > 0 && (
            <TouchableOpacity onPress={() => handleRemoveSet(index)}>
              <Text style={styles.delete}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Button title="追加" onPress={() => setModalVisible(true)} />
      <View style={styles.buttonRow}>
        <Button title="保存" onPress={handleSave} />
        <Button title="Submit" onPress={handleSubmit} />
      </View>

      {showDateOption && (
        <View style={styles.dateOptionContainer}>
          <Text style={styles.title}>日付の選択</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity style={styles.radioOption} onPress={() => submitWithDate(true)}>
              <Text style={styles.radioSelected}>●</Text>
              <Text style={styles.radioLabel}>今日で記録</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.radioOption} onPress={() => setShowPicker(true)}>
              <Text style={styles.radioSelected}>●</Text>
              <Text style={styles.radioLabel}>日付を指定する</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showPicker && (
        <View>
          <Text style={styles.dateText}>選択中: {dayjs(tempDate).format('YYYY-MM-DD')}</Text>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            onChange={onChangeDate}
          />
          <Button title="この日付で記録" onPress={() => submitWithDate(false)} />
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>記録タイプを選択</Text>
            <Button title="筋トレ" onPress={() => handleAddSet('筋トレ')} />
            <Button title="有酸素" onPress={() => handleAddSet('有酸素')} />
            <Button title="キャンセル" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 15,
    fontWeight: 'bold',
  },
  setBlock: {
    marginBottom: 15,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#ccc',
    backgroundColor: '#fafafa'
  },
  setType: {
    fontWeight: 'bold',
    marginBottom: 5
  },
  input: {
    borderWidth: 1,
    padding: 5,
    borderRadius: 5,
    marginBottom: 10
  },
  delete: {
    color: 'red',
    fontSize: 18,
    alignSelf: 'flex-end',
  },
  buttonRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  radioGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 15,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  radioSelected: {
    fontSize: 18,
    color: 'black',
  },
  radioLabel: {
    fontSize: 16,
  },
  dateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  dateOptionContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8
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