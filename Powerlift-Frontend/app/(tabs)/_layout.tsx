import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '../../constants/Typography';
import useCustomTheme from '../../hooks/useCustomTheme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useCustomTheme();
  
  // Calculate bottom padding to avoid overlapping with navigation buttons
  // Add extra padding for Android devices with navigation buttons
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          // Ensure tab bar is above the navigation buttons
          elevation: 8,
          zIndex: 8,
          // Add shadow on iOS
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.2,
          shadowRadius: 5,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderTopWidth: 1,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        // Make tab bar more responsive
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontFamily: FONTS.medium,
          fontSize: 10,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: '',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabContainer : styles.tabContainer}>
              <Ionicons 
                name={focused ? "home" : "home-outline"} 
                size={24} 
                color={color} 
              />
              {focused && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: '',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabContainer : styles.tabContainer}>
              <Ionicons 
                name={focused ? "person" : "person-outline"} 
                size={24} 
                color={color} 
              />
              {focused && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarLabel: '',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabContainer : styles.tabContainer}>
              <Ionicons 
                name={focused ? "barbell" : "barbell-outline"} 
                size={24} 
                color={color} 
              />
              {focused && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: 'Analysis',
          tabBarLabel: '',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabContainer : styles.tabContainer}>
              <Ionicons 
                name={focused ? "analytics" : "analytics-outline"} 
                size={24} 
                color={color} 
              />
              {focused && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    width: 60,
    height: 44,
  },
  activeTabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    width: 60,
    height: 44,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
});
