import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '../../hooks/useAuth';
import { FONTS, SIZES, Typography } from '../../constants/Typography';
import useCustomTheme from '../../hooks/useCustomTheme';

export default function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const { theme } = useCustomTheme();
  
  const [bodyWeight, setBodyWeight] = useState('');
  const [weightUsed, setWeightUsed] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<'deadlift' | 'bench' | 'squat'>('deadlift');
  const [pendingWeightUpdate, setPendingWeightUpdate] = useState<{
    exercise: string;
    value: string;
  } | null>(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [modalData, setModalData] = useState<{
    weight: number;
    exerciseName: string;
    bodyWeight: number;
  } | null>(null);

  // Auto-populate weights from user profile when component mounts or user changes
  useEffect(() => {
    if (user) {
      // Set body weight from user profile if available
      if (user.person_weight) {
        setBodyWeight(user.person_weight.toString());
      }
    }
  }, [user]);

  // Update exercise weight when selected exercise changes
  useEffect(() => {
    if (user) {
      // Set exercise-specific weight based on selected exercise
      switch (selectedExercise) {
        case 'deadlift':
          if (user.deadlift_weight) {
            setWeightUsed(user.deadlift_weight.toString());
          }
          break;
        case 'squat':
          if (user.squat_weight) {
            setWeightUsed(user.squat_weight.toString());
          }
          break;
        case 'bench':
          if (user.bench_weight) {
            setWeightUsed(user.bench_weight.toString());
          }
          break;
      }
    }
  }, [user, selectedExercise]);

  // Weight validation functions
  const getRecommendedWeightRanges = (bodyWeight: number) => {
    const deadliftBeginnerMax = Math.floor(bodyWeight * 1.25);
    const deadliftIntermediateMax = Math.floor(bodyWeight * 1.75);
    
    const squatBeginnerMax = Math.floor(bodyWeight * 1.0);
    const squatIntermediateMax = Math.floor(bodyWeight * 1.5);
    
    const benchBeginnerMax = Math.floor(bodyWeight * 0.75);
    const benchIntermediateMax = Math.floor(bodyWeight * 1.0);
    
    return {
      deadlift: {
        beginner: { min: Math.floor(bodyWeight * 1.0), max: deadliftBeginnerMax },
        intermediate: { min: deadliftBeginnerMax + 1, max: deadliftIntermediateMax },
        advanced: { min: deadliftIntermediateMax + 1, max: Math.floor(bodyWeight * 2.5) }
      },
      squat: {
        beginner: { min: Math.floor(bodyWeight * 0.75), max: squatBeginnerMax },
        intermediate: { min: squatBeginnerMax + 1, max: squatIntermediateMax },
        advanced: { min: squatIntermediateMax + 1, max: Math.floor(bodyWeight * 2.0) }
      },
      bench: {
        beginner: { min: Math.floor(bodyWeight * 0.5), max: benchBeginnerMax },
        intermediate: { min: benchBeginnerMax + 1, max: benchIntermediateMax },
        advanced: { min: benchIntermediateMax + 1, max: Math.floor(bodyWeight * 1.5) }
      }
    };
  };

  const isWeightAboveBeginner = (weight: number, exercise: string, bodyWeight: number) => {
    if (!bodyWeight || bodyWeight <= 0) return false;
    
    const ranges = getRecommendedWeightRanges(bodyWeight);
    
    // Map exercise field to the correct key
    let exerciseKey: keyof typeof ranges;
    if (exercise === 'deadlift') {
      exerciseKey = 'deadlift';
    } else if (exercise === 'squat') {
      exerciseKey = 'squat';
    } else if (exercise === 'bench') {
      exerciseKey = 'bench';
    } else {
      exerciseKey = 'deadlift';
    }
    
    const exerciseRanges = ranges[exerciseKey];
    
    if (!exerciseRanges) {
      console.error('Exercise ranges not found for:', exerciseKey);
      return false;
    }
    
    // Show warning for intermediate+ weights (above beginner max)
    return weight > exerciseRanges.beginner.max;
  };

  const handleWeightInputChange = async (value: string) => {
    const weight = parseFloat(value);
    const userBodyWeight = parseFloat(bodyWeight);
    
    // Always update the local state first
    setWeightUsed(value);
    
    // Update profile if we have a valid weight
    if (value && !isNaN(weight)) {
      try {
        const updates: any = {};
        if (selectedExercise === 'deadlift') {
          updates.deadlift_weight = weight;
        } else if (selectedExercise === 'squat') {
          updates.squat_weight = weight;
        } else if (selectedExercise === 'bench') {
          updates.bench_weight = weight;
        }
        
        await updateProfile(updates);
      } catch (error) {
        console.error('Failed to update profile with new weight:', error);
      }
    }
    
    // Check if weight is above beginner recommendation to show confirmation
    if (value && !isNaN(weight) && userBodyWeight && isWeightAboveBeginner(weight, selectedExercise, userBodyWeight)) {
      setPendingWeightUpdate({ exercise: selectedExercise, value });
      showWeightConfirmationAlert(weight, selectedExercise, userBodyWeight);
    }
  };

  const showWeightConfirmationAlert = (weight: number, exerciseName: string, bodyWeight: number) => {
    const exerciseDisplayName = exerciseName === 'bench' ? 'Bench Press' : 
                                exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1);
    setModalData({ weight, exerciseName: exerciseDisplayName, bodyWeight });
    setShowWeightModal(true);
  };

  const handleConfirmWeight = async () => {
    // No need to update profile here since it's already updated in handleWeightInputChange
    // Just clear the pending state and close modal
    setPendingWeightUpdate(null);
    setShowWeightModal(false);
    setModalData(null);
  };

  const handleCancelWeight = async () => {
    // Restore the original weight from user profile and revert the profile update
    if (pendingWeightUpdate && user) {
      let originalWeight = '';
      if (pendingWeightUpdate.exercise === 'deadlift' && user.deadlift_weight) {
        originalWeight = user.deadlift_weight.toString();
      } else if (pendingWeightUpdate.exercise === 'squat' && user.squat_weight) {
        originalWeight = user.squat_weight.toString();
      } else if (pendingWeightUpdate.exercise === 'bench' && user.bench_weight) {
        originalWeight = user.bench_weight.toString();
      }
      
      // Restore local state
      setWeightUsed(originalWeight);
      
      // Restore profile if we had an original weight
      if (originalWeight) {
        try {
          const updates: any = {};
          if (pendingWeightUpdate.exercise === 'deadlift') {
            updates.deadlift_weight = parseFloat(originalWeight);
          } else if (pendingWeightUpdate.exercise === 'squat') {
            updates.squat_weight = parseFloat(originalWeight);
          } else if (pendingWeightUpdate.exercise === 'bench') {
            updates.bench_weight = parseFloat(originalWeight);
          }
          
          await updateProfile(updates);
        } catch (error) {
          console.error('Failed to restore original weight in profile:', error);
        }
      }
    }
    
    setPendingWeightUpdate(null);
    setShowWeightModal(false);
    setModalData(null);
  };

  const handleRecordVideo = () => {
    // Navigate to video recording screen with exercise type and weights
    router.push({
      pathname: '/video-analysis',
      params: {
        exerciseType: selectedExercise,
        bodyWeight,
        weightUsed
      }
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>Record Exercise Video</Text>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        
        <Text style={[styles.sectionTitle, { color: theme.primary }]}>VIDEO RECORD</Text>
        
        <View style={styles.exercisesContainer}>
          {/* Deadlift Card */}
          <TouchableOpacity 
            style={[
              styles.exerciseCard,
              { backgroundColor: theme.surface },
              selectedExercise === 'deadlift' && [
                styles.selectedExerciseCard, 
                { 
                  borderColor: theme.primary,
                  backgroundColor: `${theme.primary}20`
                }
              ]
            ]}
            onPress={() => setSelectedExercise('deadlift')}
          >
            <View style={styles.imageContainer}>
              <Image 
                source={require('../../assets/images/exercises/deadlift.png')} 
                style={styles.exerciseImage} 
                resizeMode="contain"
              />
            </View>
            <Text style={[
              styles.exerciseText,
              { color: theme.textMuted },
              selectedExercise === 'deadlift' && { color: theme.primary }
            ]}>
              DEADLIFT
            </Text>
          </TouchableOpacity>
          
          {/* Bench Press Card */}
          <TouchableOpacity 
            style={[
              styles.exerciseCard,
              { backgroundColor: theme.surface },
              selectedExercise === 'bench' && [
                styles.selectedExerciseCard, 
                { 
                  borderColor: theme.primary,
                  backgroundColor: `${theme.primary}20`
                }
              ]
            ]}
            onPress={() => setSelectedExercise('bench')}
          >
            <View style={styles.imageContainer}>
              <Image 
                source={require('../../assets/images/exercises/bench.png')} 
                style={styles.exerciseImage} 
                resizeMode="contain"
              />
            </View>
            <Text style={[
              styles.exerciseText,
              { color: theme.textMuted },
              selectedExercise === 'bench' && { color: theme.primary }
            ]}>
              BENCH PRESS
            </Text>
          </TouchableOpacity>
          
          {/* Squat Card */}
          <TouchableOpacity 
            style={[
              styles.exerciseCard,
              { backgroundColor: theme.surface },
              selectedExercise === 'squat' && [
                styles.selectedExerciseCard, 
                { 
                  borderColor: theme.primary,
                  backgroundColor: `${theme.primary}20`
                }
              ]
            ]}
            onPress={() => setSelectedExercise('squat')}
          >
            <View style={styles.imageContainer}>
              <Image 
                source={require('../../assets/images/exercises/squat.png')} 
                style={styles.exerciseImage} 
                resizeMode="contain"
              />
            </View>
            <Text style={[
              styles.exerciseText,
              { color: theme.textMuted },
              selectedExercise === 'squat' && { color: theme.primary }
            ]}>
              SQUAT
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            placeholder="Enter Body Weight"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
            value={bodyWeight}
            onChangeText={setBodyWeight}
          />
          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Your Weight (kg)</Text>
        </View>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            placeholder={`Enter ${selectedExercise.charAt(0).toUpperCase() + selectedExercise.slice(1)} Weight`}
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
            value={weightUsed}
            onChangeText={handleWeightInputChange}
          />
          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>
            {selectedExercise.charAt(0).toUpperCase() + selectedExercise.slice(1)} Weight (kg)
          </Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.recordButton, { backgroundColor: theme.primary }]}
            onPress={handleRecordVideo}
          >
            <Ionicons name="videocam" size={20} color="#000000" style={styles.buttonIcon} />
            <Text style={styles.recordButtonText}>
              RECORD {selectedExercise.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Weight Confirmation Modal */}
      {showWeightModal && modalData && (
        <Modal
          visible={showWeightModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelWeight}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: theme.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Confirm Your Input</Text>
              </View>
              
              <ScrollView 
                style={styles.modalContent} 
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.weightDisplayContainer}>
                  <Text style={[styles.weightDisplayText, { color: theme.text }]}>
                    You entered <Text style={[styles.weightValue, { color: theme.primary }]}>{modalData.weight} kg</Text> for your{' '}
                    <Text style={[styles.exerciseName, { color: theme.primary }]}>{modalData.exerciseName}</Text>.
                  </Text>
                </View>

                <Text style={[styles.questionText, { color: theme.text }]}>
                  Are you sure about this weight?
                </Text>

                {(() => {
                  const ranges = getRecommendedWeightRanges(modalData.bodyWeight);
                  const exerciseKey = selectedExercise as keyof typeof ranges;
                  const exerciseRanges = ranges[exerciseKey];

                  return (
                    <View style={[styles.rangesContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.rangesTitle, { color: theme.primary }]}>
                        Recommended ranges based on experience level:
                      </Text>
                      
                      <View style={styles.rangeRow}>
                        <Text style={[styles.levelLabel, { color: theme.success }]}>Beginner:</Text>
                        <Text style={[styles.rangeText, { color: theme.text }]}>
                          {exerciseRanges.beginner.min}–{exerciseRanges.beginner.max} kg
                        </Text>
                        <Text style={[styles.multiplierText, { color: theme.textMuted }]}>
                          ({(exerciseRanges.beginner.min / modalData.bodyWeight).toFixed(2)}×–{(exerciseRanges.beginner.max / modalData.bodyWeight).toFixed(2)}× bodyweight)
                        </Text>
                      </View>

                      <View style={styles.rangeRow}>
                        <Text style={[styles.levelLabel, { color: theme.warning }]}>Intermediate:</Text>
                        <Text style={[styles.rangeText, { color: theme.text }]}>
                          {exerciseRanges.intermediate.min}–{exerciseRanges.intermediate.max} kg
                        </Text>
                        <Text style={[styles.multiplierText, { color: theme.textMuted }]}>
                          ({(exerciseRanges.intermediate.min / modalData.bodyWeight).toFixed(2)}×–{(exerciseRanges.intermediate.max / modalData.bodyWeight).toFixed(2)}× bodyweight)
                        </Text>
                      </View>

                      <View style={styles.rangeRow}>
                        <Text style={[styles.levelLabel, { color: theme.error }]}>Advanced:</Text>
                        <Text style={[styles.rangeText, { color: theme.text }]}>
                          {exerciseRanges.advanced.min}–{exerciseRanges.advanced.max} kg
                        </Text>
                        <Text style={[styles.multiplierText, { color: theme.textMuted }]}>
                          ({(exerciseRanges.advanced.min / modalData.bodyWeight).toFixed(2)}×–{(exerciseRanges.advanced.max / modalData.bodyWeight).toFixed(2)}× bodyweight)
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                <View style={[styles.tipContainer, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                  <Ionicons name="bulb-outline" size={20} color={theme.warning} style={styles.tipIcon} />
                  <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                    This will also update your profile with the new weight.
                  </Text>
                </View>
              </ScrollView>

              <View style={[styles.modalActions, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.surfaceVariant }]}
                  onPress={handleCancelWeight}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton, { backgroundColor: theme.primary }]}
                  onPress={handleConfirmWeight}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120, // Increased bottom padding to avoid tab bar overlap
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
    ...Typography.h5,
    fontFamily: FONTS.bold,
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 1,
  },
  exercisesContainer: {
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  exerciseCard: {
    width: '30%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedExerciseCard: {
    // Style overrides for selected card are applied inline
  },
  imageContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseImage: {
    width: 60,
    height: 60,
  },
  exerciseText: {
    ...Typography.caption,
    fontFamily: FONTS.semiBold,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  selectedExerciseText: {
    // Color override is applied inline
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    borderRadius: 8,
    padding: 15,
    marginBottom: 5,
    fontFamily: FONTS.regular,
    fontSize: SIZES.body1,
  },
  inputLabel: {
    ...Typography.caption,
    fontFamily: FONTS.medium,
    textAlign: 'center',
    marginBottom: 10,
  },
  buttonContainer: {
    marginTop: 10,
  },
  recordButton: {
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  recordButtonText: {
    ...Typography.button,
    fontFamily: FONTS.bold,
    color: '#000000',
    letterSpacing: 1,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 600,
    borderRadius: 12,
    maxHeight: '100%',
    minHeight: 500,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    display: 'flex',
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
    flexShrink: 0,
  },
  modalTitle: {
    ...Typography.h3,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 8,
  },
  weightDisplayContainer: {
    marginBottom: 20,
  },
  weightDisplayText: {
    ...Typography.body1,
    textAlign: 'center',
    lineHeight: 24,
  },
  weightValue: {
    ...Typography.h4,
    fontFamily: FONTS.bold,
  },
  exerciseName: {
    fontFamily: FONTS.medium,
  },
  questionText: {
    ...Typography.body1,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: FONTS.medium,
  },
  rangesContainer: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  rangesTitle: {
    ...Typography.body1,
    fontFamily: FONTS.medium,
    marginBottom: 12,
    textAlign: 'center',
  },
  rangeRow: {
    marginBottom: 8,
  },
  levelLabel: {
    ...Typography.body2,
    fontFamily: FONTS.medium,
    marginBottom: 2,
  },
  rangeText: {
    ...Typography.body1,
    marginBottom: 2,
  },
  multiplierText: {
    ...Typography.caption,
    fontStyle: 'italic',
  },
  tipContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  tipIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  tipText: {
    ...Typography.body2,
    flex: 1,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 20,
    gap: 12,
    flexShrink: 0,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  confirmButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelButtonText: {
    ...Typography.button,
  },
  confirmButtonText: {
    ...Typography.button,
    color: '#000000',
  },
}); 