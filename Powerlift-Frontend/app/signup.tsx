import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useCustomTheme from '../hooks/useCustomTheme';
import useErrorToast from '../hooks/useErrorToast';
import PowerLiftAPI from '../services/api';

export default function SignupScreen() {
  const router = useRouter();
  const { showError, showSuccess } = useErrorToast();
  const { theme } = useCustomTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [personWeight, setPersonWeight] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Handle person weight change
  const handlePersonWeightChange = (value: string) => {
    setPersonWeight(value);
  };

  const handleSignup = async () => {
    // Basic validation
    if (!firstName) {
      showError('Please enter your first name');
      return;
    }

    if (!lastName) {
      showError('Please enter your last name');
      return;
    }

    if (!username) {
      showError('Please enter a username');
      return;
    }
    
    if (!email) {
      showError('Please enter your email address');
      return;
    }
    
    if (!password) {
      showError('Please create a password');
      return;
    }

    if (!confirmPassword) {
      showError('Please confirm your password');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }    // Convert weight values to numbers or undefined
    const personWeightNum = personWeight ? parseFloat(personWeight) : undefined;

    setIsLoading(true);

    try {
      const response = await PowerLiftAPI.register(
        username, 
        email, 
        password, 
        firstName, 
        lastName,
        personWeightNum,
        undefined // No barbell weight
      );
      
      // Set verification sent state
      setVerificationSent(true);
      setRegisteredEmail(email);
      
      // Show success message
      showSuccess('Account created successfully! Please check your email to verify your account.');
      
    } catch (error) {
      console.error('Signup error:', error);
      showError('This email or username may already be in use');
      setVerificationSent(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!registeredEmail) return;
    
    setIsLoading(true);
    
    try {
      await PowerLiftAPI.resendVerification(registeredEmail);
      showSuccess('Verification email has been resent');
    } catch (error) {
      console.error('Resend verification error:', error);
      showError('Failed to resend verification email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    router.replace({
      pathname: '/login',
      params: { email: registeredEmail }
    });
  };

  // Show verification sent screen
  if (verificationSent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          <Ionicons name="mail" size={64} color={theme.primary} />
          <Text style={[styles.title, { color: theme.primary }]}>Verify Your Email</Text>
          
          <Text style={[styles.verificationText, { color: theme.textSecondary }]}>
            We've sent a verification link to:
          </Text>
          <Text style={[styles.emailText, { color: theme.primary }]}>{registeredEmail}</Text>
          
          <Text style={[styles.verificationText, { color: theme.textSecondary }]}>
            Please check your inbox and click the link to verify your account.
          </Text>
          
          <TouchableOpacity 
            style={[styles.resendButton, { backgroundColor: theme.surface }]}
            onPress={handleResendVerification}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <Text style={[styles.resendButtonText, { color: theme.primary }]}>Resend Verification Email</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={handleGoToLogin}
          >
            <Text style={[styles.loginButtonText, { color: theme.secondary }]}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color={theme.text} />
      </TouchableOpacity>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.primary }]}>Sign Up to Powerlift</Text>
          
          <View style={styles.nameRow}>
            <View style={[styles.inputContainer, styles.halfInput]}>
              <Text style={[styles.label, { color: theme.text }]}>First Name</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.surface, 
                  color: theme.text 
                }]}
                placeholder="First name"
                placeholderTextColor={theme.textMuted}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            
            <View style={[styles.inputContainer, styles.halfInput]}>
              <Text style={[styles.label, { color: theme.text }]}>Last Name</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.surface, 
                  color: theme.text 
                }]}
                placeholder="Last name"
                placeholderTextColor={theme.textMuted}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Username</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.surface, 
                color: theme.text 
              }]}
              placeholder="Choose a username"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Email</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.surface, 
                color: theme.text 
              }]}
              placeholder="Enter your email"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Your Weight (kg)</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.surface, 
                color: theme.text 
              }]}
              placeholder="Your weight"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={personWeight}
              onChangeText={setPersonWeight}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Password</Text>
            <View style={[styles.passwordContainer, { backgroundColor: theme.surface }]}>
              <TextInput
                style={[styles.passwordInput, { color: theme.text }]}
                placeholder="Create a password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={24} 
                  color={theme.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Confirm Password</Text>
            <View style={[styles.passwordContainer, { backgroundColor: theme.surface }]}>
              <TextInput
                style={[styles.passwordInput, { color: theme.text }]}
                placeholder="Confirm your password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons 
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                  size={24} 
                  color={theme.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </View>
            <TouchableOpacity 
            style={[
              styles.signupButton, 
              { 
                backgroundColor: theme.primary,
                opacity: 1
              }
            ]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.signupButtonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.loginContainer}>
            <Text style={[styles.loginText, { color: theme.textSecondary }]}>Have an account already? </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.loginLink, { color: theme.primary }]}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
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
    marginBottom: 20,
    width: '100%',
  },
  label: {
    marginBottom: 8,
    fontSize: 16,
  },
  input: {
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 12,
  },
  signupButton: {
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  signupButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    marginTop: 24,
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 16,
  },
  loginLink: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  verificationText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  emailText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  resendButton: {
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButton: {
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});