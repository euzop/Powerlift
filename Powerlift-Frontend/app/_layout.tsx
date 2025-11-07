import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../hooks/useAuth';
import { ErrorToastProvider } from '../hooks/useErrorToast';

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('Error boundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary error details:', error, errorInfo);
    
    // Log specific update-related errors
    if (error.message.includes('failed to download remote update') || 
        error.message.includes('IOexception')) {
      console.warn('Update download failed - this is usually safe to ignore in development');
    }
  }

  render() {
    if (this.state.hasError) {
      // For update download errors, don't show error screen
      if (this.state.error?.message.includes('failed to download remote update') ||
          this.state.error?.message.includes('IOexception')) {
        console.warn('Ignoring update download error, continuing with app');
        // Reset error state and continue
        this.setState({ hasError: false, error: undefined });
        return this.props.children;
      }
      
      // For other errors, you could show a fallback UI
      return null;
    }

    return this.props.children;
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Montserrat-Regular': require('../assets/fonts/Montserrat-Regular.ttf'),
    'Montserrat-Medium': require('../assets/fonts/Montserrat-Medium.ttf'),
    'Montserrat-SemiBold': require('../assets/fonts/Montserrat-SemiBold.ttf'),
    'Montserrat-Bold': require('../assets/fonts/Montserrat-Bold.ttf'),
    'Montserrat-Black': require('../assets/fonts/Montserrat-Black.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ErrorToastProvider>
          <ThemeProvider>
            <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="signup" />
                <Stack.Screen name="guest-login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="realtime-analysis" />
                <Stack.Screen name="video-analysis" />
                <Stack.Screen name="theme-customization" />
                <Stack.Screen name="results" />
                <Stack.Screen name="+not-found" />
                {/* Live analysis feature temporarily disabled */}
                {/* <Stack.Screen name="live" /> */}
              </Stack>
              <StatusBar style="light" />
            </NavigationThemeProvider>
          </ThemeProvider>
        </ErrorToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
