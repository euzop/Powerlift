import { useTheme, ThemeType } from '../contexts/ThemeContext';

/**
 * A hook to access the current theme.
 * This hook provides the current theme and theme manipulation functions.
 * 
 * @returns {Object} The theme object and theme manipulation functions
 */
export default function useCustomTheme() {
  const { theme, updateTheme, resetTheme } = useTheme();

  return {
    /**
     * The current theme object containing all color values
     */
    theme,

    /**
     * Update the theme with new values
     * @param newTheme - The new theme values
     */
    updateTheme,

    /**
     * Reset the theme to default values
     */
    resetTheme,

    /**
     * Check if a color is light or dark
     * @param color - The color to check
     * @returns {boolean} True if the color is light, false if it's dark
     */
    isLightColor: (color: string): boolean => {
      // Convert hex to RGB
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // Calculate luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    },

    /**
     * Get a contrasting text color (black or white) based on the background color
     * @param backgroundColor - The background color
     * @returns {string} White or black color depending on the background
     */
    getContrastText: (backgroundColor: string): string => {
      // Convert hex to RGB
      const hex = backgroundColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // Calculate luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? '#000000' : '#FFFFFF';
    }
  };
} 