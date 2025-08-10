// screens/AddRecordScreen.js
import React, { useState, useLayoutEffect, useEffect } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { saveRecord, getRecentSets, addRecentSet, removeRecentSet } from '../utils/storage';

// 控えめオレンジ（背景には使わない）
const ACCENT = '#D46E2C';

export default function AddRecordScreen({ navigation }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

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
      accent: ACCENT,
      accentSoft: 'rgba(212,110,44,0.12)',
      shadow: '#bdbdbd',
      neutralBtnBg: '#f7f7f7',
      neutralBtnBgPressed: '#efefef',
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
      accent: ACCENT,
      accentSoft: 'rgba(212,110,44,0.2)',
      shadow: '#000000',
      neutralBtnBg: '#1b1b1b',
      neutralBtnBgPressed: '#232323',
    },
  }[isDark ? 'dark' : 'light'];

  // 下端だけ最小限の余白（バー高さ 56 + セーフエリア）
  const bottomPad = insets.bottom + 56;

  const [sets, setSets] = useState([]);
  const [typeModal, setTypeModal] = useState(false);
  const [pickedDate, setPickedDate] = useState(new Date());
  const [dateModal, setDateModal] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  // 種別タイルの自動リサイズ
  const GAP = 18;
  const MAX_BOX = 170;
  const MIN_BOX = 120;
  const [typeBox, setTypeBox] = useState(MAX_BOX);

  // 最近のセット
  const [recents, setRecents] = useState([]);

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

  useEffect(() => {
    loadRecents();
    const unsub = navigation.addListener('focus', loadRecents);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRecents = async () => {
    try {
      const items = await getRecentSets(12); // 最大12個を横スクロールで
      setRecents(items);
    } catch {}
  };

  const addSet = (type) => {
    const base =
      type === '筋トレ'
        ? { type, exercise: '', weight: '', reps: '', sets: '' }
        : { type, exercise: '', distance: '', time: '', sets: '' };
    setSets((prev) => [...prev, base]);
    setTypeModal(false);
  };

  const addSetFromRecent = (r) => {
    // 日付以外をそのまま差し込み
    const { type, exercise, weight, reps, distance, time, sets: cnt } = r;
    const base =
      type === '筋トレ'
        ? { type, exercise: exercise ?? '', weight: weight ?? '', reps: reps ?? '', sets: cnt ?? '' }
        : { type, exercise: exercise ?? '', distance: distance ?? '', time: time ?? '', sets: cnt ?? '' };
    setSets((prev) => [...prev, base]);
  };

  const confirmDeleteRecent = (r) => {
    const name = r?.exercise?.trim() ? r.exercise : r.type;
    Alert.alert('削除しますか？', name, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeRecentSet(r);
            await loadRecents();
          } catch {
            Alert.alert('エラー', '最近からの削除に失敗しました');
          }
        },
      },
    ]);
  };

  const removeSet = (idx) => setSets((prev) => prev.filter((_, i) => i !== idx));

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
        // 最近リストへも追加（重複は内部で抑制）
        await addRecentSet(s);
      }
      await loadRecents();
      Alert.alert('保存しました', `${dayjs(pickedDate).format('M/D')}の記録として保存しました`);
      setSets([]);
    } catch (e) {
      Alert.alert('エラー', '記録の保存に失敗しました');
    }
  };

  const renderRecentMeta = (r) => {
    if (r.type === '筋トレ') {
      const w = r.weight ? `${r.weight}kg` : '-';
      const rep = r.reps ? `${r.reps}回` : '-';
      const st = r.sets ? `${r.sets}セット` : '-';
      return `${w}  ×  ${rep}  |  ${st}`;
    } else {
      const d = r.distance ? `${r.distance}km` : '-';
      const t = r.time ? `${r.time}分` : '-';
      const st = r.sets ? `${r.sets}セット` : '-';
      return `${d}  |  ${t}  |  ${st}`;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: C.bg }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: bottomPad }}
        contentInset={{ bottom: bottomPad }}
        scrollIndicatorInsets={{ bottom: bottomPad }}
      >
        {/* 最近から（横スクロール） */}
        {recents.length > 0 && (
          <View style={styles.recentWrap}>
            <View style={styles.recentHeader}>
              <Text style={[styles.recentTitle, { color: C.sub }]}>最近から</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            >
              {recents.map((r, i) => (
                <Pressable
                  key={`${r.type}-${r.exercise ?? ''}-${i}`}
                  onPress={() => addSetFromRecent(r)}
                  onLongPress={() => confirmDeleteRecent(r)}
                  delayLongPress={350}
                  style={({ pressed }) => [
                    styles.recentChip,
                    {
                      backgroundColor: pressed ? C.accentSoft : C.ghostBg,
                      borderColor: pressed ? C.accent : C.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={r.type === '筋トレ' ? 'barbell-outline' : 'walk-outline'}
                    size={18}
                    color={ACCENT}
                  />
                  <View style={{ maxWidth: 180 }}>
                    <Text numberOfLines={1} style={[styles.recentName, { color: C.text }]}>
                      {r.exercise || '(未入力)'}
                    </Text>
                    <Text numberOfLines={1} style={[styles.recentMeta, { color: C.sub }]}>
                      {renderRecentMeta(r)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

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
              {/* 削除：ニュートラルなアイコン丸ボタン */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="このセットを削除"
                onPress={() => removeSet(idx)}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { borderColor: C.border, backgroundColor: pressed ? C.ghostBg : '透明' },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={C.sub} />
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
      <View style={[styles.bottomBar, { borderTopColor: C.border, backgroundColor: C.card, paddingBottom: insets.bottom }]}>
        <Pressable
          onPress={() => {
            setTempDate(pickedDate);
            setDateModal(true);
          }}
          style={({ pressed }) => [
            styles.ghostBtn,
            { borderColor: C.border, backgroundColor: pressed ? C.ghostBg : 'transparent', minWidth: 140 },
          ]}
        >
          <Ionicons name="calendar-outline" size={18} color={C.black} />
          <Text style={[styles.ghostBtnText, { color: C.black }]}>{dayjs(pickedDate).format('YYYY/MM/DD')}</Text>
        </Pressable>

        {/* プライマリ：ニュートラル背景・アウトラインピル（文言に合わせて縮む） */}
        <Pressable
          onPress={submit}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: pressed ? C.neutralBtnBgPressed : C.neutralBtnBg,
              borderColor: C.border,
              shadowColor: C.shadow,
              transform: [{ translateY: pressed ? 1 : 0 }],
              opacity: sets.length === 0 ? 0.6 : 1,
            },
          ]}
          disabled={sets.length === 0}
        >
          {/* アイコンのみオレンジ */}
          <Ionicons name="document-text-outline" size={18} color={C.accent} />
          <Text style={[styles.primaryBtnText, { color: C.text }]}>記録</Text>
        </Pressable>
      </View>

      {/* Date sheet modal */}
      <Modal visible={dateModal} transparent animationType="fade" onRequestClose={() => setDateModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setDateModal(false)} />
          <View
            style={[
              { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 16, paddingTop: 6 },
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
                style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 8, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: C.sub, fontSize: 16 }}>キャンセル</Text>
              </Pressable>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>日付を選択</Text>
              <Pressable
                onPress={() => {
                  setPickedDate(tempDate);
                  setDateModal(false);
                }}
                style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 8, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: C.accent, fontSize: 16, fontWeight: '700' }}>完了</Text>
              </Pressable>
            </View>
            <View style={{ height: Platform.OS === 'ios' ? 220 : 340, justifyContent: 'center' }}>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                locale={Platform.OS === 'ios' ? 'ja-JP' : undefined}
                {...(Platform.OS === 'android'
                  ? { positiveButton: { label: '決定' }, negativeButton: { label: 'キャンセル' } }
                  : {})}
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
          <View style={[styles.modalCard, { backgroundColor: C.card, borderColor: C.border, alignItems: 'center' }]}>
            <Text style={[styles.typeModalTitle, { color: C.text }]}>種別を選択</Text>

            {/* 幅を計測して 2枚 + GAP が入るように自動調整 */}
            <View
              style={styles.typeRow}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                const s = Math.min(MAX_BOX, Math.max(MIN_BOX, Math.floor((w - GAP) / 2)));
                if (s !== typeBox) setTypeBox(s);
              }}
            >
              <Pressable
                onPress={() => addSet('筋トレ')}
                style={({ pressed }) => [
                  styles.typeBig,
                  { width: typeBox, backgroundColor: pressed ? C.accentSoft : C.ghostBg, borderColor: pressed ? C.accent : C.border },
                ]}
              >
                <Ionicons name="barbell-outline" size={42} color={C.accent} />
                <Text style={[styles.typeBigText, { color: C.text }]}>筋トレ</Text>
              </Pressable>

              <Pressable
                onPress={() => addSet('有酸素')}
                style={({ pressed }) => [
                  styles.typeBig,
                  { width: typeBox, backgroundColor: pressed ? C.accentSoft : C.ghostBg, borderColor: pressed ? C.accent : C.border },
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

  // 最近
  recentWrap: { marginBottom: 6 },
  recentHeader: { paddingHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  recentTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  recentName: { fontSize: 15, fontWeight: '700' },
  recentMeta: { fontSize: 12, marginTop: 2 },

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

  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  field: { width: '48%' },
  label: { fontSize: 14, marginBottom: 6 },
  input: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, fontSize: 17 },
  divider: { height: 1, marginVertical: 12 },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },

  ghostBtn: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 0.8,
    flexDirection: 'row',
  },
  ghostBtnText: { fontSize: 15, fontWeight: '500' },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
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

  // Type modal
  typeModalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 18 },
  typeRow: { flexDirection: 'row', gap: 18, justifyContent: 'center', marginBottom: 14 },
  typeBig: {
    aspectRatio: 1, // 正方形
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 10,
  },
  typeBigText: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  closeBtn: {
    borderWidth: 1,
    borderRadius: 999,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
});
