// screens/TimerScreen.js
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  useColorScheme,
  Vibration,
  Alert,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function TimerScreen({ navigation }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

  // Design tokens（既存トーン維持）
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
      success: '#0d9488',
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
      success: '#14b8a6',
    },
  }[isDark ? 'dark' : 'light'];

  // ===== States =====
  const [mode, setMode] = useState('countdown'); // countdown | stopwatch
  const [durationSec, setDurationSec] = useState(90);
  const [remainSec, setRemainSec] = useState(90);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [running, setRunning] = useState(false);

  const endAtRef = useRef(null);
  const startAtRef = useRef(null);
  const intervalRef = useRef(null);

  // Vibrate switch（既存アニメ）
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
  const knobX = toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  // プリセット（3分は削除済み）
  const [presets, setPresets] = useState([
    { label: '30秒', sec: 30 },
    { label: '1分', sec: 60 },
    { label: '90秒', sec: 90 },
    { label: '2分', sec: 120 },
    { label: '5分', sec: 300 },
  ]);

  const [customSec, setCustomSec] = useState('');

  // 進捗：スムーズに（UIだけのアニメ・機能影響なし）
  const rawProgress = useMemo(() => {
    if (mode !== 'countdown' || durationSec <= 0) return 0;
    return Math.min(1, Math.max(0, 1 - remainSec / durationSec));
  }, [mode, durationSec, remainSec]);
  const progressAnim = useRef(new Animated.Value(rawProgress)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: rawProgress,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [rawProgress]);
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  // Keep awake（任意）
  useEffect(() => {
    let activated = false;
    (async () => {
      try {
        const m = await import('expo-keep-awake');
        if (running) {
          await m.activateKeepAwakeAsync();
          activated = true;
        }
      } catch {}
    })();
    return () => {
      (async () => {
        try {
          const m = await import('expo-keep-awake');
          if (activated) await m.deactivateKeepAwake();
        } catch {}
      })();
    };
  }, [running]);

  useLayoutEffect(() => {
    navigation?.setOptions?.({ headerTitle: 'タイマー' });
  }, [navigation]);

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
          if (vibrateOnFinish) Vibration.vibrate([0, 300, 150, 300]);
          Alert.alert('タイムアップ', '休憩を終了して次のセットへ！');
        }
      } else {
        if (!startAtRef.current) return;
        const elapsed = Math.max(0, Math.floor((now - startAtRef.current) / 1000));
        setElapsedSec(elapsed);
      }
    }, 250);
    return clearTimerInterval;
  }, [running, mode, vibrateOnFinish]);

  const mmss = (sec) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(m)}:${pad(r)}`;
  };

  const haptic = async (style = 'light') => {
    try {
      const m = await import('expo-haptics');
      const S = m.ImpactFeedbackStyle;
      const map = { light: S.Light, med: S.Medium, heavy: S.Heavy };
      await m.impactAsync(map[style] || S.Light);
    } catch {}
  };

  // ===== Actions =====
  const applySeconds = (secInput) => {
    const sec = Number(secInput) || 0;
    if (mode === 'countdown') {
      setDurationSec(sec);
      setRemainSec(sec);
      if (running) endAtRef.current = Date.now() + sec * 1000;
    } else {
      setElapsedSec(sec);
      if (running) startAtRef.current = Date.now() - sec * 1000;
    }
  };

  const start = () => {
    if (running) return;
    if (mode === 'countdown') {
      const base = remainSec > 0 ? remainSec : durationSec;
      if (base <= 0) return;
      endAtRef.current = Date.now() + base * 1000;
      setRemainSec(base);
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
    } else if (mode === 'stopwatch' && startAtRef.current) {
      setElapsedSec(Math.max(0, Math.floor((now - startAtRef.current) / 1000)));
    }
    clearTimerInterval();
    haptic('light');
  };

  const reset = () => {
    setRunning(false);
    clearTimerInterval();
    if (mode === 'countdown') {
      setRemainSec(durationSec);
      endAtRef.current = null;
    } else {
      setElapsedSec(0);
      startAtRef.current = null;
    }
    haptic('light');
  };

  const onSwitchMode = (next) => {
    if (next === mode) return;
    setRunning(false);
    clearTimerInterval();
    if (next === 'countdown') {
      setRemainSec(durationSec);
    } else {
      setElapsedSec(0);
    }
    startAtRef.current = null;
    endAtRef.current = null;
    setMode(next);
    haptic('light');
  };

  const onPressPreset = (sec) => {
    applySeconds(sec);
    haptic('light');
  };
  const onLongPressPreset = (sec) => {
    Alert.alert('プリセットを削除しますか？', `${sec} 秒`, [
      { text: 'キャンセル' },
      { text: '削除', style: 'destructive', onPress: () => setPresets((p) => p.filter((x) => x.sec !== sec)) },
    ]);
  };

  const applyCustom = () => {
    const s = customSec.trim();
    if (!/^\d+$/.test(s)) {
      Alert.alert('入力エラー', '秒数は半角数字で入力してください');
      return;
    }
    const v = Math.max(1, Math.min(60 * 60 * 10, parseInt(s, 10)));
    setCustomSec('');
    applySeconds(v);
    haptic('light');
  };

  const plusMinus = (delta) => {
    if (mode === 'countdown') {
      const nextRemain = Math.max(0, remainSec + delta);
      const nextDuration = Math.max(0, durationSec + delta);
      setDurationSec(nextDuration);
      setRemainSec(nextRemain);
      if (running) endAtRef.current = Date.now() + nextRemain * 1000;
    } else {
      const nextElapsed = Math.max(0, elapsedSec + delta);
      setElapsedSec(nextElapsed);
      if (running) startAtRef.current = Date.now() - nextElapsed * 1000;
    }
    haptic('light');
  };

  useEffect(() => () => clearTimerInterval(), []);

  // ===== UI bits =====
  const BigTime = () => {
    const show = mode === 'countdown' ? remainSec : elapsedSec;
    return (
      <View style={styles.timeWrap}>
        <Text
          style={[
            styles.timeText,
            { color: C.text },
            // iOS 等幅っぽく（Androidは無視されるが害なし）
            { fontVariant: ['tabular-nums'] },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {mmss(show)}
        </Text>
        <Text style={[styles.timeSub, { color: C.sub }]}>
          {mode === 'countdown' ? 'カウントダウン' : 'ストップウォッチ'}
        </Text>
      </View>
    );
  };

  const EmptyHint = () => {
    if (mode !== 'countdown' || durationSec > 0) return null;
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="time-outline" size={40} color={C.sub} />
        <Text style={[styles.emptyText, { color: C.sub }]}>
          まずはプリセットを選ぶか、カスタム秒数を入力してください
        </Text>
      </View>
    );
  };

  const pressFx = (pressed) => ({
    transform: [{ scale: pressed ? 0.98 : 1 }, { translateY: pressed ? 1 : 0 }],
  });

  // ===== Render =====
  return (
    <View style={[styles.screen, { backgroundColor: C.bg }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Segmented chips */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
            {[
              { key: 'countdown', label: 'カウントダウン' },
              { key: 'stopwatch', label: 'ストップウォッチ' },
            ].map((opt) => {
              const active = mode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => onSwitchMode(opt.key)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: active ? C.accent : C.inputBorder,
                      backgroundColor: pressed || active ? C.accentSoft : C.ghostBg,
                      ...pressFx(pressed),
                    },
                  ]}
                >
                  <Text style={{ color: active ? C.accent : C.sub, fontWeight: '700' }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Big time */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: C.card,
              borderColor: C.border,
              shadowColor: C.shadow,
              marginHorizontal: 16,
              marginTop: 18,
              paddingVertical: 22,
            },
          ]}
        >
          <BigTime />

          {mode === 'countdown' && (
            <View style={[styles.progressBar, { backgroundColor: C.ghostBg, marginTop: 18 }]}>
              <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: C.accent }]} />
            </View>
          )}

          {/* Controls */}
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 18 }}>
            {running ? (
              <Pressable
                onPress={pause}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: isDark ? '#1b1b1b' : '#f2f2f2',
                    borderColor: C.border,
                    shadowColor: C.shadow,
                    ...pressFx(pressed),
                  },
                ]}
              >
                <Ionicons name="pause" size={18} color={C.accent} />
                <Text style={[styles.primaryBtnText, { color: C.text }]}>一時停止</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={start}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: isDark ? '#1b1b1b' : '#f2f2f2',
                    borderColor: C.border,
                    shadowColor: C.shadow,
                    ...pressFx(pressed),
                  },
                ]}
              >
                <Ionicons name="play" size={18} color={C.success} />
                <Text style={[styles.primaryBtnText, { color: C.text }]}>スタート</Text>
              </Pressable>
            )}
            <Pressable
              onPress={reset}
              style={({ pressed }) => [
                styles.ghostBtn,
                { borderColor: C.border, backgroundColor: pressed ? C.ghostBg : 'transparent', ...pressFx(pressed) },
              ]}
            >
              <Ionicons name="refresh" size={18} color={C.black} />
              <Text style={{ color: C.black, fontWeight: '600' }}>リセット</Text>
            </Pressable>
          </View>

          {/* +/- quick adjust */}
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 12 }}>
            {['-10', '+10', '+30'].map((lbl) => {
              const val = parseInt(lbl.replace('+', ''), 10);
              const delta = lbl.startsWith('-') ? -val : val;
              return (
                <Pressable
                  key={lbl}
                  onPress={() => plusMinus(delta)}
                  style={({ pressed }) => [
                    styles.smallBtn,
                    { borderColor: C.border, backgroundColor: pressed ? C.accentSoft : C.ghostBg, ...pressFx(pressed) },
                  ]}
                >
                  <Text style={{ color: C.sub }}>{`${lbl}秒`}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Presets */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Text style={{ color: C.sub, marginBottom: 10, fontWeight: '700' }}>プリセット</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {presets.map((p) => {
              const active =
                (mode === 'countdown' && durationSec === p.sec) || (mode === 'stopwatch' && elapsedSec === p.sec);
              return (
                <Pressable
                  key={p.sec}
                  onPress={() => onPressPreset(p.sec)}
                  onLongPress={() => onLongPressPreset(p.sec)}
                  delayLongPress={350}
                  style={({ pressed }) => [
                    styles.presetChip,
                    {
                      borderColor: active ? C.accent : C.inputBorder,
                      backgroundColor: pressed || active ? C.accentSoft : C.ghostBg,
                      ...pressFx(pressed),
                    },
                  ]}
                >
                  <Text style={{ color: C.sub, fontWeight: '700' }}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Custom seconds */}
        <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
          <Text style={{ color: C.sub, marginBottom: 8, fontWeight: '700' }}>
            カスタム（秒）{mode === 'stopwatch' ? '：経過時間に適用' : '：残り時間に適用'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TextInput
              value={customSec}
              onChangeText={(v) => /^\d*$/.test(v) && setCustomSec(v)}
              placeholder="例: 75"
              placeholderTextColor={isDark ? '#777' : '#9a9a9a'}
              keyboardType="numeric"
              returnKeyType="done"
              style={[
                styles.input,
                { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text, flex: 1 },
              ]}
            />
            <Pressable
              onPress={applyCustom}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  paddingVertical: 12,
                  backgroundColor: isDark ? '#1b1b1b' : '#f2f2f2',
                  borderColor: C.border,
                  shadowColor: C.shadow,
                  ...pressFx(pressed),
                },
              ]}
            >
              <Ionicons name="checkmark" size={18} color={C.accent} />
              <Text style={[styles.primaryBtnText, { color: C.text }]}>適用</Text>
            </Pressable>
          </View>
        </View>

        {/* Options */}
        <View style={{ paddingHorizontal: 16, marginTop: 6 }}>
          <Pressable
            onPress={() => setVibrateOnFinish((v) => !v)}
            style={({ pressed }) => [
              styles.optionRow,
              { borderColor: C.border, backgroundColor: pressed ? C.ghostBg : C.card, ...pressFx(pressed) },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="notifications-outline" size={18} color={C.black} />
              <Text style={{ color: C.text, fontWeight: '600' }}>終了時にバイブする</Text>
            </View>
            <View
              style={{
                width: 44,
                height: 26,
                borderRadius: 999,
                backgroundColor: vibrateOnFinish ? C.accent : C.inputBorder,
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <Animated.View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  backgroundColor: '#fff',
                  transform: [{ translateX: knobX }],
                }}
              />
            </View>
          </Pressable>
          <EmptyHint />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  // Big time
  timeWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  timeText: { fontSize: 76, fontWeight: '800', letterSpacing: 2 },
  timeSub: { marginTop: 6, fontSize: 13 },

  // Progress
  progressBar: { height: 12, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  primaryBtnText: { fontSize: 15, fontWeight: '600' },
  ghostBtn: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
  },
  smallBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  chip: { borderWidth: 1.2, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },

  presetChip: { borderWidth: 1.2, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },

  optionRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  // Inputs
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },

  // Empty
  emptyWrap: { alignItems: 'center', gap: 8, paddingTop: 14 },
  emptyText: { fontSize: 13, textAlign: 'center' },
});
