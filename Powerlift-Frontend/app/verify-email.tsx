import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import PowerLiftAPI from '../services/api';
import useCustomTheme from '../hooks/useCustomTheme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useCustomTheme();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  // Get verification token from URL
  const token = params.token as string;

  useEffect(() => {
    // If no token is provided, redirect to login
    if (!token) {
      router.replace('/login');
      return;
    }

    const verifyEmail = async () => {
      try {
        setLoading(true);
        
        // Get API base URL
        const baseURL = await PowerLiftAPI.getBaseUrl();
        const verificationUrl = `${baseURL}/auth/verify-email/${token}`;
        
        // Make direct request to verify email
        const response = await axios.get(verificationUrl);
        
        if (response.data && response.data.email) {
          setEmail(response.data.email);
          setVerified(true);
        } else {
          setError('Invalid verification link');
        }
      } catch (error: any) {
        console.error('Verification error:', error);
        if (error.response && error.response.data && error.response.data.error) {
          setError(error.response.data.error);
        } else {
          setError('Failed to verify email. The link may be expired or invalid.');
        }
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token, router]);

  const handleGoToLogin = () => {
    router.replace({
      pathname: '/login',
      params: { email }
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>Verifying your email...</Text>
          </View>
        ) : verified ? (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={80} color={theme.success} />
            <Text style={[styles.title, { color: theme.text }]}>Email Verified!</Text>
            <Text style={[styles.message, { color: theme.text }]}>
              Your email has been successfully verified. You can now log in to your account.
            </Text>
            <TouchableOpacity 
              style={[styles.loginButton, { backgroundColor: theme.primary }]}
              onPress={handleGoToLogin}
            >
              <Text style={styles.loginButtonText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <Ionicons name="close-circle" size={80} color={theme.error} />
            <Text style={[styles.title, { color: theme.text }]}>Verification Failed</Text>
            <Text style={[styles.errorMessage, { color: theme.error }]}>{error}</Text>
            <TouchableOpacity 
              style={[styles.loginButton, { backgroundColor: theme.primary }]}
              onPress={() => router.replace('/login')}
            >
              <Text style={styles.loginButtonText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  successContainer: {
    alignItems: 'center',
  },
  errorContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  loginButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 