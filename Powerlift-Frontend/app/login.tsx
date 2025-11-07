import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useRouter, Link, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '../hooks/useAuth';
import useErrorToast from '../hooks/useErrorToast';
import PowerLiftAPI from '../services/api';
import { FONTS, SIZES, Typography } from '../constants/Typography';
import useCustomTheme from '../hooks/useCustomTheme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading } = useAuth();
  const { showError, showSuccess } = useErrorToast();
  const params = useLocalSearchParams();
  const { theme } = useCustomTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationNeeded, setVerificationNeeded] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const { width } = Dimensions.get('window');

  // Set email from params if available
  useEffect(() => {
    if (params.email) {
      setEmail(params.email as string);
    }
  }, [params.email]);

  const handleLogin = async () => {
    // Basic validation
    if (!email) {
      showError('Please enter your email address');
      return;
    }
    
    if (!password) {
      showError('Please enter your password');
      return;
    }

    try {
      // Use the signIn function from useAuth
      await signIn(email, password);
      // No need to navigate manually, the useAuth hook will handle it
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Check if this is an email verification error
      if (error && error.verification_required) {
        setVerificationNeeded(true);
        setUnverifiedEmail(error.email || email);
      } else {
        showError('Invalid email or password. Please try again.');
      }
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    
    setResendLoading(true);
    
    try {
      await PowerLiftAPI.resendVerification(unverifiedEmail);
      showSuccess('Verification email has been resent');
    } catch (error) {
      console.error('Resend verification error:', error);
      showError('Failed to resend verification email');
    } finally {
      setResendLoading(false);
    }
  };

  // Show verification needed screen
  if (verificationNeeded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          <View style={[styles.verificationIconContainer, { 
            backgroundColor: theme.surfaceVariant,
            borderColor: theme.secondary
          }]}>
            <Ionicons name="mail" size={64} color={theme.secondary} />
          </View>
          
          <Text style={[styles.verificationTitle, { color: theme.text }]}>Email Verification Required</Text>
          
          <Text style={[styles.verificationText, { color: theme.textSecondary }]}>
            Your account needs to be verified. We've sent a verification link to:
          </Text>
          <Text style={[styles.emailText, { color: theme.secondary }]}>{unverifiedEmail}</Text>
          
          <Text style={[styles.verificationText, { color: theme.textSecondary }]}>
            Please check your inbox and click the link to verify your account.
          </Text>
          
          <TouchableOpacity 
            style={[styles.resendButton, { backgroundColor: theme.surfaceVariant }]}
            onPress={handleResendVerification}
            disabled={resendLoading}
          >
            {resendLoading ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <Text style={[styles.resendButtonText, { color: theme.text }]}>Resend Verification Email</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.backToLoginButton, { 
              backgroundColor: theme.primary,
              shadowColor: theme.primary
            }]}
            onPress={() => setVerificationNeeded(false)}
          >
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        
        <View style={styles.content}>
          <View style={[styles.logoContainer, { 
            backgroundColor: theme.surfaceVariant,
            borderColor: theme.primary
          }]}>
            <Ionicons name="barbell-outline" size={48} color={theme.primary} />
          </View>
          
          <Text style={[styles.title, { color: theme.text }]}>Sign In</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Welcome back to PowerLift</Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Email</Text>
            <View style={[styles.inputWrapper, { 
              backgroundColor: theme.surface,
              borderColor: theme.border
            }]}>
              <Ionicons name="mail-outline" size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your email"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Password</Text>
            <View style={[styles.inputWrapper, { 
              backgroundColor: theme.surface,
              borderColor: theme.border
            }]}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.passwordInput, { color: theme.text }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.textSecondary}
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
                  size={22} 
                  color={theme.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.loginButton, { 
              backgroundColor: theme.primary,
              shadowColor: theme.primary
            }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.signupContainer}>
            <Text style={[styles.signupText, { color: theme.textMuted }]}>Don't have an account? </Text>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <Text style={[styles.signupLink, { color: theme.secondary }]}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
  },
  title: {
    ...Typography.h2,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body1,
    fontFamily: FONTS.regular,
    marginBottom: 40,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    ...Typography.body2,
    fontFamily: FONTS.medium,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    padding: 16,
    fontFamily: FONTS.regular,
    fontSize: SIZES.body1,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontFamily: FONTS.regular,
    fontSize: SIZES.body1,
  },
  eyeIcon: {
    padding: 16,
  },
  loginButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonText: {
    ...Typography.button,
    color: '#000000',
    letterSpacing: 1,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    ...Typography.body1,
  },
  signupLink: {
    ...Typography.body1,
    fontFamily: FONTS.bold,
  },
  verificationIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
  },
  verificationTitle: {
    ...Typography.h3,
    marginBottom: 24,
    textAlign: 'center',
  },
  verificationText: {
    ...Typography.body1,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  emailText: {
    ...Typography.h5,
    fontFamily: FONTS.bold,
    marginBottom: 16,
  },
  resendButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  resendButtonText: {
    ...Typography.button,
    fontFamily: FONTS.medium,
  },
  backToLoginButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  backToLoginText: {
    ...Typography.button,
    color: '#000000',
    letterSpacing: 1,
  },
}); 