import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS, SIZES, Typography } from '../../constants/Typography';
import useAuth from '../../hooks/useAuth';
import useCustomTheme from '../../hooks/useCustomTheme';

export default function ProfileScreen() {
  const { user, signOut, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { theme } = useCustomTheme();
  
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [username, setUsername] = useState(user?.username || 'Guest');
  const [email, setEmail] = useState(user?.email || '');
  const [personWeight, setPersonWeight] = useState(user?.person_weight?.toString() || '');
  const [deadliftWeight, setDeadliftWeight] = useState(user?.deadlift_weight?.toString() || '');
  const [squatWeight, setSquatWeight] = useState(user?.squat_weight?.toString() || '');
  const [benchWeight, setBenchWeight] = useState(user?.bench_weight?.toString() || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingWeightUpdate, setPendingWeightUpdate] = useState<{
    field: string;
    value: string;
    exerciseName: string;
  } | null>(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [modalData, setModalData] = useState<{
    weight: number;
    exerciseName: string;
    bodyWeight: number;
  } | null>(null);

  // Sync form fields with user object when it changes
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setUsername(user.username || 'Guest');
      setEmail(user.email || '');
      setPersonWeight(user.person_weight?.toString() || '');
      setDeadliftWeight(user.deadlift_weight?.toString() || '');
      setSquatWeight(user.squat_weight?.toString() || '');
      setBenchWeight(user.bench_weight?.toString() || '');
    }
  }, [user]);

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
      // Fallback to deadlift if we can't determine the exercise
      exerciseKey = 'deadlift';
    }
    
    const exerciseRanges = ranges[exerciseKey];
    
    // Safety check
    if (!exerciseRanges) {
      console.error('Exercise ranges not found for:', exerciseKey);
      return false;
    }
    
    // Show warning for intermediate+ weights (above beginner max)
    return weight > exerciseRanges.beginner.max;
  };

  const handleWeightInputChange = (value: string, field: string, exerciseName: string) => {
    const weight = parseFloat(value);
    const bodyWeight = parseFloat(personWeight);
    
    // Check if weight is above beginner recommendation
    if (value && !isNaN(weight) && bodyWeight && isWeightAboveBeginner(weight, field, bodyWeight)) {
      setPendingWeightUpdate({ field, value, exerciseName });
      showWeightConfirmationAlert(weight, exerciseName, bodyWeight);
    } else {
      // Update the field directly if within beginner range or no validation needed
      updateWeightField(field, value);
    }
  };

  const updateWeightField = (field: string, value: string) => {
    switch (field) {
      case 'deadlift':
        setDeadliftWeight(value);
        break;
      case 'squat':
        setSquatWeight(value);
        break;
      case 'bench':
        setBenchWeight(value);
        break;
    }
  };

  const showWeightConfirmationAlert = (weight: number, exerciseName: string, bodyWeight: number) => {
    setModalData({ weight, exerciseName, bodyWeight });
    setShowWeightModal(true);
  };

  const handleConfirmWeight = () => {
    if (pendingWeightUpdate) {
      updateWeightField(pendingWeightUpdate.field, pendingWeightUpdate.value);
      setPendingWeightUpdate(null);
    }
    setShowWeightModal(false);
    setModalData(null);
  };

  const handleCancelWeight = () => {
    setPendingWeightUpdate(null);
    setShowWeightModal(false);
    setModalData(null);
  };

  const handleUpdateProfile = async () => {
    // Validate inputs
    if (username.trim().length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    if (email && !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Convert weight values to numbers if provided
    const personWeightNum = personWeight ? parseFloat(personWeight) : undefined;
    const deadliftWeightNum = deadliftWeight ? parseFloat(deadliftWeight) : undefined;
    const squatWeightNum = squatWeight ? parseFloat(squatWeight) : undefined;
    const benchWeightNum = benchWeight ? parseFloat(benchWeight) : undefined;

    // Check if this is a weight-only update (no password required)
    const weightFields = [personWeightNum, deadliftWeightNum, squatWeightNum, benchWeightNum];
    const profileFields = [username !== user?.username, email !== user?.email, 
                          firstName !== user?.first_name, lastName !== user?.last_name, newPassword];
    
    const isWeightOnlyUpdate = weightFields.some(field => field !== undefined) && 
                              !profileFields.some(field => field);

    // Verify password only for non-weight updates
    if (!isWeightOnlyUpdate && !oldPassword) {
      Alert.alert('Error', 'Current password is required for profile changes');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    // Only update fields that have changed
    const updates: {
      username?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      person_weight?: number;
      barbell_weight?: number;
      deadlift_weight?: number;
      squat_weight?: number;
      bench_weight?: number;
      old_password?: string;
      new_password?: string;
    } = {};
    
    // Add password only if updating profile info
    if (!isWeightOnlyUpdate) {
      updates.old_password = oldPassword;
    }
    
    if (username !== user?.username) {
      updates.username = username;
    }
    
    if (email !== user?.email && email.trim() !== '') {
      updates.email = email;
    }
    
    if (firstName !== user?.first_name) {
      updates.first_name = firstName;
    }
    
    if (lastName !== user?.last_name) {
      updates.last_name = lastName;
    }
    
    if (personWeightNum !== user?.person_weight) {
      updates.person_weight = personWeightNum;
    }
    
    if (deadliftWeightNum !== user?.deadlift_weight) {
      updates.deadlift_weight = deadliftWeightNum;
    }
    
    if (squatWeightNum !== user?.squat_weight) {
      updates.squat_weight = squatWeightNum;
    }
    
    if (benchWeightNum !== user?.bench_weight) {
      updates.bench_weight = benchWeightNum;
    }
    
    if (newPassword) {
      updates.new_password = newPassword;
    }
    
    // Check if there are any updates to make
    if (Object.keys(updates).length === 0) {
      Alert.alert('No Changes', 'No changes were made to your profile');
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile(updates);
      setSuccessMessage('Profile updated successfully!');
      
      // Clear password fields after successful update
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // The useEffect will automatically sync weight fields when user object updates
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Failed to update profile:', error);
      // Alert message is handled by useAuth hook
    } finally {
      setIsLoading(false);
    }
  };

  const renderWeightConfirmationModal = () => {
    if (!modalData) return null;

    const ranges = getRecommendedWeightRanges(modalData.bodyWeight);
    
    // Map exercise name to the correct key
    let exerciseKey: keyof typeof ranges;
    const exerciseName = modalData.exerciseName.toLowerCase();
    
    if (exerciseName.includes('deadlift')) {
      exerciseKey = 'deadlift';
    } else if (exerciseName.includes('squat')) {
      exerciseKey = 'squat';
    } else if (exerciseName.includes('bench')) {
      exerciseKey = 'bench';
    } else {
      // Fallback to deadlift if we can't determine the exercise
      exerciseKey = 'deadlift';
    }
    
    const exerciseRanges = ranges[exerciseKey];

    // Safety check to ensure exercise ranges exist
    if (!exerciseRanges) {
      console.error('Exercise ranges not found for:', exerciseKey);
      return null;
    }

    return (
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

              <View style={[styles.rangesContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.rangesTitle, { color: theme.primary }]}>
                  Recommended ranges based on experience level:
                </Text>
                
                <View style={styles.rangeRow}>
                  <Text style={[styles.levelLabel, { color: theme.success }]}>Beginner:</Text>
                  <Text style={[styles.rangeText, { color: theme.text }]}>
                    {exerciseRanges.beginner.min.toFixed(0)}–{exerciseRanges.beginner.max.toFixed(0)} kg
                  </Text>
                  <Text style={[styles.multiplierText, { color: theme.textMuted }]}>
                    ({(exerciseRanges.beginner.min / modalData.bodyWeight).toFixed(2)}×–{(exerciseRanges.beginner.max / modalData.bodyWeight).toFixed(2)}× bodyweight)
                  </Text>
                </View>

                <View style={styles.rangeRow}>
                  <Text style={[styles.levelLabel, { color: theme.warning }]}>Intermediate:</Text>
                  <Text style={[styles.rangeText, { color: theme.text }]}>
                    {exerciseRanges.intermediate.min.toFixed(0)}–{exerciseRanges.intermediate.max.toFixed(0)} kg
                  </Text>
                  <Text style={[styles.multiplierText, { color: theme.textMuted }]}>
                    ({(exerciseRanges.intermediate.min / modalData.bodyWeight).toFixed(2)}×–{(exerciseRanges.intermediate.max / modalData.bodyWeight).toFixed(2)}× bodyweight)
                  </Text>
                </View>

                <View style={styles.rangeRow}>
                  <Text style={[styles.levelLabel, { color: theme.error }]}>Advanced:</Text>
                  <Text style={[styles.rangeText, { color: theme.text }]}>
                    {exerciseRanges.advanced.min.toFixed(0)}–{exerciseRanges.advanced.max.toFixed(0)} kg
                  </Text>
                  <Text style={[styles.multiplierText, { color: theme.textMuted }]}>
                    ({(exerciseRanges.advanced.min / modalData.bodyWeight).toFixed(2)}×–{(exerciseRanges.advanced.max / modalData.bodyWeight).toFixed(2)}× bodyweight)
                  </Text>
                </View>
              </View>

              <View style={[styles.tipContainer, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                <Ionicons name="bulb-outline" size={20} color={theme.warning} style={styles.tipIcon} />
                <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                  It's okay to adjust your weight if you're unsure or just testing your max.
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
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.contentContainer, { paddingBottom: insets.bottom + 100 }]}>
          <Text style={[styles.title, { color: theme.text }]}>User Profile</Text>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Update Profile</Text>
          
          {successMessage ? (
            <Text style={[styles.successMessage, { color: theme.success }]}>{successMessage}</Text>
          ) : null}
          
          <View style={styles.nameRow}>
            <View style={[styles.inputContainer, styles.halfInput]}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>First Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            
            <View style={[styles.inputContainer, styles.halfInput]}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Last Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>
          
          <Text style={[styles.inputLabel, { color: theme.text }]}>Username</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            placeholderTextColor={theme.textMuted}
          />
          
          <Text style={[styles.inputLabel, { color: theme.text }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email"
            placeholderTextColor={theme.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Update Weights</Text>
          
          
          <Text style={[styles.inputLabel, { color: theme.text }]}>Your Weight (kg)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            value={personWeight}
            onChangeText={setPersonWeight}
            placeholder="Your weight"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
          />
          
          <Text style={[styles.inputLabel, { color: theme.text }]}>Deadlift Barbell Weight (kg)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            value={deadliftWeight}
            onChangeText={(value) => handleWeightInputChange(value, 'deadlift', 'Deadlift Barbell Weight')}
            placeholder="Barbell Weight for Deadlift"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
          />
          
          <Text style={[styles.inputLabel, { color: theme.text }]}>Squat Barbell Weight (kg)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            value={squatWeight}
            onChangeText={(value) => handleWeightInputChange(value, 'squat', 'Squat Barbell Weight')}
            placeholder="Barbell Weight for Squat"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
          />
          
          <Text style={[styles.inputLabel, { color: theme.text }]}>Bench Barbell Weight (kg)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            value={benchWeight}
            onChangeText={(value) => handleWeightInputChange(value, 'bench', 'Bench Barbell Weight')}
            placeholder="Barbell Weight for Bench Press"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
          />
          
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>Change Password</Text>
          
          <Text style={[styles.inputLabel, { color: theme.text }]}>Current Password</Text>
          <View style={[styles.passwordContainer, { backgroundColor: theme.surface }]}>
            <TextInput
              style={[styles.passwordInput, { color: theme.text }]}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Enter current password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showOldPassword}
              autoCapitalize="none"
            />
            <Pressable 
              style={styles.eyeIcon} 
              onPress={() => setShowOldPassword(!showOldPassword)}
            >
              <Ionicons 
                name={showOldPassword ? "eye-off-outline" : "eye-outline"} 
                size={24} 
                color={theme.textMuted} 
              />
            </Pressable>
          </View>
          
          <Text style={[styles.inputLabel, { color: theme.text }]}>New Password</Text>
          <View style={[styles.passwordContainer, { backgroundColor: theme.surface }]}>
            <TextInput
              style={[styles.passwordInput, { color: theme.text }]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
            />
            <Pressable 
              style={styles.eyeIcon} 
              onPress={() => setShowNewPassword(!showNewPassword)}
            >
              <Ionicons 
                name={showNewPassword ? "eye-off-outline" : "eye-outline"} 
                size={24} 
                color={theme.textMuted} 
              />
            </Pressable>
          </View>
          
          <Text style={[styles.inputLabel, { color: theme.text }]}>Confirm New Password</Text>
          <View style={[styles.passwordContainer, { backgroundColor: theme.surface }]}>
            <TextInput
              style={[styles.passwordInput, { color: theme.text }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <Pressable 
              style={styles.eyeIcon} 
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons 
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                size={24} 
                color={theme.textMuted} 
              />
            </Pressable>
          </View>
          
          <TouchableOpacity 
            style={[styles.updateButton, { backgroundColor: theme.primary }]}
            onPress={handleUpdateProfile}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.updateButtonText}>Update Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {renderWeightConfirmationModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
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
    ...Typography.h4,
    marginBottom: 20,
    marginTop: 10,
    textAlign: 'center',
  },
  noteText: {
    ...Typography.body2,
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  successMessage: {
    ...Typography.body1,
    textAlign: 'center',
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  halfInput: {
    width: '48%',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    ...Typography.body2,
    fontFamily: FONTS.medium,
    marginBottom: 8,
  },
  input: {
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontFamily: FONTS.regular,
    fontSize: SIZES.body1,
  },
  passwordContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontFamily: FONTS.regular,
    fontSize: SIZES.body1,
  },
  eyeIcon: {
    padding: 15,
  },
  updateButton: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  updateButtonText: {
    ...Typography.button,
    color: '#000000',
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
    flexShrink: 0, // Prevent shrinking
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
    flexShrink: 0, // Prevent shrinking
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48, // Ensure minimum touch target
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