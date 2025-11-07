import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ColorPicker from 'react-native-wheel-color-picker';
import { FONTS, Typography } from '../constants/Typography';
import useCustomTheme from '../hooks/useCustomTheme';
import { ThemeType } from '../contexts/ThemeContext';

// Define types for theme properties
type ThemePropertyKey = keyof ThemeType;

// Props for the ColorPropertyButton
interface ColorPropertyButtonProps {
  property: ThemePropertyKey;
  label: string;
}

export default function ThemeCustomizationScreen() {
  const router = useRouter();
  const { theme, updateTheme, resetTheme, isLightColor } = useCustomTheme();
  const [customTheme, setCustomTheme] = useState<ThemeType>({ ...theme });
  const [currentColor, setCurrentColor] = useState(theme.primary);
  const [currentProperty, setCurrentProperty] = useState<ThemePropertyKey>('primary');
  const [hasChanges, setHasChanges] = useState(false);

  // Save theme changes
  const saveThemeChanges = async () => {
    try {
      await updateTheme(customTheme);
      alert('Theme saved successfully! Changes will apply throughout the app.');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving custom theme:', error);
      alert('Failed to save theme changes.');
    }
  };

  // Reset to default theme
  const handleResetTheme = async () => {
    try {
      await resetTheme();
      setCustomTheme({ ...theme });
      setCurrentColor(theme.primary);
      setCurrentProperty('primary');
      setHasChanges(false);
      alert('Theme reset to default.');
    } catch (error) {
      console.error('Error resetting theme:', error);
    }
  };

  // Handle color change
  const onColorChange = (color: string) => {
    setCurrentColor(color);
    setCustomTheme(prev => ({
      ...prev,
      [currentProperty]: color
    }));
    setHasChanges(true);
  };

  // Select a property to edit
  const selectProperty = (property: ThemePropertyKey) => {
    setCurrentProperty(property);
    setCurrentColor(customTheme[property]);
  };

  // Color property button component
  const ColorPropertyButton = ({ property, label }: ColorPropertyButtonProps) => (
    <TouchableOpacity
      style={[
        styles.propertyButton,
        currentProperty === property && styles.selectedPropertyButton,
        { backgroundColor: customTheme[property] }
      ]}
      onPress={() => selectProperty(property)}
    >
      <Text style={[
        styles.propertyButtonText,
        { color: isLightColor(customTheme[property]) ? '#000' : '#FFF' }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: customTheme.background }]}>
      <View style={[styles.header, { borderBottomColor: customTheme.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={customTheme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: customTheme.text }]}>
          Customize Theme
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: customTheme.text }]}>
            App Colors
          </Text>
          <Text style={[styles.sectionDescription, { color: customTheme.textSecondary }]}>
            Select a color property below to customize
          </Text>
        </View>

        <View style={styles.colorButtonsContainer}>
          <ColorPropertyButton property="primary" label="Primary" />
          <ColorPropertyButton property="secondary" label="Secondary" />
          <ColorPropertyButton property="accent" label="Accent" />
          <ColorPropertyButton property="background" label="Background" />
          <ColorPropertyButton property="surface" label="Surface" />
          <ColorPropertyButton property="text" label="Text" />
          <ColorPropertyButton property="success" label="Success" />
          <ColorPropertyButton property="warning" label="Warning" />
          <ColorPropertyButton property="error" label="Error" />
        </View>

        <View style={styles.pickerContainer}>
          <Text style={[styles.currentPropertyText, { color: customTheme.text }]}>
            {currentProperty}: {currentColor}
          </Text>
          
          <View style={styles.colorPickerContainer}>
            <ColorPicker
              color={currentColor}
              onColorChange={onColorChange}
              thumbSize={30}
              sliderSize={30}
              noSnap={true}
              row={false}
            />
          </View>

          <View style={styles.hexInputContainer}>
            <Text style={[styles.hexLabel, { color: customTheme.text }]}>Hex:</Text>
            <TextInput
              style={[styles.hexInput, { 
                color: customTheme.text,
                borderColor: customTheme.border,
                backgroundColor: customTheme.surfaceVariant
              }]}
              value={currentColor}
              onChangeText={(text) => {
                // Basic validation for hex color
                if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(text)) {
                  onColorChange(text);
                } else {
                  setCurrentColor(text);
                }
              }}
            />
          </View>
        </View>

        <View style={styles.previewSection}>
          <Text style={[styles.previewTitle, { color: customTheme.text }]}>Preview</Text>
          
          <View style={[styles.previewCard, { 
            backgroundColor: customTheme.surface,
            borderColor: customTheme.border
          }]}>
            <View style={styles.previewHeader}>
              <View style={[styles.previewIcon, { backgroundColor: customTheme.primary }]}>
                <Ionicons name="fitness" size={24} color="#FFF" />
              </View>
              <Text style={[styles.previewHeaderText, { color: customTheme.text }]}>
                Sample Card
              </Text>
            </View>
            
            <View style={[styles.previewDivider, { backgroundColor: customTheme.border }]} />
            
            <Text style={[styles.previewBodyText, { color: customTheme.textSecondary }]}>
              This is how text will appear in your app with the current color scheme.
            </Text>
            
            <TouchableOpacity style={[styles.previewButton, { backgroundColor: customTheme.primary }]}>
              <Text style={styles.previewButtonText}>Primary Button</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.previewButtonSecondary, { backgroundColor: customTheme.secondary }]}>
              <Text style={styles.previewButtonText}>Secondary Button</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.resetButton, { borderColor: customTheme.error }]} 
          onPress={handleResetTheme}
        >
          <Text style={[styles.resetButtonText, { color: customTheme.error }]}>Reset</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.saveButton, 
            { backgroundColor: hasChanges ? customTheme.primary : customTheme.surfaceVariant },
            !hasChanges && { opacity: 0.6 }
          ]} 
          onPress={saveThemeChanges}
          disabled={!hasChanges}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 16,
    lineHeight: 22,
  },
  colorButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  propertyButton: {
    width: '30%',
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  selectedPropertyButton: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  propertyButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  pickerContainer: {
    padding: 20,
    alignItems: 'center',
  },
  currentPropertyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textTransform: 'capitalize',
  },
  colorPickerContainer: {
    width: '100%',
    height: 300,
    marginBottom: 20,
  },
  hexInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  hexLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  hexInput: {
    height: 40,
    width: 120,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  previewSection: {
    padding: 20,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  previewCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  previewHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  previewDivider: {
    height: 1,
    marginBottom: 16,
  },
  previewBodyText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  previewButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  previewButtonSecondary: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  resetButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 2,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 