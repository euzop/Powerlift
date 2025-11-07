import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressEntry } from '../hooks/useProgress';
import { fitnessTheme } from '../constants/Colors';

interface ExerciseTipsProps {
  exerciseType: string;
  progressData: ProgressEntry[];
}

// Tips for each exercise type
const EXERCISE_TIPS = {
  deadlift: [
    "Keep your back straight throughout the lift to prevent injury",
    "Drive through your heels, not your toes",
    "Keep the bar close to your body during the entire movement",
    "Engage your lats before lifting to stabilize your spine",
    "Breathe and brace your core before each rep"
  ],
  squat: [
    "Keep your knees tracking over your toes",
    "Maintain a neutral spine position throughout the movement",
    "Descend to at least parallel depth for full benefits",
    "Drive through your heels and mid-foot",
    "Keep your chest up and core braced"
  ],
  bench: [
    "Retract your shoulder blades for a stable base",
    "Keep your feet planted firmly on the ground",
    "Lower the bar to your mid-chest, not your neck or stomach",
    "Maintain a slight arch in your lower back",
    "Keep your wrists straight and directly above your elbows"
  ]
};

// Performance-based tips
const getPerformanceTips = (exerciseType: string, progressData: ProgressEntry[]): string[] => {
  if (progressData.length === 0) return [];
  
  const tips: string[] = [];
  
  // Get recent scores (last 3 entries)
  const recentEntries = [...progressData]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);
  
  const recentScores = recentEntries.map(entry => entry.score);
  const averageRecentScore = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
  
  // Add tips based on recent performance
  if (averageRecentScore < 70) {
    tips.push("Your recent form scores are below average. Consider reducing weight to focus on technique.");
    
    if (exerciseType === 'deadlift') {
      tips.push("Record yourself from the side to check your back position during deadlifts.");
    } else if (exerciseType === 'squat') {
      tips.push("Work on mobility exercises to improve squat depth and form.");
    } else if (exerciseType === 'bench') {
      tips.push("Focus on a controlled eccentric (lowering) phase to improve stability.");
    }
  } else if (averageRecentScore > 85) {
    tips.push("Your form is excellent! Consider progressively increasing weight while maintaining technique.");
  }
  
  // Check for consistency
  if (recentScores.length > 1) {
    const scoreVariance = Math.max(...recentScores) - Math.min(...recentScores);
    if (scoreVariance > 15) {
      tips.push("Your form scores vary significantly between sessions. Focus on consistency in your setup routine.");
    }
  }
  
  return tips;
};

const ExerciseTips: React.FC<ExerciseTipsProps> = ({ exerciseType, progressData }) => {
  // Filter progress data for this exercise type
  const exerciseData = progressData.filter(entry => entry.exercise_type === exerciseType);
  
  // Get general tips for this exercise
  const generalTips = EXERCISE_TIPS[exerciseType as keyof typeof EXERCISE_TIPS] || [];
  
  // Get performance-based tips
  const performanceTips = getPerformanceTips(exerciseType, exerciseData);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Form Improvement Tips</Text>
      
      <ScrollView style={styles.tipsContainer}>
        {exerciseData.length > 0 ? (
          <>
            {performanceTips.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Based on Your Performance</Text>
                {performanceTips.map((tip, index) => (
                  <View key={`performance-${index}`} style={styles.tipItem}>
                    <Ionicons name="analytics" size={20} color={fitnessTheme.secondary} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>General Tips</Text>
              {generalTips.map((tip, index) => (
                <View key={`general-${index}`} style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={20} color={fitnessTheme.primary} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>
              No workout data available for this exercise yet
            </Text>
            <Text style={styles.noDataSubtext}>
              Complete a workout to receive personalized tips
            </Text>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>General Tips</Text>
              {generalTips.map((tip, index) => (
                <View key={`general-${index}`} style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={20} color={fitnessTheme.primary} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: fitnessTheme.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: fitnessTheme.text,
    marginBottom: 16,
  },
  tipsContainer: {
    maxHeight: 300,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: fitnessTheme.textMuted,
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  tipText: {
    color: fitnessTheme.text,
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  noDataContainer: {
    marginBottom: 16,
  },
  noDataText: {
    color: fitnessTheme.text,
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noDataSubtext: {
    color: fitnessTheme.textMuted,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default ExerciseTips; 