// App.js
import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from './screens/HomeScreen';
import AddRecordScreen from './screens/AddRecordScreen';
import WeeklyMenuScreen from './screens/WeeklyMenuScreen';
import TimerScreen from './screens/TimerScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { migrateFromAsyncStorage } from './utils/storage';
import * as SplashScreen from 'expo-splash-screen';

const Tab = createBottomTabNavigator();

// スプラッシュを自動で消さない
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    (async () => {
      const start = Date.now();
      try {
        // 初期化処理
        await migrateFromAsyncStorage();

        // 最低表示1.5秒確保
        const elapsed = Date.now() - start;
        const wait = Math.max(0, 1500 - elapsed);
        if (wait > 0) {
          await new Promise(res => setTimeout(res, wait));
        }
      } catch (e) {
        console.warn('初期化中にエラー:', e);
      } finally {
        setAppReady(true);
      }
    })();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    // スプラッシュを表示中はレンダリングしない
    return null;
  }

  return (
    <NavigationContainer onReady={onLayoutRootView}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#E87722', // オレンジ
          tabBarInactiveTintColor: 'gray',
          tabBarIcon: ({ color, size }) => {
            let iconName;
            if (route.name === '一覧') iconName = 'list';
            else if (route.name === '記録') iconName = 'add-circle';
            else if (route.name === 'メニュー') iconName = 'calendar';
            else if (route.name === 'タイマー') iconName = 'timer';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="一覧" component={HomeScreen} />
        <Tab.Screen name="記録" component={AddRecordScreen} />
        <Tab.Screen name="メニュー" component={WeeklyMenuScreen} />
        <Tab.Screen name="タイマー" component={TimerScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
