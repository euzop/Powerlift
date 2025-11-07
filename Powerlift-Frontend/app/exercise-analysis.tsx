import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useProgress from '../hooks/useProgress';
import ProgressChart from '../components/ProgressChart';
import ExerciseTips from '../components/ExerciseTips';
import { fitnessTheme } from '../constants/Colors';

export default function ExerciseAnalysisScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exerciseType: string }>();
  const exerciseType = params.exerciseType || 'deadlift';
  
  const { loading: loadingProgress, progressData, fetchProgressByExercise } = useProgress();
  const [exerciseData, setExerciseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadExerciseData = async () => {
      try {
        setLoading(true);
        const data = await fetchProgressByExercise(exerciseType);
        setExerciseData(data);
      } catch (error) {
        console.error('Error loading exercise data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadExerciseData();
  }, [exerciseType, fetchProgressByExercise]);
  
  // Get exercise title
  const getExerciseTitle = () => {
    switch (exerciseType) {
      case 'deadlift':
        return 'Deadlift';
      case 'squat':
        return 'Squat';
      case 'bench':
        return 'Bench Press';
      default:
        return 'Exercise';
    }
  };
  
  // Get exercise image source
  const getExerciseImage = () => {
    switch (exerciseType) {
      case 'deadlift':
        return require('../assets/images/exercises/deadlift.png');
      case 'squat':
        return require('../assets/images/exercises/squat.png');
      case 'bench':
        return require('../assets/images/exercises/bench.png');
      default:
        return require('../assets/images/exercises/deadlift.png');
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen 
        options={{
          title: `${getExerciseTitle()} Analysis`,
          headerStyle: {
            backgroundColor: fitnessTheme.background,
          },
          headerTintColor: fitnessTheme.text,
        }}
      />
      
      {loading || loadingProgress ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={fitnessTheme.primary} />
          <Text style={styles.loadingText}>Loading analysis data...</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <View style={styles.exerciseImageContainer}>
              <Image 
                source={getExerciseImage()} 
                style={styles.exerciseImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.headerTitle}>{getExerciseTitle()} Analysis</Text>
          </View>
          
          <Text style={styles.sectionTitle}>PROGRESS OVER TIME</Text>
          <ProgressChart 
            data={exerciseData}
            title="Form Score History"
            color={fitnessTheme.primary}
          />
          
          <Text style={styles.sectionTitle}>FORM ANALYSIS</Text>
          <ExerciseTips 
            exerciseType={exerciseType}
            progressData={progressData}
          />
          
          {exerciseData.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
              <View style={styles.sessionsContainer}>
                {[...exerciseData]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 3)
                  .map((session, index) => (
                    <View key={index} style={styles.sessionCard}>
                      <View style={styles.sessionHeader}>
                        <Text style={styles.sessionDate}>
                          {new Date(session.date).toLocaleDateString()}
                        </Text>
                        <Text style={styles.sessionScore}>
                          {session.score.toFixed(1)}
                        </Text>
                      </View>
                      
                      <View style={styles.sessionDetails}>
                        {session.weight_used && (
                          <View style={styles.sessionDetail}>
                            <Ionicons name="barbell-outline" size={16} color={fitnessTheme.textMuted} />
                            <Text style={styles.sessionDetailText}>
                              {session.weight_used} kg
                            </Text>
                          </View>
                        )}
                        
                        {session.body_weight && (
                          <View style={styles.sessionDetail}>
                            <Ionicons name="body-outline" size={16} color={fitnessTheme.textMuted} />
                            <Text style={styles.sessionDetailText}>
                              {session.body_weight} kg
                            </Text>
                          </View>
                        )}
                        
                        {session.notes && (
                          <View style={styles.sessionDetail}>
                            <Ionicons name="document-text-outline" size={16} color={fitnessTheme.textMuted} />
                            <Text style={styles.sessionDetailText}>
                              {session.notes}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
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
  exerciseImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: fitnessTheme.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
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
    marginTop: 8,
  },
  sessionsContainer: {
    marginBottom: 20,
  },
  sessionCard: {
    backgroundColor: fitnessTheme.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionDate: {
    color: fitnessTheme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sessionScore: {
    color: fitnessTheme.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  sessionDetails: {
    borderTopWidth: 1,
    borderTopColor: fitnessTheme.border,
    paddingTop: 12,
  },
  sessionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionDetailText: {
    color: fitnessTheme.text,
    fontSize: 14,
    marginLeft: 8,
  },
}); 