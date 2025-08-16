// App.js
import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './screens/HomeScreen';
import AddRecordScreen from './screens/AddRecordScreen';
import WeeklyMenuScreen from './screens/WeeklyMenuScreen';
import TimerScreen from './screens/TimerScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { migrateFromAsyncStorage } from './utils/storage';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { getShowTimerFinishBannerInForeground } from './utils/notifyPolicy';

const Tab = createBottomTabNavigator();

// スプラッシュを自動で消さない
void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);

  // フォアグラウンド時の通知表示ポリシー（タイマー画面表示中はバナーを抑止）
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: !!getShowTimerFinishBannerInForeground(),
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    (async () => {
      const start = Date.now();
      try {
        await migrateFromAsyncStorage();
        const elapsed = Date.now() - start;
        const wait = Math.max(0, 1500 - elapsed);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      } catch (e) {
        console.warn('初期化エラー:', e);
      } finally {
        setAppReady(true);
      }
    })();
  }, []);

  const onReadyHideSplash = useCallback(async () => {
    if (appReady) await SplashScreen.hideAsync();
  }, [appReady]);

  if (!appReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer onReady={onReadyHideSplash}>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarActiveTintColor: '#D46E2C',
              tabBarInactiveTintColor: 'gray',
              tabBarIcon: ({ color, size }) => {
                let iconName;
                if (route.name === '一覧') iconName = 'list';
                else if (route.name === '記録') iconName = 'add-circle';
                else if (route.name === 'メニュー') iconName = 'calendar';
                else if (route.name === 'タイマー') iconName = 'timer';
                return <Ionicons name={iconName} size={size} color={color} />;
              },
              headerTitleStyle: { fontWeight: '700' },
            })}
          >
            <Tab.Screen name="一覧" component={HomeScreen} />
            <Tab.Screen name="記録" component={AddRecordScreen} />
            <Tab.Screen name="メニュー" component={WeeklyMenuScreen} />
            <Tab.Screen name="タイマー" component={TimerScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
