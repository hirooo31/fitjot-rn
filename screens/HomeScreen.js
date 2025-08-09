// screens/HomeScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  useColorScheme,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import dayjs from 'dayjs';
import { getRecords, updateRecordById, deleteRecordById } from '../utils/storage';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // Design tokens (メニュー/記録画面と同トーン)
  const C = {
    light: {
      bg: '#f6f6f6',
      card: '#ffffff',
      text: '#0f0f0f',
      sub: '#5a5a5a',
      border: '#e7e7e7',
      inputBg: '#ffffff',
      inputBorder: '#dddddd',
      ghostBg: 'rgba(0,0,0,0.03)',
      black: '#111111',
      accent: '#E87722',
      accentSoft: 'rgba(232,119,34,0.12)',
      shadow: '#bdbdbd',
      danger: '#d11a2a',
    },
    dark: {
      bg: '#0e0e0e',
      card: '#151515',
      text: '#f3f3f3',
      sub: '#a9a9a9',
      border: '#242424',
      inputBg: '#121212',
      inputBorder: '#2a2a2a',
      ghostBg: 'rgba(255,255,255,0.05)',
      black: '#fafafa',
      accent: '#E87722',
      accentSoft: 'rgba(232,119,34,0.2)',
      shadow: '#000000',
      danger: '#ff5f6d',
    },
  }[isDark ? 'dark' : 'light'];

  const [groupedRecords, setGroupedRecords] = useState({});
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [searchQuery])
  );

  const loadRecords = async () => {
    try {
      const records = await getRecords({ search: searchQuery });
      const grouped = {};
      records.forEach((r) => {
        const date = r.date || '未設定';
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(r);
      });
      // 日付降順 → 同日中は新しいIDから
      Object.keys(grouped).forEach((k) => {
        grouped[k].sort((a, b) => (a.id > b.id ? -1 : 1));
      });
      const sorted = Object.fromEntries(
        Object.entries(grouped).sort(([a], [b]) => (a > b ? -1 : 1))
      );
      setGroupedRecords(sorted);
    } catch {
      Alert.alert('エラー', '記録の読み込みに失敗しました');
    }
  };

  const handleDelete = async (date, index) => {
    try {
      const target = groupedRecords[date][index];
      await deleteRecordById(target.id);
      await loadRecords();
    } catch {
      Alert.alert('エラー', '削除に失敗しました');
    }
  };

  const openEditModal = (date, index) => {
    const record = groupedRecords[date][index];
    setEditRecord({ ...record });
    setEditModalVisible(true);
  };

  const isNum = (v) => /^\d+$/.test((v ?? '').toString());
  const onDateChange = (_event, selectedDate) => {
    if (selectedDate) {
      setEditRecord((p) => ({ ...p, date: dayjs(selectedDate).format('YYYY-MM-DD') }));
    }
  };

  const handleSaveEdit = async () => {
    if (!editRecord?.exercise?.trim()) {
      Alert.alert('入力エラー', '種目を入力してください');
      return;
    }
    if (editRecord.type === '筋トレ') {
      if (!isNum(editRecord.weight) || !isNum(editRecord.reps)) {
        Alert.alert('入力エラー', '重さ・回数は半角数字で入力してください');
        return;
      }
    } else if (editRecord.type === '有酸素') {
      if (!isNum(editRecord.distance) || !isNum(editRecord.time)) {
        Alert.alert('入力エラー', '距離・時間は半角数字で入力してください');
        return;
      }
    }
    if (!isNum(editRecord.sets)) {
      Alert.alert('入力エラー', 'セット数は半角数字で入力してください');
      return;
    }

    try {
      await updateRecordById(editRecord.id, editRecord);
      setEditModalVisible(false);
      loadRecords();
    } catch {
      Alert.alert('エラー', '編集の保存に失敗しました');
    }
  };

  const clearSearch = () => setSearchQuery('');

  const filteredEntries = Object.entries(groupedRecords).filter(([_, records]) =>
    records.some((r) => (r.exercise || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderSubtitle = (r) => {
    if (r.type === '筋トレ') {
      const core = [r.weight ? `${r.weight}kg` : null, r.reps ? `${r.reps}回` : null]
        .filter(Boolean)
        .join(' × ');
      const sets = r.sets ? ` × ${r.sets}セット` : '';
      return [core, sets].filter(Boolean).join('');
    }
    const core = [r.distance ? `${r.distance}km` : null, r.time ? `${r.time}分` : null]
      .filter(Boolean)
      .join(' · ');
    const sets = r.sets ? ` × ${r.sets}セット` : '';
    return [core, sets].filter(Boolean).join('');
  };

  const isEmpty = filteredEntries.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: C.bg }]}>
      {/* Search row */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <View style={{ position: 'relative' }}>
          <TextInput
            placeholder="検索（種目名）"
            placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[
              styles.searchBar,
              { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text },
            ]}
            returnKeyType="search"
          />
          {searchQuery?.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Ionicons name="close" size={18} color={C.sub} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {isEmpty ? (
          // 空データ時プレースホルダ
          <View style={styles.emptyWrap}>
            <Ionicons name="server-outline" size={48} color={C.sub} />
            <Text style={[styles.emptyTitle, { color: C.sub }]}>記録はまだありません</Text>
            <Text style={[styles.emptyText, { color: C.sub }]}>別の画面から記録を追加してください</Text>
          </View>
        ) : (
          filteredEntries.map(([date, items]) => (
            <View key={date} style={{ marginBottom: 10 }}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: C.sub }]}>
                  {dayjs(date).isValid() ? dayjs(date).format('YYYY/MM/DD (ddd)') : date}
                </Text>
              </View>

              {items.map((r, i) => (
                <View
                  key={r.id ?? i}
                  style={[
                    styles.card,
                    { backgroundColor: C.card, borderColor: C.border, shadowColor: C.shadow },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: C.text }]}>{r.exercise || r.type}</Text>
                    {!!renderSubtitle(r) && (
                      <Text style={[styles.itemSub, { color: C.sub }]}>{renderSubtitle(r)}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => openEditModal(date, i)}
                      style={[styles.iconBtn, { borderColor: C.border, backgroundColor: C.ghostBg }]}
                    >
                      <Ionicons name="create-outline" size={18} color={C.black} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(date, i)}
                      style={[styles.iconBtn, { borderColor: C.border, backgroundColor: C.ghostBg }]}
                    >
                      <Ionicons name="trash-outline" size={18} color={C.black} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* 編集モーダル */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>記録を編集</Text>

            <Text style={[styles.label, { color: C.sub }]}>📅 日付を選択</Text>
            <DateTimePicker
              value={editRecord?.date ? new Date(editRecord.date) : new Date()}
              mode="date"
              display="spinner"
              onChange={onDateChange}
              style={{ marginBottom: 12, alignSelf: 'center' }}
            />

            <View style={styles.formGrid}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: C.sub }]}>種目</Text>
                <TextInput
                  placeholder="例: ベンチプレス / ランニング"
                  placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                  value={editRecord?.exercise ?? ''}
                  onChangeText={(v) => setEditRecord((p) => ({ ...p, exercise: v }))}
                  style={[
                    styles.input,
                    { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text },
                  ]}
                  returnKeyType="done"
                />
              </View>

              {editRecord?.type === '有酸素' ? (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>距離(km)</Text>
                    <TextInput
                      placeholder="5"
                      keyboardType="numeric"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={editRecord?.distance ?? ''}
                      onChangeText={(v) => /^\d*$/.test(v) && setEditRecord((p) => ({ ...p, distance: v }))}
                      style={[
                        styles.input,
                        { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text },
                      ]}
                      returnKeyType="done"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>時間(分)</Text>
                    <TextInput
                      placeholder="30"
                      keyboardType="numeric"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={editRecord?.time ?? ''}
                      onChangeText={(v) => /^\d*$/.test(v) && setEditRecord((p) => ({ ...p, time: v }))}
                      style={[
                        styles.input,
                        { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text },
                      ]}
                      returnKeyType="done"
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>重さ(kg)</Text>
                    <TextInput
                      placeholder="60"
                      keyboardType="numeric"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={editRecord?.weight ?? ''}
                      onChangeText={(v) => /^\d*$/.test(v) && setEditRecord((p) => ({ ...p, weight: v }))}
                      style={[
                        styles.input,
                        { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text },
                      ]}
                      returnKeyType="done"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>回数</Text>
                    <TextInput
                      placeholder="10"
                      keyboardType="numeric"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={editRecord?.reps ?? ''}
                      onChangeText={(v) => /^\d*$/.test(v) && setEditRecord((p) => ({ ...p, reps: v }))}
                      style={[
                        styles.input,
                        { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text },
                      ]}
                      returnKeyType="done"
                    />
                  </View>
                </>
              )}

              <View style={styles.field}>
                <Text style={[styles.label, { color: C.sub }]}>セット数</Text>
                <TextInput
                  placeholder="3"
                  keyboardType="numeric"
                  placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                  value={editRecord?.sets ?? ''}
                  onChangeText={(v) => /^\d*$/.test(v) && setEditRecord((p) => ({ ...p, sets: v }))}
                  style={[
                    styles.input,
                    { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text },
                  ]}
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={[
                  styles.ghostBtn,
                  { borderColor: C.border, backgroundColor: C.ghostBg },
                ]}
              >
                <Text style={{ color: C.sub }}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                style={[
                  styles.primaryBtn,
                  { borderColor: C.border, backgroundColor: isDark ? '#1b1b1b' : '#f2f2f2', shadowColor: C.shadow },
                ]}
              >
                <Ionicons name="save-outline" size={18} color={C.accent} />
                <Text style={[styles.primaryBtnText, { color: C.text }]}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Search
  searchBar: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 34,
    fontSize: 16,
  },
  clearBtn: { position: 'absolute', right: 8, top: 10, padding: 6 },

  // Section header
  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700' },

  // Record card
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemSub: { marginTop: 4, fontSize: 13 },
  iconBtn: { borderWidth: 1, borderRadius: 12, padding: 8 },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 112,
    justifyContent: 'center',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600' },
  ghostBtn: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
  },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '94%', borderWidth: 1, borderRadius: 20, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },

  // Modal form
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  field: { width: '48%' },
  label: { fontSize: 14, marginBottom: 6 },
  input: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, fontSize: 16 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 64, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13 },
});
