import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useProgress from '../hooks/useProgress';
import ProgressChart from '../components/ProgressChart';
import { fitnessTheme } from '../constants/Colors';

export default function AnalysisReportScreen() {
  const router = useRouter();
  const { loading, progressData, fetchProgressByExercise } = useProgress();
  
  const [deadliftData, setDeadliftData] = useState<any[]>([]);
  const [squatData, setSquatData] = useState<any[]>([]);
  const [benchData, setBenchData] = useState<any[]>([]);
  const [loadingExerciseData, setLoadingExerciseData] = useState(true);
  
  useEffect(() => {
    const loadAllExerciseData = async () => {
      try {
        setLoadingExerciseData(true);
        
        // Fetch data for each exercise type
        const deadlift = await fetchProgressByExercise('deadlift');
        const squat = await fetchProgressByExercise('squat');
        const bench = await fetchProgressByExercise('bench');
        
        setDeadliftData(deadlift);
        setSquatData(squat);
        setBenchData(bench);
      } catch (error) {
        console.error('Error loading exercise data:', error);
      } finally {
        setLoadingExerciseData(false);
      }
    };
    
    loadAllExerciseData();
  }, [fetchProgressByExercise]);
  
  // Calculate overall stats
  const calculateOverallStats = () => {
    // Combine all exercise data
    const allData = [...deadliftData, ...squatData, ...benchData];
    
    if (allData.length === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        bestExercise: 'N/A',
        improvementArea: 'N/A',
      };
    }
    
    // Calculate average scores by exercise type
    const deadliftAvg = deadliftData.length > 0
      ? deadliftData.reduce((sum, entry) => sum + entry.score, 0) / deadliftData.length
      : 0;
      
    const squatAvg = squatData.length > 0
      ? squatData.reduce((sum, entry) => sum + entry.score, 0) / squatData.length
      : 0;
      
    const benchAvg = benchData.length > 0
      ? benchData.reduce((sum, entry) => sum + entry.score, 0) / benchData.length
      : 0;
    
    // Determine best and improvement areas
    const exerciseScores = [
      { name: 'Deadlift', score: deadliftAvg, count: deadliftData.length },
      { name: 'Squat', score: squatAvg, count: squatData.length },
      { name: 'Bench Press', score: benchAvg, count: benchData.length }
    ].filter(ex => ex.count > 0);
    
    exerciseScores.sort((a, b) => b.score - a.score);
    
    const bestExercise = exerciseScores.length > 0 ? exerciseScores[0].name : 'N/A';
    const improvementArea = exerciseScores.length > 0 ? exerciseScores[exerciseScores.length - 1].name : 'N/A';
    
    // Calculate overall average
    const totalScore = allData.reduce((sum, entry) => sum + entry.score, 0);
    const averageScore = totalScore / allData.length;
    
    return {
      totalSessions: allData.length,
      averageScore,
      bestExercise,
      improvementArea,
    };
  };
  
  const stats = calculateOverallStats();
  
  // Navigate to specific exercise analysis
  const navigateToExerciseAnalysis = (exerciseType: string) => {
    router.push({
      pathname: '/exercise-analysis',
      params: { exerciseType }
    });
  };
  
  if (loading || loadingExerciseData) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Analysis Report',
            headerStyle: {
              backgroundColor: fitnessTheme.background,
            },
            headerTintColor: fitnessTheme.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={fitnessTheme.primary} />
          <Text style={styles.loadingText}>Generating analysis report...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen 
        options={{
          title: 'Analysis Report',
          headerStyle: {
            backgroundColor: fitnessTheme.background,
          },
          headerTintColor: fitnessTheme.text,
        }}
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Ionicons name="analytics" size={32} color={fitnessTheme.primary} />
          <Text style={styles.headerTitle}>Comprehensive Analysis</Text>
        </View>
        
        {/* Overall Stats */}
        <Text style={styles.sectionTitle}>OVERALL PERFORMANCE</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalSessions}</Text>
              <Text style={styles.statLabel}>Total Sessions</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.averageScore.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Average Score</Text>
            </View>
          </View>
          
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.bestExercise}</Text>
              <Text style={styles.statLabel}>Best Exercise</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.improvementArea}</Text>
              <Text style={styles.statLabel}>Needs Improvement</Text>
            </View>
          </View>
        </View>
        
        {/* Exercise Summaries */}
        <Text style={styles.sectionTitle}>EXERCISE BREAKDOWN</Text>
        
        {/* Deadlift */}
        <View style={styles.exerciseSection}>
          <View style={styles.exerciseHeader}>
            <View style={styles.exerciseTitleContainer}>
              <View style={styles.exerciseImageContainer}>
                <Image
                  source={require('../assets/images/exercises/deadlift.png')}
                  style={styles.exerciseImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.exerciseTitle}>Deadlift</Text>
            </View>
            
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigateToExerciseAnalysis('deadlift')}
            >
              <Text style={styles.viewButtonText}>View Details</Text>
            </TouchableOpacity>
          </View>
          
          <ProgressChart 
            data={deadliftData}
            title="Deadlift Form Scores"
            color="#FF3B4E"
          />
        </View>
        
        {/* Squat */}
        <View style={styles.exerciseSection}>
          <View style={styles.exerciseHeader}>
            <View style={styles.exerciseTitleContainer}>
              <View style={styles.exerciseImageContainer}>
                <Image
                  source={require('../assets/images/exercises/squat.png')}
                  style={styles.exerciseImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.exerciseTitle}>Squat</Text>
            </View>
            
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigateToExerciseAnalysis('squat')}
            >
              <Text style={styles.viewButtonText}>View Details</Text>
            </TouchableOpacity>
          </View>
          
          <ProgressChart 
            data={squatData}
            title="Squat Form Scores"
            color="#00A3FF"
          />
        </View>
        
        {/* Bench Press */}
        <View style={styles.exerciseSection}>
          <View style={styles.exerciseHeader}>
            <View style={styles.exerciseTitleContainer}>
              <View style={styles.exerciseImageContainer}>
                <Image
                  source={require('../assets/images/exercises/bench.png')}
                  style={styles.exerciseImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.exerciseTitle}>Bench Press</Text>
            </View>
            
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigateToExerciseAnalysis('bench')}
            >
              <Text style={styles.viewButtonText}>View Details</Text>
            </TouchableOpacity>
          </View>
          
          <ProgressChart 
            data={benchData}
            title="Bench Press Form Scores"
            color="#00C49A"
          />
        </View>
        
        {/* Recommendations */}
        <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
        <View style={styles.recommendationsContainer}>
          {deadliftData.length === 0 && squatData.length === 0 && benchData.length === 0 ? (
            <Text style={styles.noDataText}>
              Complete workouts to receive personalized recommendations
            </Text>
          ) : (
            <>
              <View style={styles.recommendation}>
                <Ionicons name="trophy" size={20} color={fitnessTheme.primary} />
                <Text style={styles.recommendationText}>
                  Continue focusing on {stats.bestExercise} as it's your strongest lift
                </Text>
              </View>
              
              <View style={styles.recommendation}>
                <Ionicons name="trending-up" size={20} color={fitnessTheme.secondary} />
                <Text style={styles.recommendationText}>
                  Work on improving {stats.improvementArea} form for better overall results
                </Text>
              </View>
              
              <View style={styles.recommendation}>
                <Ionicons name="calendar" size={20} color={fitnessTheme.accent} />
                <Text style={styles.recommendationText}>
                  Track your progress consistently to identify long-term trends
                </Text>
              </View>
              
              <View style={styles.recommendation}>
                <Ionicons name="videocam" size={20} color={fitnessTheme.primary} />
                <Text style={styles.recommendationText}>
                  Record your lifts regularly to maintain good form habits
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: fitnessTheme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: fitnessTheme.text,
    marginTop: 16,
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: fitnessTheme.text,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: fitnessTheme.primary,
    marginBottom: 12,
    marginTop: 16,
  },
  statsContainer: {
    backgroundColor: fitnessTheme.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    width: '48%',
  },
  statValue: {
    color: fitnessTheme.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: fitnessTheme.textMuted,
    fontSize: 14,
  },
  exerciseSection: {
    marginBottom: 24,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseImageContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: fitnessTheme.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  exerciseTitle: {
    color: fitnessTheme.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  viewButton: {
    backgroundColor: fitnessTheme.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  viewButtonText: {
    color: fitnessTheme.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  recommendationsContainer: {
    backgroundColor: fitnessTheme.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  recommendationText: {
    color: fitnessTheme.text,
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  noDataText: {
    color: fitnessTheme.textMuted,
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
}); 