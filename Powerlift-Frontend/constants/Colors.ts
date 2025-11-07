
/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const fitnessTheme = {
  primary: '#e0810d',      // Vibrant green (motivation)
  secondary: '#FF9800',    // Warm orange (energy)
  accent: '#2196F3',       // Blue (trust/calm)
  background: '#121212',   // Material dark
  surface: '#1E1E1E',      // Elevated surface
  surfaceVariant: '#2D2D2D', // Cards/components
  text: '#FFFFFF',         // Primary text
  textSecondary: '#E0E0E0', // Secondary text
  textMuted: '#9E9E9E',    // Disabled/muted
  border: '#424242',       // Subtle borders
  success: '#4CAF50',      // Success actions
  warning: '#FFC107',      // Warnings/alerts
  error: '#F44336',        // Errors

  // Workout specific
  sets: '#00E676',         // Completed sets
  reps: '#FF9800',         // Rep counters
  weight: '#2196F3',       // Weight displays
  timer: '#E91E63',        // Timer/stopwatch
  rest: '#9C27B0'          // Rest periods
};