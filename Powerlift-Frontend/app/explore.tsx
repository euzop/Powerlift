import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS, Typography } from '../constants/Typography';
import useCustomTheme from '../hooks/useCustomTheme';

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useCustomTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.content, { paddingBottom: insets.bottom + 70 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Explore Features</Text>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        
        <View style={styles.optionsContainer}>
          {/* Live Analysis feature temporarily hidden */}
          {/* 
          <TouchableOpacity 
            style={[styles.option, { 
              backgroundColor: theme.surface,
              borderColor: theme.border 
            }]}
            onPress={() => router.push('/live' as any)}
          >
            <Ionicons name="videocam" size={48} color={theme.primary} />
            <Text style={[styles.optionTitle, { color: theme.text }]}>Live</Text>
            <Text style={[styles.optionDescription, { color: theme.textMuted }]}>
              Continuous video analysis at 10 frames per second with real-time feedback
            </Text>
          </TouchableOpacity>
          */}
          
          {/* Placeholder for future features */}
          <View style={[styles.option, { 
            backgroundColor: theme.surface,
            borderColor: theme.border,
            opacity: 0.5
          }]}>
            <Ionicons name="construct" size={48} color={theme.textMuted} />
            <Text style={[styles.optionTitle, { color: theme.textMuted }]}>Coming Soon</Text>
            <Text style={[styles.optionDescription, { color: theme.textMuted }]}>
              New features are being developed
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  title: {
    ...Typography.h1,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 30,
  },
  optionsContainer: {
    alignItems: 'center',
  },
  option: {
    borderRadius: 12,
    padding: 30,
    borderWidth: 1,
    width: '100%',
    alignItems: 'center',
  },
  optionTitle: {
    ...Typography.h3,
    fontFamily: FONTS.bold,
    marginTop: 20,
    marginBottom: 12,
  },
  optionDescription: {
    ...Typography.body1,
    lineHeight: 22,
    textAlign: 'center',
  },
}); 