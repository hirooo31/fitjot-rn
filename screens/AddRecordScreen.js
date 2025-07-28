import React, { useState } from 'react';
import {
  View, Text, TextInput, Button, ScrollView,
  TouchableOpacity, StyleSheet, Keyboard, Platform
} from 'react-native';
import { saveRecord, getRecords } from '../utils/storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';

export default function AddRecordScreen() {
  const [sets, setSets] = useState([{ exercise: '', weight: '', reps: '', sets: '' }]);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [showDateOption, setShowDateOption] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const handleChange = (index, field, value) => {
    const updated = [...sets];
    updated[index][field] = value;
    setSets(updated);
  };

  const handleAddSet = () => {
    setSets([...sets, { exercise: '', weight: '', reps: '', sets: '' }]);
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

  const submitWithDate = async (useToday) => {
    const finalDate = useToday ? dayjs().format('YYYY-MM-DD') : dayjs(tempDate).format('YYYY-MM-DD');
    const newRecords = sets.map((set) => ({
      ...set,
      date: finalDate,
    }));
    for (const record of newRecords) {
      await saveRecord(record);
    }
    alert('記録を保存しました');
    setSets([{ exercise: '', weight: '', reps: '', sets: '' }]);
    Keyboard.dismiss();
    setShowDateOption(false);
    setShowPicker(false);
  };

  const handleSave = async () => {
    const saved = await getRecords();
    console.log('現在の記録:', saved);
    alert('一時保存しました（Submitしないと一覧には表示されません）');
  };

  const onChangeDate = (event, selectedDate) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>トレーニング記録</Text>

      {sets.map((set, index) => (
        <View key={index} style={styles.setBlock}>
          <TextInput
            placeholder="種目"
            value={set.exercise}
            onChangeText={(v) => handleChange(index, 'exercise', v)}
            style={styles.input}
            returnKeyType="done"
          />
          <TextInput
            placeholder="重さ(kg)"
            value={set.weight}
            onChangeText={(v) => handleChange(index, 'weight', v)}
            style={styles.input}
            keyboardType="numeric"
            returnKeyType="done"
          />
          <TextInput
            placeholder="回数"
            value={set.reps}
            onChangeText={(v) => handleChange(index, 'reps', v)}
            style={styles.input}
            keyboardType="numeric"
            returnKeyType="done"
          />
          <TextInput
            placeholder="セット数"
            value={set.sets}
            onChangeText={(v) => handleChange(index, 'sets', v)}
            style={styles.input}
            keyboardType="numeric"
            returnKeyType="done"
          />
          {sets.length > 1 && (
            <TouchableOpacity onPress={() => handleRemoveSet(index)}>
              <Text style={styles.delete}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Button title="追加" onPress={handleAddSet} />
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
  }
});
