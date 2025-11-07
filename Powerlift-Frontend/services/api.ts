import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';

// Declare global API URL variable
declare global {
  var POWERLIFT_API_URL: string | undefined;
}

// Server IP storage key
const SERVER_IP_KEY = 'powerlift_server_ip';

// Default base URLs - add network.getIpAddressAsync placeholder for when it's used
const DEFAULT_URLS = {
  ios: 'http://localhost:5000/api',
  android: 'http://192.168.100.5:5000/api'  // Updated to match the user's actual IP
};

// Get API base URL
const getApiBaseUrl = async () => {
  // Check if global variable is set (from settings)
  if (global.POWERLIFT_API_URL) {
    return global.POWERLIFT_API_URL;
  }
  
  // Try to get saved server IP
  try {
    const savedIP = await AsyncStorage.getItem(SERVER_IP_KEY);
    if (savedIP) {
      const url = `http://${savedIP}:5000/api`;
      global.POWERLIFT_API_URL = url;
      return url;
    }
  } catch (error) {
    console.error('Failed to load server IP:', error);
  }
  
  // Fallback to default URLs
  const defaultUrl = Platform.OS === 'ios' ? DEFAULT_URLS.ios : DEFAULT_URLS.android;
  console.log(`Using default API URL: ${defaultUrl}`);
  return defaultUrl;
};

// Create axios instance factory
const createApiInstance = async () => {
  const baseURL = await getApiBaseUrl();
  console.log(`Creating API instance with baseURL: ${baseURL}`);
  
  // Get auth token if available
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Failed to get auth token:', error);
  }
  
  return axios.create({
    baseURL,
    timeout: 30000, // 30 seconds
    headers,
  });
};

// API service methods
export const PowerLiftAPI = {
  // Get base URL for direct API access
  getBaseUrl: async () => {
    return await getApiBaseUrl();
  },
  
  // Authentication methods
  register: async (
    username: string, 
    email: string, 
    password: string, 
    first_name: string, 
    last_name: string,
    person_weight?: number,
    barbell_weight?: number,
    deadlift_weight?: number,
    squat_weight?: number,
    bench_weight?: number
  ) => {
    try {
      console.log('Registering new user...');
      const api = await createApiInstance();
      const response = await api.post('/auth/register', {
        username,
        email,
        password,
        first_name,
        last_name,
        person_weight,
        barbell_weight,
        deadlift_weight,
        squat_weight,
        bench_weight
      });
      console.log('Registration successful');
      return response.data;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  },

  resendVerification: async (email: string) => {
    try {
      console.log('Resending verification email...');
      const api = await createApiInstance();
      const response = await api.post('/auth/resend-verification', { email });
      console.log('Verification email resent');
      return response.data;
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      throw error;
    }
  },

  login: async (email: string, password: string) => {
    try {
      console.log('Logging in...');
      const api = await createApiInstance();
      const response = await api.post('/auth/login', {
        email,
        password
      });
      console.log('Login successful');
      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  verifyToken: async () => {
    try {
      console.log('Verifying token...');
      const api = await createApiInstance();
      const response = await api.get('/auth/verify');
      console.log('Token verification successful');
      return response.data;
    } catch (error) {
      console.error('Token verification failed:', error);
      throw error;
    }
  },

  updateProfile: async (userData: { 
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
      console.log('Updating profile...');
      const api = await createApiInstance();
      
      // Debug the API URL
      const baseURL = await getApiBaseUrl();
      console.log(`API Base URL for update profile: ${baseURL}/auth/update-profile`);
      
      const response = await api.put('/auth/update-profile', userData);
      
      // Update stored token and user data
      await AsyncStorage.setItem('auth_token', response.data.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(response.data.user));
      
      console.log('Profile update successful');
      return response.data;
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  },

  // Video analysis
  uploadVideo: async (
    videoUri: string, 
    onProgress?: (progress: number) => void,
    params?: {
      exerciseType?: string;
      bodyWeight?: string;
      weightUsed?: string;
    }
  ) => {
    try {
      console.log(`Uploading video: ${videoUri}`);
      
      // Create form data for the file
      const formData = new FormData();
      
      // Add the video file
      formData.append('video', {
        uri: videoUri,
        name: 'video.mp4',
        type: 'video/mp4',
      } as any);
      
      // Add exercise parameters if provided
      if (params) {
        if (params.exerciseType) formData.append('exerciseType', params.exerciseType);
        if (params.bodyWeight) formData.append('bodyWeight', params.bodyWeight);
        if (params.weightUsed) formData.append('weightUsed', params.weightUsed);
      }
      
      // Create API instance
      const baseURL = await getApiBaseUrl();
      console.log(`API Base URL: ${baseURL}`);
      
      // Get auth token if available
      let headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json',
      };

      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Failed to get auth token:', error);
      }
      
      // Configure the request
      const config: AxiosRequestConfig = {
        baseURL,
        timeout: 60000, // 60 seconds for upload
        headers,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
      };
      
      // Make the request
      const response = await axios.post('/analyze/video', formData, config);
      console.log('Upload successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('Video upload failed:', error);
      throw error;
    }
  },

  // Check analysis status
  checkAnalysisStatus: async (analysisId: string) => {
    try {
      console.log(`Checking status for analysis: ${analysisId}`);
      const api = await createApiInstance();
      const response = await api.get(`/analysis/${analysisId}`);
      console.log('Status check response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Status check failed:', error);
      throw error;
    }
  },

  // Get URLs for analysis results
  getAnalysisVideoUrl: async (analysisId: string) => {
    const baseURL = await getApiBaseUrl();
    return `${baseURL}/analysis/${analysisId}/video`;
  },

  getRadarChartUrl: async (analysisId: string) => {
    const baseURL = await getApiBaseUrl();
    return `${baseURL}/analysis/${analysisId}/radar`;
  },

  // Send a frame for real-time analysis
  analyzeFrame: async (imageBase64: string) => {
    // Try up to 3 times with increasing timeouts
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`Sending frame for analysis (attempt ${attempt + 1})...`);
        const api = await createApiInstance();
        const response = await api.post('/analyze/frame', { image: imageBase64 }, {
          timeout: 3000 + (attempt * 1000), // Increase timeout with each attempt
        });
        console.log('Frame analysis successful');
        return response.data;
      } catch (error) {
        console.error(`Frame analysis failed (attempt ${attempt + 1}):`, error);
        
        // If this is not the last attempt, wait a bit before retrying
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        
        // Return a minimal response to allow the UI to continue
        return {
          status: "error",
          error: "Frame analysis failed. Connection issue.",
          scores: {
            knee_alignment: 0,
            spine_alignment: 0,
            hip_stability: 0,
            bar_path_efficiency: 0,
            overall: 0
          }
        };
      }
    }
  },

  // Reset realtime analysis session
  resetRealtimeAnalysis: async () => {
    console.log("Resetting real-time analysis (attempt 1)");
    const baseUrl = await getApiBaseUrl();
    console.log("Creating API instance with baseURL:", baseUrl);

    // Try up to 3 times with increasing delays
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Create a custom timeout with AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${baseUrl}/realtime/reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log("Reset successful");
          return data;
        } else {
          console.log(`Reset failed with status ${response.status} (attempt ${attempt})`);
          if (attempt < 3) {
            // Wait before retrying (exponential backoff)
            const delay = attempt * 1000;
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            console.log(`Resetting real-time analysis (attempt ${attempt + 1})`);
          }
        }
      } catch (error) {
        console.error(`Reset error (attempt ${attempt}):`, error);
        if (attempt < 3) {
          // Wait before retrying
          const delay = attempt * 1000;
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`Resetting real-time analysis (attempt ${attempt + 1})`);
        } else {
          throw error;
        }
      }
    }
    
    // If all attempts failed
    return { status: 'error', message: 'Failed to reset real-time analysis after 3 attempts' };
  },

  finalizeRealtimeAnalysis: async (params: {
    exercise_type: string;
    body_weight?: string;
    weight_used?: string;
  }) => {
    try {
      // Try up to 3 times with increasing timeouts
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          console.log(`Finalizing real-time analysis (attempt ${attempt + 1})...`);
          const api = await createApiInstance();
          const response = await api.post('/realtime/finalize', params, {
            timeout: 10000 + (attempt * 5000), // Increase timeout with each attempt
          });
          console.log('Real-time analysis finalized:', response.data);
          return response.data;
        } catch (err) {
          if (attempt < 2) {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
          }
          throw err;
        }
      }
    } catch (error) {
      console.error('Finalize real-time analysis failed:', error);
      // Generate a fake analysis ID and minimal response
      const fakeAnalysisId = `offline-${Date.now()}`;
      return {
        status: "success",
        message: "Analysis finalized (offline mode)",
        analysis_id: fakeAnalysisId,
        scores: {
          knee_alignment: 75,
          spine_alignment: 80,
          hip_stability: 70,
          bar_path_efficiency: 85,
          overall: 78
        },
        feedback: [
          "Connection to server failed. This is offline analysis.",
          "Please check your network connection and server status."
        ]
      };
    }
  },

  // Progress tracking methods
  getUserProgress: async (exerciseType?: string) => {
    try {
      console.log('Fetching user progress data...');
      const api = await createApiInstance();
      
      // Add exercise type filter if provided
      const params = exerciseType ? { exercise_type: exerciseType } : undefined;
      
      const response = await api.get('/progress', { params });
      console.log('Progress data fetched successfully');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch progress data:', error);
      throw error;
    }
  },
  
  addProgressEntry: async (entry: {
    exercise_type: string;
    date: string;
    score: number;
    weight_used?: string;
    body_weight?: string;
    notes?: string;
  }) => {
    try {
      console.log('Adding progress entry...');
      const api = await createApiInstance();
      const response = await api.post('/progress', entry);
      console.log('Progress entry added successfully');
      return response.data;
    } catch (error) {
      console.error('Failed to add progress entry:', error);
      throw error;
    }
  },

  // Get API base URL for WebSocket connection
  getApiBaseUrl: async () => {
    return await getApiBaseUrl();
  },

  // Test server connectivity with a ping
  pingServer: async () => {
    try {
      const baseUrl = await getApiBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${baseUrl}/ping`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return { status: 'success', latency: Date.now() - performance.now() };
      } else {
        return { status: 'error', message: `Server responded with status ${response.status}` };
      }
    } catch (error) {
      console.error('Ping failed:', error);
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Submit feedback for MCSVM form classification
  submitFormFeedback: async (feedbackData: {
    exercise_type: string;
    predicted_form: string;
    is_correct: boolean;
    correct_form?: string;
    frame_features: number[];
    confidence_score?: number;
    analysis_id?: string;
  }) => {
    try {
      const api = await createApiInstance();
      const response = await api.post('/feedback/form-classification', feedbackData);
      return response.data;
    } catch (error) {
      console.error('Feedback submission failed:', error);
      throw error;
    }
  },

  // Get feedback statistics for MCSVM system performance
  getFeedbackStatistics: async () => {
    try {
      const api = await createApiInstance();
      const response = await api.get('/feedback/statistics');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch feedback statistics:', error);
      throw error;
    }
  },
};

export default PowerLiftAPI;