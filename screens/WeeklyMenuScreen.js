// screens/WeeklyMenuScreen.js
import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  useColorScheme,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getWeeklyMenu, saveWeeklyMenu, saveRecord, getSettings } from '../utils/storage';

const weekdays = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

// 差し色（控えめオレンジ：メインボタン背景には使わない）
const ACCENT = '#D46E2C';

export default function WeeklyMenuScreen({ navigation }) {
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

  const [menu, setMenu] = useState({});
  const [weekdayModal, setWeekdayModal] = useState(false);

  // 種別選択モーダル（曜日作成 or セット追加を共用）
  const [typeModal, setTypeModal] = useState(false);
  const [typeContext, setTypeContext] = useState(null); // 'create-day' | 'add-set'
  const [selectedDay, setSelectedDay] = useState(null);

  // 種別選択2ボタンの自動リサイズ（中央間隔は固定18）
  const GAP = 18;
  const MAX_BOX = 170;
  const MIN_BOX = 120;
  const [typeBox, setTypeBox] = useState(MAX_BOX);

  // 曜日ドット（1行7個）の自動サイズ
  const [weekDot, setWeekDot] = useState(44);
  const [weekGap, setWeekGap] = useState(10);

  // 下余白は常に一定（キーボード有無によらず 56px + セーフエリア）
  const bottomPad = insets.bottom + 56;

  // 背景画像の有無（設定から取得・画面フォーカスで再読込）
  const [hasBg, setHasBg] = useState(false);
  useEffect(() => {
    const loadBg = async () => {
      try {
        const s = await getSettings();
        setHasBg(!!s?.backgroundImageUri);
      } catch {}
    };
    loadBg();
    const unsub = navigation.addListener('focus', loadBg);
    return unsub;
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '週間メニュー',
      headerRight: () => (
        <TouchableOpacity onPress={() => setWeekdayModal(true)} style={{ paddingHorizontal: 12 }}>
          <Ionicons name="add" size={22} color={C.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, C.text]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getWeeklyMenu();
        if (data) setMenu(data);
      } catch {
        Alert.alert('エラー', 'メニューの取得に失敗しました');
      }
    })();
  }, []);

  const persistMenu = async (newMenu) => {
    setMenu(newMenu);
    try {
      await saveWeeklyMenu(newMenu);
    } catch {
      Alert.alert('エラー', 'メニューの保存に失敗しました');
    }
  };

  const handleDaySelect = (day) => {
    if (menu[day]) {
      Alert.alert('エラー', `${day} はすでに存在します`);
      return;
    }
    setSelectedDay(day);
    setWeekdayModal(false);
    setTypeContext('create-day');
    setTypeModal(true);
  };

  const confirmType = (type) => {
    if (!selectedDay) return;

    if (typeContext === 'create-day') {
      const base =
        type === '筋トレ'
          ? [{ type, exercise: '', weight: '', reps: '', sets: '' }]
          : [{ type, exercise: '', distance: '', time: '', sets: '' }];
      const newMenu = { ...menu, [selectedDay]: base };
      persistMenu(sortMenu(newMenu));
    }

    if (typeContext === 'add-set') {
      const base =
        type === '筋トレ'
          ? { type: '筋トレ', exercise: '', weight: '', reps: '', sets: '' }
          : { type: '有酸素', exercise: '', distance: '', time: '', sets: '' };
      const updated = { ...menu, [selectedDay]: [...menu[selectedDay], base] };
      persistMenu(updated);
    }

    setTypeModal(false);
    setSelectedDay(null);
    setTypeContext(null);
  };

  const handleChange = (day, index, field, value) => {
    const updated = { ...menu };
    const arr = [...updated[day]];
    arr[index][field] = value;
    updated[day] = arr;
    persistMenu(updated);
  };

  const handleNumericInput = (day, index, field, value) => {
    if (/^\d*$/.test(value)) handleChange(day, index, field, value);
  };

  const handleAddSet = (day) => {
    setSelectedDay(day);
    setTypeContext('add-set');
    setTypeModal(true);
  };

  const handleRemoveSet = (day, index) => {
    const updated = { ...menu };
    const arr = [...updated[day]];
    arr.splice(index, 1);
    updated[day] = arr;
    persistMenu(updated);
  };

  const handleRemoveDay = (day) => {
    const updated = { ...menu };
    delete updated[day];
    persistMenu(sortMenu(updated));
  };

  const sortMenu = (obj) => {
    const out = {};
    weekdays.forEach((d) => {
      if (obj[d]) out[d] = obj[d];
    });
    return out;
  };

  const isHalfWidthNumeric = (v) => /^\d+$/.test(v);
  const validateSet = (set) => {
    if (!set.exercise.trim()) return false;
    if (!isHalfWidthNumeric(set.sets)) return false;
    if (set.type === '筋トレ') {
      if (!isHalfWidthNumeric(set.weight)) return false;
      if (!isHalfWidthNumeric(set.reps)) return false;
    } else {
      if (!isHalfWidthNumeric(set.distance)) return false;
      if (!isHalfWidthNumeric(set.time)) return false;
    }
    return true;
  };

  const handleSubmitDay = async (day) => {
    const today = new Date().toISOString().slice(0, 10);
    const sets = menu[day] ?? [];
    for (const s of sets) {
      if (!validateSet(s)) {
        Alert.alert('入力エラー', `${day} のメニューに未入力または無効な項目があります（半角数字のみ）`);
        return;
      }
    }
    try {
      for (const s of sets) {
        await saveRecord({ ...s, day, date: today });
      }
      Alert.alert(`${day}のメニューを記録しました`);
    } catch {
      Alert.alert('エラー', `${day}のメニュー記録に失敗しました`);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: hasBg ? 'transparent' : C.bg }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        // 横は触らず、縦だけ最小限の余白を確保
        contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad }}
        contentInset={{ bottom: bottomPad }}
        scrollIndicatorInsets={{ bottom: bottomPad }}
      >
        {Object.entries(menu).length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: C.sub }]}>＋ で曜日を追加</Text>
          </View>
        )}

        {Object.entries(menu).map(([day, sets]) => (
          <View
            key={day}
            style={[
              styles.card,
              { backgroundColor: C.card, borderColor: C.border, shadowColor: C.shadow },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: C.text }]}>{day}</Text>

              {/* アクション：右寄せ。削除はニュートラルなアイコンのみ */}
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${day}を記録`}
                  onPress={() => handleSubmitDay(day)}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: pressed ? C.neutralBtnBgPressed : C.neutralBtnBg,
                      borderColor: C.border,
                      shadowColor: C.shadow,
                      transform: [{ translateY: pressed ? 1 : 0 }],
                    },
                  ]}
                >
                  {/* アイコンのみオレンジ */}
                  <Ionicons name="document-text-outline" size={18} color={C.accent} />
                  <Text style={[styles.primaryBtnText, { color: C.text }]}>記録</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${day}を削除`}
                  onPress={() => handleRemoveDay(day)}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { borderColor: C.border, backgroundColor: pressed ? C.ghostBg : 'transparent' },
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color={C.sub} />
                </Pressable>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: C.border }]} />

            {sets.map((set, idx) => (
              <View key={idx} style={styles.setRow}>
                <View style={styles.setHeader}>
                  <Text style={[styles.setType, { color: C.sub }]}>{set.type}</Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="このセットを削除"
                    onPress={() => handleRemoveSet(day, idx)}
                    style={({ pressed }) => [
                      styles.rowIconBtn,
                      { backgroundColor: pressed ? C.ghostBg : 'transparent' },
                    ]}
                  >
                    <Ionicons name="close" size={18} color={C.sub} />
                  </Pressable>
                </View>

                <View style={styles.formGrid}>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>種目</Text>
                    <TextInput
                      placeholder={set.type === '筋トレ' ? '例: ベンチプレス' : '例: ランニング'}
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={set.exercise}
                      onChangeText={(v) => handleChange(day, idx, 'exercise', v)}
                      style={[
                        styles.input,
                        { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text },
                      ]}
                      returnKeyType="done"
                    />
                  </View>

                  {set.type === '筋トレ' ? (
                    <>
                      <View className="field" style={styles.field}>
                        <Text style={[styles.label, { color: C.sub }]}>重さ(kg)</Text>
                        <TextInput
                          placeholder="60"
                          placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                          value={set.weight}
                          onChangeText={(v) => handleNumericInput(day, idx, 'weight', v)}
                          keyboardType="numeric"
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
                          placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                          value={set.reps}
                          onChangeText={(v) => handleNumericInput(day, idx, 'reps', v)}
                          keyboardType="numeric"
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
                        <Text style={[styles.label, { color: C.sub }]}>距離(km)</Text>
                        <TextInput
                          placeholder="5"
                          placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                          value={set.distance}
                          onChangeText={(v) => handleNumericInput(day, idx, 'distance', v)}
                          keyboardType="numeric"
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
                          placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                          value={set.time}
                          onChangeText={(v) => handleNumericInput(day, idx, 'time', v)}
                          keyboardType="numeric"
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
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={set.sets}
                      onChangeText={(v) => handleNumericInput(day, idx, 'sets', v)}
                      keyboardType="numeric"
                      style={[
                        styles.input,
                        { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text },
                      ]}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              </View>
            ))}

            <Pressable
              onPress={() => handleAddSet(day)}
              style={({ pressed }) => [
                styles.addSetBtn,
                { backgroundColor: C.ghostBg, borderColor: C.border, opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Ionicons name="add" size={18} color={C.text} />
              <Text style={[styles.addSetText, { color: C.text }]}>セットを追加</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {/* 曜日選択（1行ドット） */}
      <Modal visible={weekdayModal} transparent animationType="fade" onRequestClose={() => setWeekdayModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>曜日を追加</Text>

            <View
              style={styles.weekDotsWrap}
              onLayout={(e) => {
                const GAP = 10; // ドット間
                const w = e.nativeEvent.layout.width;
                // 7個 + ギャップ6つが必ず収まる直径（40〜56の範囲）
                const size = Math.min(56, Math.max(40, Math.floor((w - GAP * 6) / 7)));
                if (size !== weekDot) setWeekDot(size);
                setWeekGap(GAP);
              }}
            >
              {weekdays.map((d, i) => (
                <Pressable
                  key={d}
                  onPress={() => handleDaySelect(d)}
                  style={({ pressed }) => [
                    styles.weekDot,
                    {
                      width: weekDot,
                      height: weekDot,
                      marginRight: i < weekdays.length - 1 ? weekGap : 0,
                      backgroundColor: pressed ? C.accentSoft : C.ghostBg,
                      borderColor: pressed ? C.accent : C.border,
                      shadowColor: C.shadow,
                    },
                  ]}
                >
                  <Text style={[styles.weekDotText, { color: C.text }]}>{d[0]}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setWeekdayModal(false)}
              style={({ pressed }) => [
                styles.closeBtn,
                { borderColor: C.border, backgroundColor: pressed ? C.ghostBg : 'transparent' },
              ]}
            >
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>閉じる</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 種別選択（共用） */}
      <Modal visible={typeModal} transparent animationType="fade" onRequestClose={() => setTypeModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: C.card, borderColor: C.border, alignItems: 'center' }]}>
            <Text style={[styles.typeModalTitle, { color: C.text }]}>種別を選択</Text>

            {/* 幅計測して2枚＋GAP=18が入るように自動調整 */}
            <View
              style={styles.typeRow}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                const s = Math.min(MAX_BOX, Math.max(MIN_BOX, Math.floor((w - GAP) / 2)));
                if (s !== typeBox) setTypeBox(s);
              }}
            >
              <Pressable
                onPress={() => confirmType('筋トレ')}
                style={({ pressed }) => [
                  styles.typeBig,
                  { width: typeBox, backgroundColor: pressed ? C.accentSoft : C.ghostBg, borderColor: pressed ? C.accent : C.border },
                ]}
              >
                <Ionicons name="barbell-outline" size={42} color={C.accent} />
                <Text style={[styles.typeBigText, { color: C.text }]}>筋トレ</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmType('有酸素')}
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
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>閉じる</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  emptyWrap: { padding: 28, alignItems: 'center' },
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

  // アクション少しだけ詰める
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  // プライマリ（ニュートラル背景のアウトライン・ピル）
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

  // ニュートラルなアイコン丸ボタン（削除用）
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // セット行の×ボタン（タッチターゲット確保）
  rowIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addSetBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 999,
    justifyContent: 'center',
  },
  addSetText: { fontSize: 16, fontWeight: '700' },

  divider: { height: 1, marginVertical: 12 },

  setRow: { marginBottom: 12 },
  setHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

  setType: { fontSize: 14, fontWeight: '700' },

  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { width: '48%' },

  label: { fontSize: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontSize: 17,
  },

  // モーダル共通
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  modalCard: {
    width: '94%',
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  typeModalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 18 },

  // 種別：特大タイル（中央間隔18は維持）
  typeRow: { flexDirection: 'row', gap: 18, justifyContent: 'center', marginBottom: 14 },
  typeBig: {
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 10,
  },
  typeBigText: { fontSize: 20, fontWeight: '700', textAlign: 'center' },

  // 曜日：1行ドット
  weekDotsWrap: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  weekDot: {
    borderWidth: 1.2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  weekDotText: { fontSize: 16, fontWeight: '700' },

  closeBtn: {
    borderWidth: 1,
    borderRadius: 999,
    height: 52,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 2,
  },
});
