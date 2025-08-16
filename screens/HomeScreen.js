// screens/HomeScreen.js
import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react';
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
import 'dayjs/locale/ja';
import { Swipeable } from 'react-native-gesture-handler';
import {
  getRecords,
  updateRecordById,
  deleteRecordById,
  saveRecord,
  getSettings,
  saveSettings,
  clearBackgroundImage,
  subscribeSettings,
} from '../utils/storage';
import * as ImagePicker from 'expo-image-picker';

dayjs.locale('ja');

const ACCENT = '#D46E2C';

export default function HomeScreen({ navigation }) {
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
      accent: ACCENT,
      accentSoft: 'rgba(212,110,44,0.12)',
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
      accent: ACCENT,
      accentSoft: 'rgba(212,110,44,0.2)',
      shadow: '#000000',
      danger: '#ff5f6d',
    },
  }[isDark ? 'dark' : 'light'];

  const [groupedRecords, setGroupedRecords] = useState({});
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 追加：表示密度・背景状態（設定からロード）
  const [compact, setCompact] = useState(false);
  const [hasBg, setHasBg] = useState(false);

  // Undo
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);

  // Swipeable 管理（同時に1つだけ開く）
  const rowRefs = useRef({});
  const openRowRef = useRef(null); // ← 修正

  // 初期設定ロード + 設定購読（即時反映）
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const s = await getSettings();
        setCompact(!!s?.compactList);
        setHasBg(!!s?.backgroundImageUri);
      } catch {}
      unsub = subscribeSettings((next) => {
        setHasBg(!!next?.backgroundImageUri);
      });
    })();
    return () => unsub();
  }, []);

  // ヘッダー右：密度トグル & 背景操作（選択/クリア）
  useLayoutEffect(() => {
    navigation?.setOptions?.({
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          {/* 密度トグル */}
          <TouchableOpacity
            onPress={async () => {
              const next = !compact;
              setCompact(next);
              try {
                await saveSettings({ compactList: next });
              } catch {}
            }}
            style={{ paddingHorizontal: 8 }}
          >
            <Ionicons
              name={compact ? 'contract' : 'expand'}
              size={20}
              color={C.text}
            />
          </TouchableOpacity>

          {/* 背景：選択 or クリア */}
          <TouchableOpacity
            onPress={async () => {
              try {
                Alert.alert(
                  '背景',
                  '操作を選択してください',
                  [
                    { text: 'キャンセル', style: 'cancel' },
                    {
                      text: '写真から選ぶ',
                      onPress: async () => {
                        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (perm.status !== 'granted') return;
                        const r = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                          quality: 0.92,
                        });
                        if (!r.canceled && r.assets?.[0]?.uri) {
                          await saveSettings({ backgroundImageUri: r.assets[0].uri });
                        }
                      },
                    },
                    {
                      text: '背景をクリア',
                      style: 'destructive',
                      onPress: async () => {
                        await clearBackgroundImage();
                      },
                    },
                  ],
                  { cancelable: true }
                );
              } catch (e) {
                Alert.alert('エラー', '背景の設定に失敗しました');
              }
            }}
            style={{ paddingHorizontal: 8 }}
          >
            <Ionicons name="image-outline" size={20} color={C.text} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, compact, C.text]);

  const loadRecords = useCallback(async () => {
    try {
      const list = await getRecords({ search: '' });
      // 日付でグルーピング（降順）
      const byDate = {};
      for (const r of list) {
        const date = r.date || r.createdAt || r.updatedAt || r._date || r.day || '未分類';
        byDate[date] = byDate[date] || [];
        byDate[date].push(r);
      }
      const sorted = Object.fromEntries(
        Object.entries(byDate).sort(([a], [b]) => (dayjs(b).valueOf() - dayjs(a).valueOf()))
      );
      setGroupedRecords(sorted);
    } catch {
      Alert.alert('エラー', '一覧の読み込みに失敗しました');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
      return () => {
        if (undoTimer.current) {
          clearTimeout(undoTimer.current);
          undoTimer.current = null;
        }
      };
    }, [loadRecords, searchQuery])
  );

  const isNum = (v) => /^\d+$/.test(String(v ?? ''));

  const openEditModal = (r) => {
    setEditRecord({ ...r });
    setEditModalVisible(true);
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

  const handleDeleteById = async (id) => {
    try {
      const all = await getRecords();
      const target = all.find((x) => x.id === id);
      await deleteRecordById(id);
      setUndo({ id, target });
      loadRecords();

      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 4500);
    } catch {
      Alert.alert('エラー', '削除に失敗しました');
    }
  };

  const undoDelete = async () => {
    if (!undo?.target) return;
    try {
      await saveRecord(undo.target);
      setUndo(null);
      loadRecords();
    } catch {}
  };

  const clearSearch = () => setSearchQuery('');

  const filteredEntries = Object.entries(groupedRecords).filter(([_, records]) =>
    records.some((r) =>
      (r.exercise || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const subVerbose = (r) => {
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

  const RightAction = () => (
    <View style={[styles.swipeBG, { backgroundColor: hasBg ? 'transparent' : C.bg }]}>
      <Ionicons name="trash-outline" size={20} color={C.black} />
      <Text style={[styles.swipeActionText, { color: C.black }]}>削除</Text>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: hasBg ? 'transparent' : C.bg }]}>
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
            <TouchableOpacity
              onPress={clearSearch}
              style={styles.clearBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color={C.sub} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {filteredEntries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="server-outline" size={48} color={C.sub} />
            <Text style={[styles.emptyTitle, { color: C.sub }]}>記録はまだありません</Text>
            <Text style={[styles.emptyText, { color: C.sub }]}>別の画面から記録を追加してください</Text>
          </View>
        ) : (
          filteredEntries.map(([date, items]) => {
            const title = dayjs(date).isValid() ? dayjs(date).format('YYYY/MM/DD (ddd)') : date;
            return (
              <View key={date} style={{ marginBottom: 10 }}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: C.sub }]}>
                    {title} · {items.length}件
                  </Text>
                </View>

                {items.map((r) => (
                  <View key={r.id} style={[styles.rowWrap, compact && { marginTop: 8 }]}>
                    <Swipeable
                      ref={(ref) => {
                        if (ref) rowRefs.current[r.id] = ref;
                      }}
                      friction={1.5}
                      rightThreshold={48}
                      overshootRight={false}
                      renderRightActions={() => <RightAction />}
                      onSwipeableWillOpen={() => {
                        if (openRowRef.current && openRowRef.current !== rowRefs.current[r.id]) {
                          openRowRef.current.close();
                        }
                        openRowRef.current = rowRefs.current[r.id];
                      }}
                      onSwipeableOpen={(direction) => {
                        if (direction === 'right') {
                          rowRefs.current[r.id]?.close();
                          handleDeleteById(r.id);
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.card,
                          compact ? styles.cardCompact : styles.cardRegular,
                          { backgroundColor: C.card, borderColor: C.border, shadowColor: C.shadow },
                        ]}
                      >
                        <View style={[styles.leftIconWrap, compact && styles.leftIconWrapCompact]}>
                          <View
                            style={[
                              styles.iconCircle,
                              compact && styles.iconCircleCompact,
                              { borderColor: C.border, backgroundColor: C.ghostBg },
                            ]}
                          >
                            <Ionicons
                              name={r.type === '筋トレ' ? 'barbell-outline' : 'walk-outline'}
                              size={compact ? 16 : 18}
                              color={C.accent}
                            />
                          </View>
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[styles.itemTitle, compact && styles.itemTitleCompact, { color: C.text }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {r.exercise || r.type}
                          </Text>
                          {!!subVerbose(r) && (
                            <Text
                              style={[styles.itemSub, compact && styles.itemSubCompact, { color: C.sub }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {subVerbose(r)}
                            </Text>
                          )}
                        </View>

                        <View style={{ flexDirection: 'row', gap: compact ? 4 : 8 }}>
                          <TouchableOpacity
                            onPress={() => openEditModal(r)}
                            style={[
                              styles.iconBtn,
                              compact && styles.iconBtnCompact,
                              { borderColor: C.border, backgroundColor: C.ghostBg },
                            ]}
                          >
                            <Ionicons name="create-outline" size={18} color={C.black} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteById(r.id)}
                            style={[
                              styles.iconBtn,
                              compact && styles.iconBtnCompact,
                              { borderColor: C.border, backgroundColor: C.ghostBg },
                            ]}
                          >
                            <Ionicons name="trash-outline" size={18} color={C.black} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Swipeable>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {undo && (
        <View
          style={[
            styles.undoBar,
            { backgroundColor: C.card, borderColor: C.border, shadowColor: C.shadow },
          ]}
        >
          <Text style={{ color: C.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
            削除しました
          </Text>
          <TouchableOpacity onPress={undoDelete} style={[styles.undoBtn, { borderColor: C.border }]}>
            <Text style={{ color: C.text, fontWeight: '800', fontSize: 13 }}>取り消す</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 編集モーダル */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>編集</Text>

            <View style={styles.formGrid}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: C.sub }]}>種目</Text>
                <TextInput
                  placeholder="ベンチプレス"
                  placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                  value={editRecord?.exercise ?? ''}
                  onChangeText={(v) => setEditRecord((p) => ({ ...p, exercise: v }))}
                  style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                />
              </View>

              {editRecord?.type === '筋トレ' ? (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>重さ(kg)</Text>
                    <TextInput
                      placeholder="60"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={String(editRecord?.weight ?? '')}
                      onChangeText={(v) => setEditRecord((p) => ({ ...p, weight: v }))}
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>回数</Text>
                    <TextInput
                      placeholder="10"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={String(editRecord?.reps ?? '')}
                      onChangeText={(v) => setEditRecord((p) => ({ ...p, reps: v }))}
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
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
                      value={String(editRecord?.distance ?? '')}
                      onChangeText={(v) => setEditRecord((p) => ({ ...p, distance: v }))}
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: C.sub }]}>時間(分)</Text>
                    <TextInput
                      placeholder="30"
                      placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                      value={String(editRecord?.time ?? '')}
                      onChangeText={(v) => setEditRecord((p) => ({ ...p, time: v }))}
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                    />
                  </View>
                </>
              )}

              <View style={styles.field}>
                <Text style={[styles.label, { color: C.sub }]}>セット数</Text>
                <TextInput
                  placeholder="3"
                  placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
                  value={String(editRecord?.sets ?? '')}
                  onChangeText={(v) => setEditRecord((p) => ({ ...p, sets: v }))}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={[styles.ghostBtn, { borderColor: C.border }]}
              >
                <Ionicons name="close" size={18} color={C.sub} />
                <Text style={{ color: C.sub }}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                style={[
                  styles.primaryBtn,
                  { borderColor: C.border, backgroundColor: C.ghostBg, shadowColor: C.shadow },
                ]}
              >
                <Ionicons name="save-outline" size={18} color={ACCENT} />
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
    paddingRight: 40,
    fontSize: 16,
  },
  clearBtn: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },

  // Section header
  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700' },

  rowWrap: { marginHorizontal: 16, marginTop: 10 },

  card: {
    borderWidth: 1,
    borderRadius: 14,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardRegular: { padding: 14 },
  cardCompact: { paddingVertical: 8, paddingHorizontal: 10 },

  leftIconWrap: { alignItems: 'center', gap: 6 },
  leftIconWrapCompact: { gap: 4 },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleCompact: { width: 24, height: 24, borderRadius: 12 },

  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemTitleCompact: { fontSize: 14 },
  itemSub: { marginTop: 2, fontSize: 13 },
  itemSubCompact: { fontSize: 12, marginTop: 1 },

  iconBtn: { borderWidth: 1, borderRadius: 12, padding: 8 },
  iconBtnCompact: { padding: 6, borderRadius: 10 },

  swipeBG: {
    width: 90,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  swipeActionText: { fontSize: 12, fontWeight: '700' },

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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: { width: '94%', borderWidth: 1, borderRadius: 20, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },

  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  field: { width: '48%' },
  label: { fontSize: 14, marginBottom: 6 },
  input: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, fontSize: 16 },

  emptyWrap: { alignItems: 'center', paddingTop: 64, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13 },
});
