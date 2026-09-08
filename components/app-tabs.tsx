import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { colors, layout } from '@/styles';
import { bottomSafeInset } from '@/utils/safe-area';

const ICON_SIZE = 24;

export function AppTabs() {
  const insets = useSafeAreaInsets();
  const bottomPad = bottomSafeInset(insets.bottom);

  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        safeAreaInsets={{ top: 0, bottom: 0, left: 0, right: 0 }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary[600],
          tabBarInactiveTintColor: colors.neutral[600],
          tabBarButton: HapticTab,
          tabBarLabelPosition: 'below-icon',
          tabBarHideOnKeyboard: true,
          sceneStyle: {
            backgroundColor: colors.neutral[50],
            paddingBottom: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 3,
            marginBottom: 4,
          },
          tabBarStyle: {
            backgroundColor: colors.neutral[0],
            borderTopWidth: 1,
            borderTopColor: colors.neutral[200],
            elevation: 0,
            height: layout.tabBarHeight + bottomPad,
            paddingTop: 6,
            paddingBottom: bottomPad,
            margin: 0,
          },
        }}>
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons color={color} name={focused ? 'home' : 'home-outline'} size={ICON_SIZE} />
            ),
          }}
        />
        <Tabs.Screen
          name="finance"
          options={{
            title: 'Finance',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                color={color}
                name={focused ? 'pie-chart' : 'pie-chart-outline'}
                size={ICON_SIZE}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="events"
          options={{
            title: 'Events',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                color={color}
                name={focused ? 'calendar' : 'calendar-outline'}
                size={ICON_SIZE}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="subscriptions"
          options={{
            title: 'Renewals',
            tabBarAccessibilityLabel: 'Subscriptions',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons color={color} name={focused ? 'card' : 'card-outline'} size={ICON_SIZE} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                color={color}
                name={focused ? 'settings' : 'settings-outline'}
                size={ICON_SIZE}
              />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
