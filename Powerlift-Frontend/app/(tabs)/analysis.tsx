import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '../../hooks/useAuth';
import useProgress from '../../hooks/useProgress';
import { FONTS, SIZES, Typography } from '../../constants/Typography';
import useCustomTheme from '../../hooks/useCustomTheme';

export default function AnalysisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { loading, progressData } = useProgress();
  const { theme } = useCustomTheme();

  // Navigate to the exercise-specific analysis screen
  const navigateToExerciseAnalysis = (exerciseType: string) => {
    router.push({
      pathname: '/exercise-analysis',
      params: { exerciseType }
    });
  };
  
  // Navigate to the comprehensive analysis report screen
  const viewAnalysisReport = () => {
    router.push('/analysis-report');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={[
          styles.content, 
          { paddingBottom: insets.bottom + 70 }
        ]}
      >
        <Text style={[styles.title, { color: theme.text }]}>Progress Analysis</Text>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading your progress data...</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>EXERCISE ANALYSIS</Text>
            
            <TouchableOpacity
              style={[styles.exerciseCard, { backgroundColor: theme.surface }]}
              onPress={() => navigateToExerciseAnalysis('deadlift')}
              activeOpacity={0.8}
            >
              <View style={styles.exerciseContent}>
                <View style={[styles.exerciseImageContainer, { backgroundColor: theme.surfaceVariant }]}>
                  <Image
                    source={require('../../assets/images/exercises/deadlift.png')}
                    style={styles.exerciseImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.exerciseTextContainer}>
                  <Text style={[styles.exerciseTitle, { color: theme.text }]}>DEADLIFT</Text>
                  <Text style={[styles.exerciseDescription, { color: theme.textMuted }]}>
                    Analyze your deadlift form and track progress
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={theme.textMuted} />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.exerciseCard, { backgroundColor: theme.surface }]}
              onPress={() => navigateToExerciseAnalysis('squat')}
              activeOpacity={0.8}
            >
              <View style={styles.exerciseContent}>
                <View style={[styles.exerciseImageContainer, { backgroundColor: theme.surfaceVariant }]}>
                  <Image
                    source={require('../../assets/images/exercises/squat.png')}
                    style={styles.exerciseImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.exerciseTextContainer}>
                  <Text style={[styles.exerciseTitle, { color: theme.text }]}>SQUAT</Text>
                  <Text style={[styles.exerciseDescription, { color: theme.textMuted }]}>
                    Analyze your squat form and track progress
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={theme.textMuted} />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.exerciseCard, { backgroundColor: theme.surface }]}
              onPress={() => navigateToExerciseAnalysis('bench')}
              activeOpacity={0.8}
            >
              <View style={styles.exerciseContent}>
                <View style={[styles.exerciseImageContainer, { backgroundColor: theme.surfaceVariant }]}>
                  <Image
                    source={require('../../assets/images/exercises/bench.png')}
                    style={styles.exerciseImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.exerciseTextContainer}>
                  <Text style={[styles.exerciseTitle, { color: theme.text }]}>BENCH PRESS</Text>
                  <Text style={[styles.exerciseDescription, { color: theme.textMuted }]}>
                    Analyze your bench press form and track progress
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={theme.textMuted} />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.reportButton, { backgroundColor: theme.primary }]}
              onPress={viewAnalysisReport}
            >
              <Ionicons name="analytics" size={20} color="#000000" style={styles.reportButtonIcon} />
              <Text style={styles.reportButtonText}>VIEW COMPREHENSIVE REPORT</Text>
            </TouchableOpacity>
            
            {/* Only show the no data message when progressData is empty */}
            {progressData.length === 0 && (
              <View style={styles.noDataContainer}>
                <Ionicons name="information-circle" size={48} color={theme.textMuted} />
                <Text style={[styles.noDataText, { color: theme.text }]}>
                  No workout data available yet
                </Text>
                <Text style={[styles.noDataSubtext, { color: theme.textMuted }]}>
                  Complete a workout analysis to see your progress
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
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
  sectionTitle: {
    ...Typography.body2,
    fontFamily: FONTS.bold,
    marginBottom: 20,
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    ...Typography.body1,
    marginTop: 16,
  },
  exerciseCard: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  exerciseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  exerciseImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  exerciseImage: {
    width: 40,
    height: 40,
  },
  exerciseTextContainer: {
    flex: 1,
  },
  exerciseTitle: {
    ...Typography.h5,
    fontFamily: FONTS.bold,
    marginBottom: 4,
  },
  exerciseDescription: {
    ...Typography.body2,
  },
  reportButton: {
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  reportButtonIcon: {
    marginRight: 8,
  },
  reportButtonText: {
    ...Typography.buttonSmall,
    fontFamily: FONTS.bold,
    color: '#000000',
    letterSpacing: 1,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    opacity: 0.7,
  },
  noDataText: {
    ...Typography.body1,
    fontFamily: FONTS.medium,
    marginTop: 16,
    marginBottom: 8,
  },
  noDataSubtext: {
    ...Typography.body2,
    textAlign: 'center',
  },
}); 