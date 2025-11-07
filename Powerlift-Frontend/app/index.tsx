import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS, SIZES, Typography } from '../constants/Typography';
import useCustomTheme from '../hooks/useCustomTheme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { theme, getContrastText } = useCustomTheme();

  // Debug theme values
  useEffect(() => {
    console.log('Welcome Screen - Current theme:', {
      primary: theme.primary,
      background: theme.background,
      text: theme.text,
      surfaceVariant: theme.surfaceVariant
    });
  }, [theme]);

  // Ensure primary color is always set (fallback to default if theme fails)
  const primaryColor = theme.primary || '#e0810d';
  const backgroundColor = theme.background || '#121212';
  const textColor = theme.text || '#FFFFFF';
  const surfaceColor = theme.surfaceVariant || '#2D2D2D';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: backgroundColor }]}>
      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={[styles.welcomeText, { color: textColor }]}>Welcome to</Text>
          <Text style={[styles.titleText, { color: primaryColor }]}>POWERLIFT</Text>
        </View>

        <View style={styles.buttonContainer}>
          <Link href="/login" asChild>
            <TouchableOpacity 
              style={{
                width: '100%',
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: primaryColor,
                borderColor: primaryColor,
                borderWidth: 2,
                shadowColor: primaryColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.5,
                shadowRadius: 6,
                elevation: 8,
              }}
            >
              <Text style={{
                fontFamily: FONTS.bold,
                fontSize: 18,
                color: getContrastText(primaryColor),
                fontWeight: 'bold'
              }}>Continue with Email</Text>
            </TouchableOpacity>
          </Link>
          
          <View style={{ height: 20 }} />
          
          <Link href="/signup" asChild>
            <TouchableOpacity 
              style={{
                width: '100%',
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: surfaceColor,
                borderColor: primaryColor,
                borderWidth: 2,
              }}
            >
              <Text style={{
                fontFamily: FONTS.bold,
                fontSize: 18,
                color: getContrastText(surfaceColor),
                fontWeight: 'bold'
              }}>Create Account</Text>
            </TouchableOpacity>
          </Link>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  welcomeText: {
    ...Typography.h3,
    fontFamily: FONTS.medium,
    marginBottom: 8,
    textAlign: 'center',
  },
  titleText: {
    ...Typography.h1,
    fontSize: 48,
    fontFamily: FONTS.black,
    letterSpacing: 1,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 