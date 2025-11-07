import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  
  // Calculate bottom padding to avoid overlapping with navigation buttons
  // Add extra padding for Android devices with navigation buttons
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom;

  // Define tabs
  const tabs = [
    {
      name: 'home',
      route: '/(tabs)',
      icon: 'home',
      outlineIcon: 'home-outline',
    },
    {
      name: 'profile',
      route: '/(tabs)/profile',
      icon: 'person',
      outlineIcon: 'person-outline',
    },
    {
      name: 'workout',
      route: '/(tabs)/workout',
      icon: 'barbell',
      outlineIcon: 'barbell-outline',
    },
    {
      name: 'analysis',
      route: '/(tabs)/analysis',
      icon: 'analytics',
      outlineIcon: 'analytics-outline',
    },
  ];

  return (
    <View style={[styles.tabBar, { height: 60 + bottomPadding, paddingBottom: bottomPadding }]}>
      {tabs.map((tab) => {
        const isFocused = pathname === tab.route || 
                         (tab.route === '/(tabs)' && pathname === '/(tabs)/index');
        
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabButton}
            onPress={() => router.replace(tab.route as any)}
          >
            <Ionicons
              name={isFocused ? (tab.icon as any) : (tab.outlineIcon as any)}
              size={24}
              color={isFocused ? '#FF3B4E' : '#777777'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderTopColor: '#222222',
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    // Ensure tab bar is above the navigation buttons
    elevation: 8,
    zIndex: 8,
    // Add shadow on iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 