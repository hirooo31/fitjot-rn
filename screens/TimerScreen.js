import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Vibration,
  TextInput,
  Keyboard,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TimerScreen() {
  const [time, setTime] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [presets, setPresets] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    const stored = await AsyncStorage.getItem('timer_presets');
    if (stored) setPresets(JSON.parse(stored));
    else setPresets([30, 60, 90, 120]);
  };

  const savePresets = async (newPresets) => {
    await AsyncStorage.setItem('timer_presets', JSON.stringify(newPresets));
  };

  useEffect(() => {
    if (isRunning && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => prev - 1);
      }, 1000);
    } else if (remaining === 0) {
      clearInterval(intervalRef.current);
      Vibration.vibrate();
      setIsRunning(false);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, remaining]);

  const handleStartStop = () => {
    if (isRunning) {
      clearInterval(intervalRef.current);
      setIsRunning(false);
    } else {
      setRemaining(time);
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setRemaining(time);
  };

  const handleChangeTime = (seconds) => {
    setTime(seconds);
    setRemaining(seconds);
  };

  const handleCustomTimeSet = () => {
    const sec = parseInt(customTime, 10);
    if (!isNaN(sec) && sec > 0) {
      handleChangeTime(sec);
      setCustomTime('');
      Keyboard.dismiss();
    }
  };

  const handleAddPreset = async () => {
    const sec = parseInt(customTime, 10);
    if (!isNaN(sec) && sec > 0 && !presets.includes(sec)) {
      const updated = [...presets, sec].sort((a, b) => a - b);
      setPresets(updated);
      await savePresets(updated);
      setCustomTime('');
      Keyboard.dismiss();
    }
  };

  const handleDeletePreset = (sec) => {
    Alert.alert(`${sec}秒を削除しますか？`, '', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive', onPress: async () => {
          const updated = presets.filter((p) => p !== sec);
          setPresets(updated);
          await savePresets(updated);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>タイマー</Text>
      <Text style={styles.timer}>{remaining}s</Text>

      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.button} onPress={handleStartStop}>
          <Text style={styles.buttonText}>{isRunning ? 'ストップ' : 'スタート'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleReset}>
          <Text style={styles.buttonText}>リセット</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.presetRow}>
        {presets.map((sec) => (
          <TouchableOpacity
            key={sec}
            style={styles.presetButton}
            onPress={() => handleChangeTime(sec)}
            onLongPress={() => handleDeletePreset(sec)}
          >
            <Text style={styles.presetText}>{sec}s</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.customInputRow}>
        <TextInput
          placeholder="カスタム秒数"
          value={customTime}
          onChangeText={setCustomTime}
          keyboardType="numeric"
          style={styles.input}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.button} onPress={handleCustomTimeSet}>
          <Text style={styles.buttonText}>設定</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleAddPreset}>
          <Text style={styles.buttonText}>保存</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 10,
  },
  timer: {
    fontSize: 72,
    marginVertical: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  controlRow: {
    flexDirection: 'row',
    marginBottom: 30,
    gap: 20,
  },
  button: {
    backgroundColor: '#ddd',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  presetButton: {
    backgroundColor: '#eee',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  presetText: {
    color: '#333',
    fontSize: 16,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    width: 100,
    textAlign: 'center',
    backgroundColor: '#fff',
  },
});