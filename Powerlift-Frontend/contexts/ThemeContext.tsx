import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fitnessTheme } from '../constants/Colors';

// Key for storing custom theme in AsyncStorage
const CUSTOM_THEME_KEY = 'powerlift_custom_theme';

// Define the theme type
export type ThemeType = typeof fitnessTheme;

// Define the context type
type ThemeContextType = {
  theme: ThemeType;
  updateTheme: (newTheme: ThemeType) => Promise<void>;
  resetTheme: () => Promise<void>;
};

// Create the context with default values
const ThemeContext = createContext<ThemeContextType>({
  theme: fitnessTheme,
  updateTheme: async () => {},
  resetTheme: async () => {},
});

// Create the provider component
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>(fitnessTheme);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  // Load the saved theme on component mount
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        console.log('Loading saved theme from AsyncStorage...');
        const savedTheme = await AsyncStorage.getItem(CUSTOM_THEME_KEY);
        if (savedTheme) {
          console.log('Found saved theme:', savedTheme);
          const parsedTheme = JSON.parse(savedTheme);
          setTheme(parsedTheme);
          console.log('Theme applied:', parsedTheme.primary);
        } else {
          console.log('No saved theme found, using default theme');
          console.log('Default theme primary color:', fitnessTheme.primary);
        }
        setIsThemeLoaded(true);
      } catch (error) {
        console.error('Error loading theme:', error);
        setIsThemeLoaded(true);
      }
    };

    loadSavedTheme();
  }, []);

  // Function to update the theme
  const updateTheme = async (newTheme: ThemeType) => {
    try {
      console.log('Saving new theme:', newTheme);
      await AsyncStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(newTheme));
      setTheme(newTheme);
      console.log('Theme updated successfully');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  // Function to reset the theme to default
  const resetTheme = async () => {
    try {
      console.log('Resetting theme to default');
      await AsyncStorage.removeItem(CUSTOM_THEME_KEY);
      setTheme(fitnessTheme);
      console.log('Theme reset successfully');
    } catch (error) {
      console.error('Error resetting theme:', error);
    }
  };

  // Ensure we're using the correct theme
  useEffect(() => {
    console.log('Current theme primary color:', theme.primary);
  }, [theme]);

  if (!isThemeLoaded) {
    // Return a loading state or null
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext); 