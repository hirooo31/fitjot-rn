// screens/TimerScreen.js
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  Vibration,
  Alert,
  Animated,
  Easing,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from '@react-navigation/native';
import { setShowTimerFinishBannerInForeground } from '../utils/notifyPolicy';

export default function TimerScreen({ navigation }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

  // === Palette（他画面と統一） ===
  const C = {
    light: {
      bg: '#F6F6F6',
      card: '#FFFFFF',
      text: '#0F0F0F',
      sub: '#666A70',
      border: '#E6E6E6',
      ghostBg: 'rgba(0,0,0,0.04)',
      accent: '#D46E2C',
      accentSoft: 'rgba(212,110,44,0.14)',
      success: '#0d9488',
      shadow: '#BDBDBD',
      wheelMask: 'rgba(0,0,0,0.05)',
      hair: 'rgba(0,0,0,0.08)',
    },
    dark: {
      bg: '#0E0E0E',
      card: '#151515',
      text: '#F3F3F3',
      sub: '#A9A9A9',
      border: '#242424',
      ghostBg: 'rgba(255,255,255,0.06)',
      accent: '#E87722',
      accentSoft: 'rgba(232,119,34,0.20)',
      success: '#14b8a6',
      shadow: '#000000',
      wheelMask: 'rgba(255,255,255,0.06)',
      hair: 'rgba(255,255,255,0.08)',
    },
  }[isDark ? 'dark' : 'light'];

  // ===== States =====
  const [mode, setMode] = useState('countdown'); // countdown | stopwatch
  const [durationSec, setDurationSec] = useState(90);
  const [remainSec, setRemainSec] = useState(90);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState([]); // [{timeSec, diffSec}... 先頭が最新]

  const endAtRef = useRef(null);
  const startAtRef = useRef(null);
  const intervalRef = useRef(null);
  const notifIdRef = useRef(null);

  // バイブON/OFF（右上トグル）
  const [vibrateOnFinish, setVibrateOnFinish] = useState(true);
  const toggleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: vibrateOnFinish ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [vibrateOnFinish]);
  const knobX = toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 26] });

  // プリセット
  const [presets, setPresets] = useState([
    { label: '30秒', sec: 30 },
    { label: '1:00', sec: 60 },
    { label: '1:30', sec: 90 },
    { label: '2:00', sec: 120 },
    { label: '5:00', sec: 300 },
  ]);

  // 進捗（カウントダウン時のみ）
  const rawProgress = useMemo(() => {
    if (mode !== 'countdown' || durationSec <= 0) return 0;
    return Math.min(1, Math.max(0, 1 - remainSec / durationSec));
  }, [mode, durationSec, remainSec]);
  const progressAnim = useRef(new Animated.Value(rawProgress)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: rawProgress,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [rawProgress]);
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  // 稼働中はスリープしない
  useEffect(() => {
    let on = false;
    (async () => {
      try {
        const m = await import('expo-keep-awake');
        if (running) {
          await m.activateKeepAwakeAsync();
          on = true;
        }
      } catch {}
    })();
    return () => {
      (async () => {
        try {
          const m = await import('expo-keep-awake');
          if (on) await m.deactivateKeepAwake();
        } catch {}
      })();
    };
  }, [running]);

  // この画面表示中は前景バナー抑止（他画面/背景でバナー）
  useFocusEffect(
    useCallback(() => {
      setShowTimerFinishBannerInForeground(false);
      return () => setShowTimerFinishBannerInForeground(true);
    }, [])
  );

  // 通知チャネル & 権限
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('timer-finish', {
            name: 'Timer',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 300, 200, 300],
            enableVibrate: true,
            sound: 'default',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }
        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== 'granted') await Notifications.requestPermissionsAsync();
      } catch {}
    })();
    return () => {
      cancelFinishNotification();
    };
  }, []);

  useLayoutEffect(() => {
    navigation?.setOptions?.({ headerTitle: 'タイマー' });
  }, [navigation]);

  // ===== Helpers =====
  const mmss = (sec) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  };
  const plusSign = (n) => (n >= 0 ? `+${mmss(n)}` : `-${mmss(Math.abs(n))}`);

  // 選択系の軽いハプティック（ホイール用）
  const selectionTick = async () => {
    try {
      const H = await import('expo-haptics');
      if (Platform.OS === 'android') {
        await H.impactAsync(H.ImpactFeedbackStyle.Light);
      } else {
        await H.selectionAsync();
      }
    } catch {}
  };

  const scheduleFinishNotification = async (endAtMs) => {
    try {
      const seconds = Math.max(1, Math.ceil((endAtMs - Date.now()) / 1000));
      if (notifIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(notifIdRef.current);
        notifIdRef.current = null;
      }
      notifIdRef.current = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'タイムアップ',
          body: '休憩を終了して次のセットへ！',
          sound: 'default',
          interruptionLevel: 'timeSensitive',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: Platform.select({
          ios: { seconds },
          android: { channelId: 'timer-finish', seconds },
        }),
      });
    } catch {}
  };

  const cancelFinishNotification = async () => {
    try {
      if (notifIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(notifIdRef.current);
        notifIdRef.current = null;
      }
    } catch {}
  };

  const vibrateFinish = async () => {
    if (!vibrateOnFinish) return;
    try {
      const H = await import('expo-haptics');
      await H.notificationAsync(H.NotificationFeedbackType.Success);
      await H.impactAsync(H.ImpactFeedbackStyle.Heavy);
      setTimeout(() => H.impactAsync(H.ImpactFeedbackStyle.Heavy).catch(() => {}), 180);
    } catch {}
    if (Platform.OS === 'android') Vibration.vibrate([0, 500, 200, 500]);
    else Vibration.vibrate();
  };

  const haptic = async (style = 'light') => {
    try {
      const m = await import('expo-haptics');
      const S = m.ImpactFeedbackStyle;
      const map = { light: S.Light, med: S.Medium, heavy: S.Heavy };
      await m.impactAsync(map[style] || S.Light);
    } catch {}
  };

  // ===== Engine =====
  const clearTimerInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!running) {
      clearTimerInterval();
      return;
    }
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      if (mode === 'countdown') {
        if (!endAtRef.current) return;
        const remainMs = Math.max(0, endAtRef.current - now);
        const nextRemain = Math.ceil(remainMs / 1000);
        setRemainSec(nextRemain);
        if (remainMs <= 0) {
          setRunning(false);
          clearTimerInterval();
          endAtRef.current = null;
          if (navigation?.isFocused?.()) {
            vibrateFinish();
            Alert.alert('タイムアップ', '休憩を終了して次のセットへ！');
          }
        }
      } else {
        if (!startAtRef.current) return;
        const elapsed = Math.max(0, Math.floor((now - startAtRef.current) / 1000));
        setElapsedSec(elapsed);
      }
    }, 250);
    return clearTimerInterval;
  }, [running, mode, vibrateOnFinish]);

  // 既存 start/pause/reset は残す（手動操作用）
  const start = () => {
    if (running) return;
    if (mode === 'countdown') {
      const base = remainSec > 0 ? remainSec : durationSec;
      if (base <= 0) return;
      endAtRef.current = Date.now() + base * 1000;
      setRemainSec(base);
      scheduleFinishNotification(endAtRef.current);
    } else {
      startAtRef.current = Date.now() - elapsedSec * 1000;
    }
    setRunning(true);
    haptic('med');
  };

  const pause = () => {
    if (!running) return;
    setRunning(false);
    const now = Date.now();
    if (mode === 'countdown' && endAtRef.current) {
      setRemainSec(Math.max(0, Math.ceil((endAtRef.current - now) / 1000)));
      cancelFinishNotification();
    } else if (mode === 'stopwatch' && startAtRef.current) {
      setElapsedSec(Math.max(0, Math.floor((now - startAtRef.current) / 1000)));
    }
    clearTimerInterval();
    haptic('light');
  };

  const reset = () => {
    setRunning(false);
    clearTimerInterval();
    cancelFinishNotification();
    if (mode === 'countdown') {
      setRemainSec(durationSec);
      endAtRef.current = null;
    } else {
      setElapsedSec(0);
      setLaps([]); // ストップウォッチのラップもリセット
      startAtRef.current = null;
    }
    haptic('light');
  };

  const onSwitchMode = (next) => {
    if (next === mode) return;
    setRunning(false);
    clearTimerInterval();
    cancelFinishNotification();
    if (next === 'countdown') {
      setRemainSec(durationSec);
    } else {
      setElapsedSec(0);
      setLaps([]); // モード切替でラップクリア
    }
    startAtRef.current = null;
    endAtRef.current = null;
    setMode(next);
    haptic('light');
  };

  const plusMinus = (delta) => {
    if (mode === 'countdown') {
      const nextRemain = Math.max(0, remainSec + delta);
      const nextDuration = Math.max(0, durationSec + delta);
      setDurationSec(nextDuration);
      setRemainSec(nextRemain);
      if (running) {
        endAtRef.current = Date.now() + nextRemain * 1000;
        scheduleFinishNotification(endAtRef.current);
      }
    } else {
      const nextElapsed = Math.max(0, elapsedSec + delta);
      setElapsedSec(nextElapsed);
      if (running) startAtRef.current = Date.now() - nextElapsed * 1000;
    }
    haptic('light');
  };

  // ===== 強制リスタート用ユーティリティ =====
  const forceStartCountdown = (sec) => {
    setRunning(false);
    clearTimerInterval();
    cancelFinishNotification();
    setMode('countdown');
    setDurationSec(sec);
    setRemainSec(sec);
    endAtRef.current = Date.now() + sec * 1000;
    scheduleFinishNotification(endAtRef.current);
    setRunning(true);
    haptic('med');
  };

  const forceStartStopwatchFrom = (sec) => {
    setRunning(false);
    clearTimerInterval();
    cancelFinishNotification();
    setMode('stopwatch');
    setElapsedSec(sec);
    setLaps([]); // 値から開始するときはラップを初期化
    startAtRef.current = Date.now() - sec * 1000;
    setRunning(true);
    haptic('med');
  };

  // ====== iOS風 スロットピッカー（時間/分/秒） & プリセット編集 ======
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState('apply'); // 'apply' | 'add' | 'edit'
  const [editIndex, setEditIndex] = useState(null);
  const [slotH, setSlotH] = useState(0);
  const [slotM, setSlotM] = useState(1);
  const [slotS, setSlotS] = useState(30);

  // モーダルのスライド演出（より大胆に中央までせり上げる）
  const slideY = useRef(new Animated.Value(400)).current;
  useEffect(() => {
    if (sheetVisible) {
      Animated.timing(slideY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slideY.setValue(400);
    }
  }, [sheetVisible, slideY]);

  const openSheetApply = () => {
    setSheetMode('apply');
    const base = mode === 'countdown' ? (running ? remainSec : durationSec) : elapsedSec;
    const h = Math.min(9, Math.floor(base / 3600));
    const m = Math.floor((base % 3600) / 60);
    const s = base % 60;
    setSlotH(h); setSlotM(m); setSlotS(s);
    setSheetVisible(true);
  };
  const openSheetAddPreset = () => {
    setSheetMode('add');
    setEditIndex(null);
    setSlotH(0); setSlotM(1); setSlotS(30);
    setSheetVisible(true);
  };
  const openSheetEditPreset = (idx) => {
    const sec = presets[idx].sec;
    setSheetMode('edit');
    setEditIndex(idx);
    const h = Math.min(9, Math.floor(sec / 3600));
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    setSlotH(h); setSlotM(m); setSlotS(s);
    setSheetVisible(true);
  };
  const closeSheet = () => setSheetVisible(false);

  // 確定時：常に即反映＆開始
  const confirmSheet = () => {
    const total = Math.max(1, slotH * 3600 + slotM * 60 + slotS);
    if (sheetMode === 'add') {
      const newPreset = { label: toLabel(total), sec: total };
      setPresets((p) => {
        const filtered = p.filter((x) => x.sec !== total);
        return [newPreset, ...filtered].slice(0, 12);
      });
    } else if (sheetMode === 'edit' && editIndex != null) {
      setPresets((p) => {
        const copy = [...p];
        copy[editIndex] = { label: toLabel(total), sec: total };
        return copy;
      });
    }
    setSheetVisible(false);

    if (mode === 'countdown') {
      forceStartCountdown(total);
    } else {
      // stopwatch モードのときは経過から開始
      forceStartStopwatchFrom(total);
    }
  };

  const deleteEditedPreset = () => {
    if (sheetMode !== 'edit' || editIndex == null) return;
    setPresets((p) => p.filter((_, i) => i !== editIndex));
    setSheetVisible(false);
    haptic('light');
  };

  const toLabel = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Wheel（依存なし） + スクロール時のハプティック
  const ITEM_H = 52;
  const VISIBLE = 7;
  const WHEEL_H = ITEM_H * VISIBLE;
  const hours = useMemo(() => Array.from({ length: 10 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const seconds = minutes;

  const Wheel = ({ value, onChange, range, pad, width = 72 }) => {
    const ref = useRef(null);
    const lastIdxRef = useRef(-1);    // 直近の目盛り
    const aligningRef = useRef(false); // 初期アライン中フラグ

    const indexOf = (v) => Math.max(0, Math.min(range.length - 1, range.indexOf(v)));
    const align = () => {
      const idx = indexOf(value);
      aligningRef.current = true; // 初期合わせ中は鳴らさない
      ref.current?.scrollTo({ y: idx * ITEM_H, animated: false });
      lastIdxRef.current = idx;
      setTimeout(() => { aligningRef.current = false; }, 30);
    };
    useEffect(() => { if (sheetVisible) setTimeout(align, 0); }, [sheetVisible, value]);

    const onSnap = (e) => {
      const y = e?.nativeEvent?.contentOffset?.y || 0;
      const idx = Math.max(0, Math.min(range.length - 1, Math.round(y / ITEM_H)));
      onChange(range[idx]);
    };

    const onScrollTick = (e) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      const idx = Math.max(0, Math.min(range.length - 1, Math.round(y / ITEM_H)));
      if (!aligningRef.current && idx !== lastIdxRef.current) {
        lastIdxRef.current = idx;
        selectionTick(); // ← タタタ…
      }
    };

    return (
      <View style={{ width, height: WHEEL_H, alignItems: 'center', justifyContent: 'center' }}>
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScrollTick}
          onMomentumScrollEnd={onSnap}
          onScrollEndDrag={onSnap}
          contentContainerStyle={{ paddingVertical: (WHEEL_H - ITEM_H) / 2 }}
        >
          {range.map((n) => {
            const selected = n === value;
            return (
              <View key={n} style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: selected ? '800' : '600', color: selected ? C.text : C.sub }}>
                  {String(n).padStart(pad, '0')}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* selection band */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: (WHEEL_H - ITEM_H) / 2,
            height: ITEM_H,
            width: '100%',
            borderRadius: 10,
            backgroundColor: C.wheelMask,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderColor: C.hair,
          }}
        />
      </View>
    );
  };

  // ===== Lap: ストップウォッチ専用 =====
  const addLap = () => {
    const t = elapsedSec;
    setLaps((prev) => {
      const lastTime = prev.length ? prev[0].timeSec : 0; // 先頭が最新
      const diff = t - lastTime;
      return [{ timeSec: t, diffSec: Math.max(0, diff) }, ...prev];
    });
    haptic('light');
  };
  const clearLaps = () => setLaps([]);

  // ===== UI bits =====
  const pressFx = (pressed) => ({
    transform: [{ scale: pressed ? 0.98 : 1 }, { translateY: pressed ? 1 : 0 }],
  });

  const BigTime = () => {
    const show = mode === 'countdown' ? remainSec : elapsedSec;
    return (
      <Pressable onPress={openSheetApply} style={styles.timeWrap}>
        <Text
          style={[styles.timeText, { color: C.text, fontVariant: ['tabular-nums'] }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {mmss(show)}
        </Text>
        {mode === 'countdown' && (
          <View style={[styles.progressBar, { backgroundColor: C.ghostBg, marginTop: 16 }]}>
            <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: C.accent }]} />
          </View>
        )}
      </Pressable>
    );
  };

  // ===== Render =====
  return (
    <View style={[styles.screen, { backgroundColor: C.bg }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* ヘッダー行：モード切替 / 通知トグル */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { key: 'countdown', icon: 'hourglass', label: 'カウント' },
              { key: 'stopwatch', icon: 'stopwatch', label: '計測' },
            ].map((opt) => {
              const active = mode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => onSwitchMode(opt.key)}
                  style={({ pressed }) => [
                    styles.iconChip,
                    {
                      borderColor: active ? C.accent : C.border,
                      backgroundColor: active ? C.accentSoft : C.ghostBg,
                      ...pressFx(pressed),
                    },
                  ]}
                >
                  <Ionicons name={opt.icon} size={16} color={active ? C.accent : C.sub} />
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setVibrateOnFinish((v) => !v)}
            style={({ pressed }) => [
              styles.toggleWrap,
              {
                backgroundColor: vibrateOnFinish ? C.accentSoft : C.ghostBg,
                borderColor: vibrateOnFinish ? C.accent : C.border,
                ...pressFx(pressed),
              },
            ]}
          >
            <Animated.View
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                backgroundColor: '#fff',
                transform: [{ translateX: knobX }],
              }}
            />
            <Ionicons
              name={vibrateOnFinish ? 'notifications' : 'notifications-off'}
              size={14}
              color={vibrateOnFinish ? C.accent : C.sub}
              style={{ position: 'absolute', left: 8, top: 6 }}
            />
            <Ionicons
              name="notifications-off"
              size={14}
              color={vibrateOnFinish ? 'transparent' : C.sub}
              style={{ position: 'absolute', right: 8, top: 6 }}
            />
          </Pressable>
        </View>

        {/* メインカード */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: C.card,
              borderColor: C.border,
              shadowColor: C.shadow,
              marginHorizontal: 16,
              marginTop: 12,
              paddingVertical: 22,
              paddingHorizontal: 14,
            },
          ]}
        >
          <BigTime />

          {/* コントロール */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            {running ? (
              <>
                {mode === 'stopwatch' && (
                  <Pressable
                    onPress={addLap}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { backgroundColor: C.accentSoft, borderColor: C.accent, ...pressFx(pressed) },
                    ]}
                  >
                    <Ionicons name="flag" size={18} color={C.accent} />
                    <Text style={[styles.primaryBtnText, { color: C.accent }]}>ラップ</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={pause}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: C.ghostBg, borderColor: C.border, ...pressFx(pressed) },
                  ]}
                >
                  <Ionicons name="pause" size={18} color={C.text} />
                  <Text style={[styles.primaryBtnText, { color: C.text }]}>一時停止</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={start}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: C.accentSoft, borderColor: C.accent, ...pressFx(pressed) },
                ]}
              >
                <Ionicons name="play" size={18} color={C.accent} />
                <Text style={[styles.primaryBtnText, { color: C.accent }]}>スタート</Text>
              </Pressable>
            )}

            <Pressable
              onPress={reset}
              style={({ pressed }) => [
                styles.circleBtn,
                { borderColor: C.border, backgroundColor: C.ghostBg, ...pressFx(pressed) },
              ]}
            >
              <Ionicons name="refresh" size={18} color={C.sub} />
            </Pressable>
            <Pressable
              onPress={openSheetApply}
              style={({ pressed }) => [
                styles.circleBtn,
                { borderColor: C.border, backgroundColor: C.ghostBg, ...pressFx(pressed) },
              ]}
            >
              <Ionicons name="create" size={18} color={C.sub} />
            </Pressable>
          </View>

          {/* ±クイック（カウントダウンのみ） */}
          {mode === 'countdown' && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {[-10, +10, +30].map((d) => (
                <Pressable
                  key={d}
                  onPress={() => plusMinus(d)}
                  style={({ pressed }) => [
                    styles.smallChip,
                    { borderColor: C.border, backgroundColor: pressed ? C.accentSoft : C.ghostBg, ...pressFx(pressed) },
                  ]}
                >
                  <Text style={{ color: C.sub, fontWeight: '700' }}>
                    {d > 0 ? `+${d}` : d}秒
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* 現在ターゲット（ストップウォッチでは経過表示なので省略可。統一で残す） */}
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <View style={[styles.nowPill, { borderColor: C.border, backgroundColor: C.ghostBg }]}>
              <Ionicons name="time-outline" size={14} color={C.sub} />
              <Text style={{ color: C.sub, fontWeight: '700' }}>
                {mode === 'countdown' ? mmss(durationSec) : mmss(elapsedSec)}
              </Text>
            </View>
          </View>
        </View>

        {/* 下部領域：カウントダウン＝プリセット / ストップウォッチ＝ラップ一覧 */}
        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          {mode === 'countdown' ? (
            <View style={styles.presetWrap}>
              {/* 追加（小さな丸ボタン） */}
              <Pressable
                onPress={openSheetAddPreset}
                style={({ pressed }) => [
                  styles.presetAdd,
                  {
                    borderColor: C.accent,
                    backgroundColor: pressed ? C.accentSoft : 'transparent',
                  },
                ]}
              >
                <Ionicons name="add" size={18} color={C.accent} />
              </Pressable>

              {/* Chips */}
              {presets.map((p, idx) => {
                const active = mode === 'countdown' && durationSec === p.sec;
                return (
                  <Pressable
                    key={`${p.sec}-${p.label}`}
                    onPress={() => {
                      // 即反映してカウントダウン開始
                      forceStartCountdown(p.sec);
                    }}
                    onLongPress={() => openSheetEditPreset(idx)}
                    delayLongPress={280}
                    style={({ pressed }) => [
                      styles.presetChip,
                      {
                        borderColor: active ? C.accent : C.border,
                        backgroundColor: pressed || active ? C.accentSoft : C.ghostBg,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? C.accent : C.text, fontWeight: '700' }}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={[styles.lapCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={[styles.lapHeader, { borderColor: C.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="flag-outline" size={16} color={C.sub} />
                  <Text style={{ color: C.sub, fontWeight: '800' }}>ラップ</Text>
                  <Text style={{ color: C.sub }}>（{laps.length}）</Text>
                </View>
                {laps.length > 0 && (
                  <Pressable
                    onPress={clearLaps}
                    style={({ pressed }) => [{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: pressed ? C.ghostBg : 'transparent' }]}
                  >
                    <Ionicons name="trash" size={16} color={isDark ? '#ff7b8b' : '#d11a2a'} />
                  </Pressable>
                )}
              </View>

              {laps.length === 0 ? (
                <View style={{ padding: 14 }}>
                  <Text style={{ color: C.sub }}>ラップはまだありません。計測中に「ラップ」を押すと記録されます。</Text>
                </View>
              ) : (
                <View style={{ paddingVertical: 6 }}>
                  {laps.map((lap, i) => {
                    const idx = laps.length - i; // 表示番号（古い方が小）
                    return (
                      <View
                        key={`${lap.timeSec}-${i}`}
                        style={[styles.lapRow, { borderColor: C.hair }]}
                      >
                        <Text style={[styles.lapIdx, { color: C.sub }]}>#{idx}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontWeight: '800' }}>{mmss(lap.timeSec)}</Text>
                          <Text style={{ color: C.sub, fontSize: 12 }}>{plusSign(lap.diffSec)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* iOS風ホイール・シート（大胆に中央までせり上げ、スライド演出） */}
      <Modal visible={sheetVisible} transparent animationType="fade" onRequestClose={closeSheet}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: C.card, borderColor: C.border, transform: [{ translateY: slideY }], paddingBottom: Math.max(12, insets.bottom) },
            ]}
          >
            {/* ツールバー（iOS風） */}
            <View style={[styles.toolbar, { borderColor: C.border }]}>
              <Pressable onPress={closeSheet} style={({ pressed }) => [styles.tbBtn, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={{ color: C.sub, fontWeight: '700' }}>キャンセル</Text>
              </Pressable>

              <Text style={{ color: C.text, fontWeight: '800' }}>
                {sheetMode === 'apply' ? '時間を設定' : sheetMode === 'add' ? '新しいプリセット' : 'プリセットを編集'}
              </Text>

              {/* 右上ボタン：軽いデザイン + アイコン、確定で開始 */}
              <Pressable
                onPress={confirmSheet}
                style={({ pressed }) => [
                  styles.tbPrimary,
                  {
                    borderColor: C.accent,
                    backgroundColor: pressed ? C.accentSoft : 'transparent',
                  },
                ]}
              >
                <Ionicons name="play" size={14} color={C.accent} />
                <Text style={{ color: C.accent, fontWeight: '800' }}>
                  {sheetMode === 'apply' ? 'スタート' : sheetMode === 'add' ? '追加して開始' : '保存して開始'}
                </Text>
              </Pressable>
            </View>

            {/* スロット */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, paddingVertical: 8 }}>
              <View style={{ alignItems: 'center' }}>
                <Wheel value={slotH} onChange={setSlotH} range={hours} pad={1} width={80} />
                <Text style={{ color: C.sub, marginTop: 6, fontWeight: '700' }}>時間</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Wheel value={slotM} onChange={setSlotM} range={minutes} pad={2} width={80} />
                <Text style={{ color: C.sub, marginTop: 6, fontWeight: '700' }}>分</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Wheel value={slotS} onChange={setSlotS} range={seconds} pad={2} width={80} />
                <Text style={{ color: C.sub, marginTop: 6, fontWeight: '700' }}>秒</Text>
              </View>
            </View>

            {/* 編集時のみデストラクティブ */}
            {sheetMode === 'edit' && (
              <Pressable
                onPress={deleteEditedPreset}
                style={({ pressed }) => [
                  styles.destructiveBtn,
                  { borderColor: C.border, backgroundColor: pressed ? C.ghostBg : 'transparent' },
                ]}
              >
                <Ionicons name="trash" size={16} color={isDark ? '#ff7b8b' : '#d11a2a'} />
                <Text style={{ color: isDark ? '#ff7b8b' : '#d11a2a', fontWeight: '700' }}>このプリセットを削除</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/* ========== Styles ========== */
const styles = StyleSheet.create({
  screen: { flex: 1 },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 20,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  // Header bits
  iconChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  toggleWrap: {
    width: 52,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },

  // Big time
  timeWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  timeText: { fontSize: 80, fontWeight: '900', letterSpacing: 1.5 },
  progressBar: { height: 10, borderRadius: 999, overflow: 'hidden', width: '92%' },
  progressFill: { height: '100%', borderRadius: 999 },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  smallChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },

  nowPill: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  // Preset area (countdown)
  presetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  presetAdd: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  // Lap list (stopwatch)
  lapCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingBottom: 6,
  },
  lapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lapIdx: {
    width: 40,
    textAlign: 'left',
    fontWeight: '800',
  },

  // Modal (iOS風)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: 12,
    height: '80%', // ← 80%まで拡大
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tbBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  // 右上“軽い”ボタン（薄い背景・アクセント色文字＋アイコン）
  tbPrimary: {
    minWidth: 72,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  destructiveBtn: {
    alignSelf: 'center',
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
});
