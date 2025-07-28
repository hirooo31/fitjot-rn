import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Modal, TextInput, Button, Platform, Alert
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getRecords } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';

export default function HomeScreen() {
  const [groupedRecords, setGroupedRecords] = useState({});
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editIndex, setEditIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      loadRecords();
    }, [])
  );

  const loadRecords = async () => {
    try {
      const records = await getRecords();
      const grouped = {};
      records.forEach(r => {
        const date = r.date;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(r);
      });
      setGroupedRecords(grouped);
    } catch (error) {
      Alert.alert('エラー', '記録の読み込みに失敗しました');
      console.error('loadRecords error:', error);
    }
  };

  const handleDelete = async (date, index) => {
    try {
      const allRecords = await getRecords();
      const target = JSON.stringify(groupedRecords[date][index]);
      const updated = allRecords.filter(r => JSON.stringify(r) !== target);
      await AsyncStorage.setItem('trainingRecords', JSON.stringify(updated));
      loadRecords();
    } catch (error) {
      Alert.alert('エラー', '削除に失敗しました');
      console.error('handleDelete error:', error);
    }
  };

  const openEditModal = (date, index) => {
    const record = groupedRecords[date][index];
    setEditRecord({ ...record });
    setEditDate(date);
    setEditIndex(index);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      const allRecords = await getRecords();
      const target = JSON.stringify(groupedRecords[editDate][editIndex]);
      const updated = allRecords.map(r => {
        if (JSON.stringify(r) === target) {
          return editRecord;
        }
        return r;
      });
      await AsyncStorage.setItem('trainingRecords', JSON.stringify(updated));
      setEditModalVisible(false);
      loadRecords();
    } catch (error) {
      Alert.alert('エラー', '編集の保存に失敗しました');
      console.error('handleSaveEdit error:', error);
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setEditRecord({ ...editRecord, date: dayjs(selectedDate).format('YYYY-MM-DD') });
    }
  };

  const filteredEntries = Object.entries(groupedRecords)
    .filter(([_, records]) => {
      const query = searchQuery.toLowerCase();
      return records.some(r =>
        (r.exercise && r.exercise.toLowerCase().includes(query))
      );
    });

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="検索（種目名）"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
          returnKeyType="done"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {filteredEntries.map(([date, items]) => (
        <View key={date} style={styles.recordGroup}>
          <Text style={styles.date}>{date}</Text>
          {items.map((r, i) => (
            <View key={i} style={styles.recordItemRow}>
              <Text style={styles.recordItem}>
                - {r.exercise} {r.weight ? `${r.weight}kg × ` : ''}{r.reps || ''}{r.reps ? '回' : ''}{r.sets ? ` × ${r.sets}セット` : ''}
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity onPress={() => openEditModal(date, i)}>
                  <Text style={styles.edit}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(date, i)}>
                  <Text style={styles.delete}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ))}

      <Modal visible={editModalVisible} animationType="slide">
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>記録を編集</Text>

          <Text style={styles.label}>📅 日付を選択</Text>
          <DateTimePicker
            value={editRecord?.date ? new Date(editRecord.date) : new Date()}
            mode="date"
            display="spinner"
            onChange={onDateChange}
            style={{ marginBottom: 20 }}
          />

          <TextInput
            placeholder="種目"
            value={editRecord?.exercise}
            onChangeText={(v) => setEditRecord({ ...editRecord, exercise: v })}
            style={styles.input}
            returnKeyType="done"
          />
          <TextInput
            placeholder="重さ(kg)"
            value={editRecord?.weight}
            onChangeText={(v) => setEditRecord({ ...editRecord, weight: v })}
            style={styles.input}
            keyboardType="numeric"
            returnKeyType="done"
          />
          <TextInput
            placeholder="回数"
            value={editRecord?.reps}
            onChangeText={(v) => setEditRecord({ ...editRecord, reps: v })}
            style={styles.input}
            keyboardType="numeric"
            returnKeyType="done"
          />
          <TextInput
            placeholder="セット数"
            value={editRecord?.sets}
            onChangeText={(v) => setEditRecord({ ...editRecord, sets: v })}
            style={styles.input}
            keyboardType="numeric"
            returnKeyType="done"
          />
          <View style={styles.modalButtons}>
            <Button title="キャンセル" onPress={() => setEditModalVisible(false)} />
            <Button title="保存" onPress={handleSaveEdit} />
          </View>
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchBar: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    borderRadius: 5,
  },
  clearButton: {
    marginLeft: 10,
    paddingHorizontal: 10,
  },
  clearButtonText: {
    fontSize: 18,
    color: 'gray',
  },
  recordGroup: {
    marginBottom: 20,
  },
  date: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  recordItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  recordItem: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  delete: {
    color: 'red',
    fontSize: 18,
    marginLeft: 10,
  },
  edit: {
    color: 'blue',
    fontSize: 18,
    marginRight: 10,
  },
  modalContent: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 20,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
});
