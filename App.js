// App.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './screens/HomeScreen';
import AddRecordScreen from './screens/AddRecordScreen';
import WeeklyMenuScreen from './screens/WeeklyMenuScreen';
import TimerScreen from './screens/TimerScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { migrateFromAsyncStorage, getSettings, subscribeSettings } from './utils/storage';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { getShowTimerFinishBannerInForeground } from './utils/notifyPolicy';

const Tab = createBottomTabNavigator();
void SplashScreen.preventAutoHideAsync();

// 背景は透過、ヘッダーは不透明
const AppLight = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent', card: '#ffffff' },
};
const AppDark = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent', card: '#101010' },
};

export default function App() {
  const scheme = useColorScheme();
  const [appReady, setAppReady] = useState(false);
  const [bgUri, setBgUri] = useState(null);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: !!getShowTimerFinishBannerInForeground(),
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  // 初期化 + 設定購読（背景変更を即反映）
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const start = Date.now();
      try {
        await migrateFromAsyncStorage();
        const s = await getSettings();
        setBgUri(s?.backgroundImageUri || null);

        unsub = subscribeSettings((next) => {
          setBgUri(next?.backgroundImageUri || null);
        });

        const elapsed = Date.now() - start;
        const wait = Math.max(0, 1500 - elapsed);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      } catch (e) {
        console.warn('初期化エラー:', e);
      } finally {
        setAppReady(true);
      }
    })();
    return () => unsub();
  }, []);

  const onReadyHideSplash = useCallback(async () => {
    if (appReady) await SplashScreen.hideAsync();
  }, [appReady]);

  if (!appReady) return null;

  // ヘッダー/タブの色
  const headerBg = scheme === 'dark' ? '#101010' : '#ffffff';
  const tabBg = scheme === 'dark' ? 'rgba(16,16,16,0.98)' : 'rgba(255,255,255,0.98)';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          {bgUri && (
            <Image
              source={{ uri: bgUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
            />
          )}

          <NavigationContainer
            theme={scheme === 'dark' ? AppDark : AppLight}
            onReady={onReadyHideSplash}
          >
            <Tab.Navigator
              sceneContainerStyle={{ backgroundColor: 'transparent' }}
              screenOptions={({ route }) => ({
                tabBarActiveTintColor: '#D46E2C',
                tabBarInactiveTintColor: 'gray',
                tabBarStyle: { backgroundColor: tabBg },
                headerStyle: { backgroundColor: headerBg }, // ← 不透明
                headerTitleStyle: { fontWeight: '700' },
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
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
