import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuth from '../hooks/useAuth';
import { FONTS, SIZES, Typography } from '../constants/Typography';
import { useTheme } from '../contexts/ThemeContext';

// Array of fitness tips
const fitnessTips = [
  {
    icon: "barbell",
    title: "Perfect Your Deadlift",
    description: "Keep your back straight, push through your heels, and engage your core for proper form."
  },
  {
    icon: "body",
    title: "Squat Technique",
    description: "Keep your chest up and knees tracking over toes. Go as low as mobility allows."
  },
  {
    icon: "fitness",
    title: "Bench Press Form",
    description: "Maintain a slight arch in your back and keep your feet planted firmly on the ground."
  },
  {
    icon: "nutrition",
    title: "Nutrition Matters",
    description: "Consume adequate protein (1.6-2g per kg of bodyweight) to support muscle growth and recovery."
  },
  {
    icon: "water",
    title: "Stay Hydrated",
    description: "Drink at least 3-4 liters of water daily to maintain optimal performance during workouts."
  },
  {
    icon: "timer",
    title: "Rest Between Sets",
    description: "For strength gains, rest 3-5 minutes between heavy sets to allow full ATP replenishment."
  },
  {
    icon: "bed",
    title: "Prioritize Sleep",
    description: "Aim for 7-9 hours of quality sleep for optimal recovery and hormone regulation."
  },
  {
    icon: "calendar",
    title: "Progressive Overload",
    description: "Gradually increase weight, reps, or sets over time to continually challenge your muscles."
  },
  {
    icon: "pulse",
    title: "Track Your Progress",
    description: "Keep a workout journal to monitor improvements and identify plateaus in your training."
  },
  {
    icon: "walk",
    title: "Active Recovery",
    description: "Light activity on rest days improves blood flow and speeds up recovery between workouts."
  },
  {
    icon: "body-outline",
    title: "Mind-Muscle Connection",
    description: "Focus on feeling the target muscle working during each exercise for better results."
  },
  {
    icon: "flame",
    title: "Warm Up Properly",
    description: "Spend 5-10 minutes warming up to increase blood flow and prepare joints for heavy lifting."
  },
  {
    icon: "flash",
    title: "Compound First",
    description: "Start your workout with compound exercises when you're fresh to maximize strength gains."
  },
  {
    icon: "speedometer",
    title: "Control The Tempo",
    description: "Slow down the eccentric (lowering) phase of lifts to increase time under tension."
  },
  {
    icon: "refresh-circle",
    title: "Deload Weeks",
    description: "Schedule a lighter training week every 4-6 weeks to prevent overtraining and promote recovery."
  }
];

// Tip of the day storage key
const TIP_OF_THE_DAY_KEY = 'powerlift_tip_of_the_day';
const LAST_TIP_DATE_KEY = 'powerlift_last_tip_date';

const HomeScreen: React.FC = () => {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  
  // State for the tip of the day
  const [tipOfTheDay, setTipOfTheDay] = useState<(typeof fitnessTips)[0] | null>(null);
  
  useEffect(() => {
    // Function to get today's date as a string (YYYY-MM-DD)
    const getTodayDateString = () => {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    };
    
    // Function to load or generate tip of the day
    const loadTipOfTheDay = async () => {
      try {
        const storedTipData = await AsyncStorage.getItem(TIP_OF_THE_DAY_KEY);
        const lastTipDate = await AsyncStorage.getItem(LAST_TIP_DATE_KEY);
        const todayString = getTodayDateString();
        
        // If we have a stored tip and it's from today, use it
        if (storedTipData && lastTipDate === todayString) {
          setTipOfTheDay(JSON.parse(storedTipData));
        } else {
          // Otherwise, generate a new tip for today
          const randomIndex = Math.floor(Math.random() * fitnessTips.length);
          const newTip = fitnessTips[randomIndex];
          
          // Store the new tip and today's date
          await AsyncStorage.setItem(TIP_OF_THE_DAY_KEY, JSON.stringify(newTip));
          await AsyncStorage.setItem(LAST_TIP_DATE_KEY, todayString);
          
          setTipOfTheDay(newTip);
        }
      } catch (error) {
        console.error('Error loading tip of the day:', error);
        // Fallback to a random tip if there's an error
        const randomIndex = Math.floor(Math.random() * fitnessTips.length);
        setTipOfTheDay(fitnessTips[randomIndex]);
      }
    };
    
    loadTipOfTheDay();
  }, []);
  
  const handleLogout = async () => {
    await signOut();
  };

  const navigateToThemeCustomization = () => {
    router.push('/theme-customization');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* User Profile Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.profileContainer}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.surfaceVariant }]}>
            <Ionicons name="person" size={32} color={theme.textMuted} />
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.welcomeText, { color: theme.primary }]}>Welcome!</Text>
            <Text style={[styles.username, { color: theme.text }]}>{user?.username || 'Guest'}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.editButton, { backgroundColor: theme.surfaceVariant }]}
            onPress={navigateToThemeCustomization}
          >
            <Ionicons name="color-palette" size={24} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={[styles.logoutText, { color: theme.secondary }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content, 
          { paddingBottom: insets.bottom + 70 }
        ]}
      >
        <Text style={[styles.title, { color: theme.primary }]}>Welcome to{'\n'}POWERLIFT!</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Tip of the Day</Text>
        
        {tipOfTheDay && (
          <View style={[styles.tipOfTheDayCard, { 
            backgroundColor: theme.surface,
            borderColor: theme.border
          }]}>
            <View style={styles.tipHeader}>
              <View style={[styles.tipIconContainer, { backgroundColor: `${theme.primary}20` }]}>
                <Ionicons name={tipOfTheDay.icon as any} size={32} color={theme.primary} />
              </View>
              <Text style={[styles.tipTitle, { color: theme.text }]}>{tipOfTheDay.title}</Text>
            </View>
            <View style={[styles.tipDivider, { backgroundColor: theme.border }]} />
            <Text style={[styles.tipDescription, { color: theme.textSecondary }]}>{tipOfTheDay.description}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: 12,
  },
  welcomeText: {
    ...Typography.caption,
    fontFamily: FONTS.medium,
  },
  username: {
    ...Typography.h5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    marginRight: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    ...Typography.buttonSmall,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  title: {
    ...Typography.h1,
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    ...Typography.h4,
    fontFamily: FONTS.medium,
    textAlign: 'center',
    marginBottom: 30,
  },
  tipOfTheDayCard: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tipIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tipTitle: {
    ...Typography.h3,
    flex: 1,
  },
  tipDivider: {
    height: 1,
    marginBottom: 16,
  },
  tipDescription: {
    ...Typography.body1,
    lineHeight: 24,
  },
});

export default HomeScreen; 