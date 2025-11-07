import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PowerLiftAPI } from '../services/api';
import { useRouter, useSegments } from 'expo-router';
import useErrorToast from './useErrorToast';

// Define user type
interface User {
  user_id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  person_weight?: number;
  barbell_weight?: number;
  deadlift_weight?: number;
  squat_weight?: number;
  bench_weight?: number;
  is_verified?: boolean;
}

// Define auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string, first_name: string, last_name: string) => Promise<User>;
  signOut: () => Promise<void>;
  updateProfile: (userData: { 
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
  }) => Promise<void>;
}

// Create auth context
const AuthContext = createContext<AuthContextType | null>(null);

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Create a wrapper for useErrorToast that doesn't throw when used outside provider
function useErrorToastSafe() {
  try {
    return useErrorToast();
  } catch (e) {
    // Return a no-op implementation if used outside provider
    return {
      showError: () => {},
      showWarning: () => {},
      showSuccess: () => {},
      hideToast: () => {}
    };
  }
}

// Auth provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();
  const { showError, showSuccess } = useErrorToastSafe();

  // Load user data from storage
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('user_data');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          setUser(userData);
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Handle routing based on auth state
  useEffect(() => {
    if (isLoading) return;

    // Get the current path
    const currentPath = segments.join('/');
    
    // Define auth paths
    const authPaths = ['', 'login', 'signup'];
    
    // Check if current path is an auth path
    const isAuthPath = authPaths.some(path => currentPath === path || currentPath.endsWith(`/${path}`));

    // Debug logging
    console.log('Auth state:', { 
      user: user?.username || 'null', 
      currentPath, 
      isAuthPath,
      segments
    });

    // Only redirect if we're not in a loading state
    if (!user && !isAuthPath && currentPath !== 'login' && !isLoading) {
      console.log('Redirecting to login (not authenticated)');
      router.replace('/login');
    } else if (user && isAuthPath && !isLoading) {
      console.log('Redirecting to tabs (authenticated)');
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading, router]);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log('Signing in with:', email);
      const response = await PowerLiftAPI.login(email, password);
      
      console.log('Sign in successful, storing data and redirecting');
      await AsyncStorage.setItem('auth_token', response.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(response.user));
      
      setUser(response.user);
      
      // Show success message
      showSuccess('Signed in successfully');
      
      // Explicitly navigate to tabs after successful login
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      // Check if this is an email verification error
      if (error.response && error.response.status === 403 && 
          error.response.data && error.response.data.verification_required) {
        // Return the error response for handling in the login component
        throw error.response.data;
      }
      
      showError('Invalid email or password');
      throw error; // Re-throw to let the calling component handle it
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up function
  const signUp = async (
    username: string, 
    email: string, 
    password: string, 
    first_name: string, 
    last_name: string,
    person_weight?: number,
    deadlift_weight?: number,
    squat_weight?: number,
    bench_weight?: number
  ) => {
    try {
      setIsLoading(true);
      const response = await PowerLiftAPI.register(
        username, 
        email, 
        password, 
        first_name, 
        last_name,
        person_weight,
        undefined, // barbell_weight - deprecated, keeping for backward compatibility
        deadlift_weight,
        squat_weight,
        bench_weight
      );
      
      // Show success message
      showSuccess('Account created successfully');
      
      // We don't automatically sign in after registration
      // Just return the user data
      return response.user;
    } catch (error) {
      console.error('Sign up error:', error);
      showError('Registration failed. This email or username may already be in use.');
      throw error; // Re-throw to let the calling component handle it
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      setIsLoading(true);
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user_data');
      setUser(null);
      
      // Show success message
      showSuccess('Signed out successfully');
      
      // Explicitly navigate to login after logout
      router.replace('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      showError('Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  // Update profile function
  const updateProfile = async (userData: { 
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
  }) => {
    try {
      setIsLoading(true);
      const response = await PowerLiftAPI.updateProfile(userData);
      
      await AsyncStorage.setItem('auth_token', response.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(response.user));
      
      setUser(response.user);
      
      // Show success message
      showSuccess('Profile updated successfully');
    } catch (error: any) {
      console.error('Update profile error:', error);
      
      // Check for specific error messages
      if (error.response && error.response.data && error.response.data.error) {
        showError(error.response.data.error);
      } else {
        showError('Failed to update profile');
      }
      
      throw error; // Re-throw to let the calling component handle it
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for using auth context
export default function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 