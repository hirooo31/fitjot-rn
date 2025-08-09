// screens/AddRecordScreen.js
import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  StyleSheet,
  Pressable,
  Modal,
  useColorScheme,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { saveRecord } from '../utils/storage';

export default function AddRecordScreen({ navigation }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

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
    },
  }[isDark ? 'dark' : 'light'];

  const [sets, setSets] = useState([]);
  const [typeModal, setTypeModal] = useState(false);
  const [pickedDate, setPickedDate] = useState(new Date());
  const [dateModal, setDateModal] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '記録',
      headerRight: () => (
        <Pressable onPress={() => setTypeModal(true)} style={{ paddingHorizontal: 12 }}>
          <Ionicons name="add" size={22} color={C.text} />
        </Pressable>
      ),
    });
  }, [navigation, C.text]);

  const addSet = (type) => {
    const base =
      type === '筋トレ'
        ? { type, exercise: '', weight: '', reps: '', sets: '' }
        : { type, exercise: '', distance: '', time: '', sets: '' };
    setSets((prev) => [...prev, base]);
    setTypeModal(false);
  };

  const removeSet = (idx) => {
    setSets((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChange = (idx, field, value) => {
    setSets((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const isHalfWidthNumeric = (v) => /^\d+$/.test(v);
  const handleNumeric = (idx, field, v) => {
    if (/^\d*$/.test(v)) handleChange(idx, field, v);
  };

  const validate = (s) => {
    if (!s.exercise.trim()) return false;
    if (!isHalfWidthNumeric(s.sets)) return false;
    if (s.type === '筋トレ') {
      return isHalfWidthNumeric(s.weight) && isHalfWidthNumeric(s.reps);
    }
    return isHalfWidthNumeric(s.distance) && isHalfWidthNumeric(s.time);
  };

  const submit = async () => {
    if (sets.length === 0) {
      Alert.alert('記録がありません', '右上の＋からセットを追加してください');
      return;
    }
    for (const s of sets) {
      if (!validate(s)) {
        Alert.alert('入力エラー', '未入力または無効な項目があります（半角数字のみ）');
        return;
      }
    }
    try {
      const dateStr = dayjs(pickedDate).format('YYYY-MM-DD');
      for (const s of sets) {
        await saveRecord({ ...s, date: dateStr });
      }
      Alert.alert('保存しました', `${dayjs(pickedDate).format('M/D')}の記録として保存しました`);
      setSets([]);
    } catch (e) {
      Alert.alert('エラー', '記録の保存に失敗しました');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: C.bg }]}>
      <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
        {sets.length === 0 && (
          <View style={styles.emptyWrap}>
            <Ionicons name="add-circle-outline" size={36} color={C.sub} />
            <Text style={[styles.emptyText, { color: C.sub }]}>＋ でセットを追加してください</Text>
          </View>
        )}

        {sets.map((s, idx) => (
          <View
            key={idx}
            style={[styles.card, { backgroundColor: C.card, borderColor: C.border, shadowColor: C.shadow }]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: C.text }]}>{s.type}</Text>
              <Pressable
                onPress={() => removeSet(idx)}
                style={({ pressed }) => [
                  styles.ghostBtn,
                  { borderColor: C.black, backgroundColor: pressed ? C.ghostBg : 'transparent' },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={C.black} />
                <Text style={[styles.ghostBtnText, { color: C.black }]}>削除</Text>
              </Pressable>
            </View>

            <View style={[styles.divider, { backgroundColor: C.border }]} />

            <View style={styles.formGrid}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: C.sub }]}>種目</Text>
                <TextInput
                  placeholder={s.type === '筋トレ' ? '例: ベンチプレス' : '例: ランニング'}
                  placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                  value={s.exercise}
                  onChangeText={(v) => handleChange(idx, 'exercise', v)}
                  style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                  returnKeyType="done"
                />
              </View>

              {s.type === '筋トレ' ? (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>重さ(kg)</Text>
                    <TextInput
                      placeholder="60"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={s.weight}
                      onChangeText={(v) => handleNumeric(idx, 'weight', v)}
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                      returnKeyType="done"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>回数</Text>
                    <TextInput
                      placeholder="10"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={s.reps}
                      onChangeText={(v) => handleNumeric(idx, 'reps', v)}
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                      returnKeyType="done"
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>距離(km)</Text>
                    <TextInput
                      placeholder="5"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={s.distance}
                      onChangeText={(v) => handleNumeric(idx, 'distance', v)}
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                      returnKeyType="done"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>時間(分)</Text>
                    <TextInput
                      placeholder="30"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={s.time}
                      onChangeText={(v) => handleNumeric(idx, 'time', v)}
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                      returnKeyType="done"
                    />
                  </View>
                </>
              )}

              <View style={styles.field}>
                <Text style={[styles.label, { color: C.sub }]}>セット数</Text>
                <TextInput
                  placeholder="3"
                  placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                  value={s.sets}
                  onChangeText={(v) => handleNumeric(idx, 'sets', v)}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                  returnKeyType="done"
                />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { borderTopColor: C.border, backgroundColor: C.card }]}>
        <Pressable
          onPress={() => {
            setTempDate(pickedDate);
            setDateModal(true);
          }}
          style={({ pressed }) => [
            styles.ghostBtn,
            {
              borderColor: C.border,
              backgroundColor: pressed ? C.ghostBg : 'transparent',
              minWidth: 140,
            },
          ]}
        >
          <Ionicons name="calendar-outline" size={18} color={C.black} />
          <Text style={[styles.ghostBtnText, { color: C.black }]}>
            日付: {dayjs(pickedDate).format('YYYY/MM/DD')}
          </Text>
        </Pressable>

        <Pressable
          onPress={submit}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: isDark ? '#1b1b1b' : '#f2f2f2',
              borderColor: C.border,
              shadowColor: C.shadow,
              transform: [{ translateY: pressed ? 1 : 0 }],
              opacity: sets.length === 0 ? 0.6 : 1,
            },
          ]}
          disabled={sets.length === 0}
        >
          <Ionicons name="send-outline" size={18} color={C.accent} />
          <Text style={[styles.primaryBtnText, { color: C.text }]}>記録送信</Text>
        </Pressable>
      </View>

      {/* Date sheet modal */}
      <Modal visible={dateModal} transparent animationType="fade" onRequestClose={() => setDateModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setDateModal(false)} />
          <View
            style={[
              {
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderWidth: 1,
                paddingBottom: 16,
                paddingTop: 6,
              },
              { backgroundColor: C.card, borderColor: C.border },
            ]}
          >
            <View
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                },
                { borderBottomColor: C.border },
              ]}
            >
              <Pressable
                onPress={() => setDateModal(false)}
                style={({ pressed }) => [
                  { paddingVertical: 8, paddingHorizontal: 8, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={{ color: C.sub, fontSize: 16 }}>キャンセル</Text>
              </Pressable>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>日付を選択</Text>
              <Pressable
                onPress={() => {
                  setPickedDate(tempDate);
                  setDateModal(false);
                }}
                style={({ pressed }) => [
                  { paddingVertical: 8, paddingHorizontal: 8, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={{ color: C.accent, fontSize: 16, fontWeight: '700' }}>完了</Text>
              </Pressable>
            </View>
            <View style={{ height: Platform.OS === 'ios' ? 220 : 340, justifyContent: 'center' }}>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={(e, d) => {
                  if (Platform.OS === 'ios') {
                    if (d) setTempDate(d);
                  } else {
                    if (d) {
                      setPickedDate(d);
                      setDateModal(false);
                    }
                  }
                }}
                style={{ alignSelf: 'center' }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 種別選択 */}
      <Modal visible={typeModal} transparent animationType="fade" onRequestClose={() => setTypeModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.typeModalTitle, { color: C.text }]}>種別を選択</Text>
            <View style={styles.typeRow}>
              <Pressable
                onPress={() => addSet('筋トレ')}
                style={({ pressed }) => [
                  styles.typeBig,
                  { backgroundColor: pressed ? C.accentSoft : C.ghostBg, borderColor: pressed ? C.accent : C.border },
                ]}
              >
                <Ionicons name="barbell-outline" size={42} color={C.accent} />
                <Text style={[styles.typeBigText, { color: C.text }]}>筋トレ</Text>
              </Pressable>
              <Pressable
                onPress={() => addSet('有酸素')}
                style={({ pressed }) => [
                  styles.typeBig,
                  { backgroundColor: pressed ? C.accentSoft : C.ghostBg, borderColor: pressed ? C.accent : C.border },
                ]}
              >
                <Ionicons name="walk-outline" size={42} color={C.accent} />
                <Text style={[styles.typeBigText, { color: C.text }]}>有酸素</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setTypeModal(false)}
              style={({ pressed }) => [
                styles.closeBtn,
                { borderColor: C.border, backgroundColor: pressed ? C.ghostBg : 'transparent' },
              ]}
            >
              <Text style={{ color: C.text, fontSize: 16 }}>閉じる</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  emptyWrap: { padding: 28, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16 },

  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '800' },

  formGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '48%', marginRight: '4%', marginBottom: 12 },
  label: { fontSize: 14, marginBottom: 6 },
  input: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, fontSize: 17 },
  divider: { height: 1, marginVertical: 12 },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 136,
    justifyContent: 'center',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryBtnText: { fontSize: 15, fontWeight: '500', marginLeft: 8 },
  ghostBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 0.8,
    flexDirection: 'row',
  },
  ghostBtnText: { fontSize: 15, fontWeight: '500', marginLeft: 8 },

  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  modalCard: {
    width: '94%',
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 18,
  },

  // Type modal（中央寄せを強化 / gap不使用）
  typeModalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 18 },
  typeRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  typeBig: {
    width: 170,
    height: 170,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    marginHorizontal: 9,
    marginVertical: 9,
  },
  typeBigText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },

  closeBtn: {
    borderWidth: 1,
    borderRadius: 999,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    alignSelf: 'center',
  },
});
