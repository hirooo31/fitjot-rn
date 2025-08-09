// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from './screens/HomeScreen';
import AddRecordScreen from './screens/AddRecordScreen';
import WeeklyMenuScreen from './screens/WeeklyMenuScreen';
import TimerScreen from './screens/TimerScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { migrateFromAsyncStorage } from './utils/storage';

const Tab = createBottomTabNavigator();

export default function App() {
  React.useEffect(() => {
    migrateFromAsyncStorage();
  }, []);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
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
