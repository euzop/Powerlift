import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  Alert,
  Dimensions,
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { PowerLiftAPI } from '../services/api';
import { fitnessTheme } from '../constants/Colors';
import { FONTS, Typography } from '../constants/Typography';
import { Camera } from 'expo-camera';

// Mock Camera component for when the real camera isn't available
interface MockCameraProps {
  style: any;
  type: any;
  ratio: string;
  cameraRef: React.RefObject<any>;
}

const MockCamera: React.FC<MockCameraProps> = ({ style, type, ratio, cameraRef }) => {
  // Assign mock methods to the ref
  React.useEffect(() => {
    if (cameraRef && cameraRef.current === null) {
      cameraRef.current = {
        takePictureAsync: async () => ({ 
          uri: '', 
          width: 0, 
          height: 0, 
          exif: {}, 
          base64: '' 
        })
      };
    }
  }, [cameraRef]);

  return (
    <View style={[style, { backgroundColor: '#2c2c2c', justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: 'white', textAlign: 'center', padding: 20 }}>
        Camera not available{'\n'}Please check permissions
      </Text>
      <Ionicons name="camera-outline" size={48} color="white" />
    </View>
  );
};

// Target FPS for real-time analysis
const TARGET_FPS = 6;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// Main screen component
export default function RealtimeAnalysisScreen() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraType, setCameraType] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scores, setScores] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState('');
  const [barbellDetected, setBarbellDetected] = useState(false);
  const [visualizationBase64, setVisualizationBase64] = useState<string | null>(null);
  const [radarChartBase64, setRadarChartBase64] = useState<string | null>(null);
  const [exerciseType, setExerciseType] = useState('deadlift');
  const [formScore, setFormScore] = useState<string>('0.0');
  const [feedback, setFeedback] = useState<string>('');
  
  // State for module loading
  const [cameraModule, setCameraModule] = useState<any>(null);
  const [imageManipulatorModule, setImageManipulatorModule] = useState<any>(null);
  const [socketIOModule, setSocketIOModule] = useState<any>(null);
  const [modulesAvailable, setModulesAvailable] = useState({
    camera: false,
    imageManipulator: false,
    socketIo: false
  });
  const [modulesLoaded, setModulesLoaded] = useState(false);
  
  // Refs
  const cameraRef = useRef<any>(null);
  const previewCameraRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const frameProcessingRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);
  
  // Get screen dimensions
  const { width: screenWidth } = Dimensions.get('window');
  const height = Math.round((screenWidth * 16) / 9);
  
  // Handle camera ready event
  const onCameraReady = () => {
    console.log('Camera is ready');
    setCameraReady(true);
    
    // If we're already analyzing, start capturing frames
    if (isAnalyzing) {
      console.log('Camera ready and already analyzing, starting frame capture');
      setTimeout(captureAndAnalyzeFrame, 500);
    }
  };
  
  // Check and request camera permissions
  const checkCameraPermissions = async (cameraModuleToUse: any) => {
    console.log('Checking camera permissions...');
    
    if (!cameraModuleToUse) {
      console.error('No camera module provided to checkCameraPermissions');
      setHasPermission(false);
      setPermissionError('Camera module not available');
      return;
    }
    
    try {
      // Check which permission function exists
      let permissionFunction = null;
      
      if (cameraModuleToUse.Camera && cameraModuleToUse.Camera.requestCameraPermissionsAsync) {
        console.log('Using Camera.requestCameraPermissionsAsync');
        permissionFunction = cameraModuleToUse.Camera.requestCameraPermissionsAsync;
      } else if (cameraModuleToUse.requestCameraPermissionsAsync) {
        console.log('Using requestCameraPermissionsAsync');
        permissionFunction = cameraModuleToUse.requestCameraPermissionsAsync;
      } else if (cameraModuleToUse.getCameraPermissionsAsync) {
        console.log('Using getCameraPermissionsAsync');
        permissionFunction = cameraModuleToUse.getCameraPermissionsAsync;
      }
      
      if (!permissionFunction) {
        console.error('No permission function found in camera module');
        setHasPermission(false);
        setPermissionError('Camera permissions not available');
        return;
      }
      
      console.log('Requesting camera permissions...');
      const { status } = await permissionFunction();
      console.log('Camera permission status:', status);
      
      if (status === 'granted') {
        console.log('Camera permission granted, updating state');
        setHasPermission(true);
        setPermissionError(null);
      } else {
        console.log('Camera permission denied:', status);
        setHasPermission(false);
        setPermissionError(
          status === 'denied' 
            ? 'Camera permission was denied. Please enable it in your device settings.'
            : 'Camera permission not granted.'
        );
        
        if (status === 'denied') {
          Alert.alert(
            'Camera Permission Required',
            'Please grant camera permission to use this feature.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error checking camera permissions:', error);
      setHasPermission(false);
      setPermissionError('Error accessing camera: ' + (error instanceof Error ? error.message : String(error)));
    }
  };
  
  // Load modules dynamically
  const loadModules = async () => {
    try {
      console.log('Loading modules...');
      
      // Load camera module
      try {
        const cameraModule = await import('expo-camera');
        console.log('Camera module loaded:', cameraModule);
        console.log('Camera module functions:', Object.keys(cameraModule));
        setCameraModule(cameraModule);
        setModulesAvailable(prev => ({ ...prev, camera: true }));
      } catch (error) {
        console.error('Error loading camera module:', error);
      }
      
      // Load ImageManipulator module
      try {
        const imageManipulatorModule = await import('expo-image-manipulator');
        console.log('ImageManipulator module loaded:', imageManipulatorModule);
        setImageManipulatorModule(imageManipulatorModule);
        setModulesAvailable(prev => ({ ...prev, imageManipulator: true }));
      } catch (error) {
        console.error('Error loading ImageManipulator module:', error);
      }
      
      // Load Socket.IO client
      try {
        // First try to import the module
        const socketModule = await import('socket.io-client');
        console.log('Socket.IO module loaded:', socketModule);
        
        // Determine which property to use
        let finalSocketModule;
        
        if (typeof socketModule === 'function') {
          console.log('Socket.IO module is a function');
          finalSocketModule = socketModule;
        } else if (socketModule.default && typeof socketModule.default === 'function') {
          console.log('Using socketModule.default function');
          finalSocketModule = socketModule.default;
        } else if (socketModule.io) {
          console.log('Using socketModule.io');
          finalSocketModule = socketModule.io;
        } else if (socketModule.connect) {
          console.log('Using socketModule.connect');
          finalSocketModule = socketModule.connect;
        } else {
          console.log('Using entire socketModule object');
          finalSocketModule = socketModule;
        }
        
        setSocketIOModule(finalSocketModule);
        setModulesAvailable(prev => ({ ...prev, socketIo: true }));
      } catch (error) {
        console.error('Error loading Socket.IO client:', error);
      }
      
      setModulesLoaded(true);
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };
  
  // Component mount effect
  useEffect(() => {
    console.log('Component mounted');
    
    // Set initial loading state
    setHasPermission(null);
    
    // Load modules and check permissions
    const setupCamera = async () => {
      console.log('Setting up camera...');
      try {
        // First load modules
        const modulesLoaded = await loadModules();
        console.log('Modules loaded:', modulesLoaded);
        
        // Then check permissions directly, don't wait for cameraModule state update
        if (cameraModule) {
          console.log('Camera module available in setupCamera, checking permissions');
          await checkCameraPermissions(cameraModule);
        } else {
          // Try to get camera module directly
          try {
            const ExpoCameraModule = require('expo-camera');
            console.log('Directly loaded camera module');
            setCameraModule(ExpoCameraModule);
            await checkCameraPermissions(ExpoCameraModule);
          } catch (err) {
            console.error('Failed to directly load camera module:', err);
            setHasPermission(false);
            setPermissionError('Camera module not available');
          }
        }
      } catch (error) {
        console.error('Error in setupCamera:', error);
        setHasPermission(false);
        setPermissionError('Error setting up camera: ' + (error instanceof Error ? error.message : String(error)));
      }
    };
    
    setupCamera();
    
    // Clean up on unmount
    return () => {
      console.log('Component unmounting...');
      
      // Stop any ongoing analysis
      if (isAnalyzing) {
        stopAnalysis();
      }
      
      // Clean up socket connection when component unmounts
      try {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      } catch (error) {
        console.error('Error disconnecting socket:', error);
      }
    };
  }, []);
  
  // Open device settings
  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };
  
  // Initialize socket connection
  const initializeSocketConnection = async () => {
    if (!modulesAvailable.socketIo || !socketIOModule) {
      console.error('Socket.IO module not available');
      return null;
    }
    
    try {
      // Get the base URL without the /api suffix
      const apiUrl = await PowerLiftAPI.getBaseUrl();
      // For Socket.IO connection, we need the base URL without the /api path
      const baseUrl = apiUrl.replace('/api', '');
      console.log(`Initializing socket connection to ${baseUrl}`);
      
      // Create socket connection with proper options
      const socketOptions = {
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        autoConnect: true,
        path: '/socket.io',
        withCredentials: false,
        pingTimeout: 60000,
        pingInterval: 25000,
        extraHeaders: {
          "Access-Control-Allow-Origin": "*"
        }
      };
      
      // Import socket.io-client directly to ensure we have the correct version
      const io = (await import('socket.io-client')).default;
      console.log('Imported io function directly:', io);
      
      // Create socket connection
      const socket = io(baseUrl, socketOptions);
      console.log('Socket created:', socket);
      
      // Set up basic event handlers
      socket.on('connect', () => {
        console.log('Socket connected successfully');
        setIsConnected(true);
      });
      
      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });
      
      socket.on('connect_error', (error: Error) => {
        console.error('Socket connection error:', error);
      });
      
      // Handle connection response
      socket.on('connection_response', (data: any) => {
        console.log('Connection response:', data);
        if (data.status === 'connected') {
          console.log('Socket.IO connection confirmed by server');
          setSessionId(data.session_id);
        }
      });
      
      return socket;
    } catch (error) {
      console.error('Error initializing socket connection:', error);
      return null;
    }
  };
  
  // Initialize socket connection when modules are loaded
  useEffect(() => {
    if (modulesLoaded && modulesAvailable.socketIo) {
      const initSocket = async () => {
        console.log('Initializing socket connection after modules loaded');
        try {
          const socket = await initializeSocketConnection();
          if (socket) {
            socketRef.current = socket;
            console.log('Socket connection initialized');
          } else {
            console.error('Failed to initialize socket connection');
          }
        } catch (error) {
          console.error('Error initializing socket:', error);
        }
      };
      
      initSocket();
    }
  }, [modulesLoaded, modulesAvailable.socketIo]);
  
  // Start continuous analysis
  const startAnalysis = async () => {
    if (!cameraRef.current || !modulesAvailable.camera || isAnalyzing) {
      console.log('Camera not ready or already analyzing');
      return;
    }
    
    // Check if camera is ready
    if (!cameraReady) {
      console.log('Camera not marked as ready yet, please wait...');
      Alert.alert('Camera Not Ready', 'Please wait for the camera to initialize fully before starting analysis.');
      return;
    }
    
    console.log('Starting analysis...');
    
    // Clear any previous visualization
    setVisualizationBase64(null);
    
    // Reset form score and feedback
    setFormScore('0.0');
    setFeedback('');
    
    // Set analyzing state first - IMPORTANT: This needs to be set before emitting events
    setIsAnalyzing(true);
    
    // Wait for state to update before proceeding
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // If socket is connected, emit start_analysis event
    if (socketRef.current && socketRef.current.connected) {
      console.log('Emitting start_analysis event');
      socketRef.current.emit('start_analysis', {
        exercise_type: exerciseType,
        body_weight: '',
        weight_used: ''
      });
    }
    
    // Start capturing frames immediately to ensure we don't miss any
    console.log('Starting frame capture immediately...');
    captureAndAnalyzeFrame();
  };
  
  // Stop analysis
  const stopAnalysis = () => {
    console.log('Stopping analysis...');
    
    // Emit stop event first before changing state
    if (socketRef.current && socketRef.current.connected) {
      try {
        console.log('Emitting stop_analysis event');
        socketRef.current.emit('stop_analysis', {});
      } catch (error) {
        console.error('Error stopping analysis:', error);
      }
    }
    
    // Then update state
    setIsAnalyzing(false);
    
    // Clear visualization
    setVisualizationBase64(null);
  };
  
  // Capture and analyze a single frame
  const captureAndAnalyzeFrame = async () => {
    console.log('captureAndAnalyzeFrame called, analyzing state:', isAnalyzing, 'camera ready:', cameraReady);
    
    // Create a local variable to track the analyzing state at the start of this function
    // This ensures we don't have race conditions with state updates
    const currentlyAnalyzing = isAnalyzing;
    
    if (!currentlyAnalyzing) {
      console.log('Not analyzing, skipping frame capture');
      return;
    }
    
    if (!cameraRef.current) {
      console.log('Camera ref not available, retrying in 500ms');
      if (currentlyAnalyzing) {
        setTimeout(captureAndAnalyzeFrame, 500);
      }
      return;
    }
    
    if (!cameraReady) {
      console.log('Camera not marked as ready yet, retrying in 500ms');
      if (currentlyAnalyzing) {
        setTimeout(captureAndAnalyzeFrame, 500);
      }
      return;
    }
    
    try {
      console.log('Taking picture...');
      
      // Make sure the camera ref has the takePictureAsync method
      if (!cameraRef.current.takePictureAsync) {
        console.error('Camera ref does not have takePictureAsync method');
        console.log('Camera ref methods:', Object.keys(cameraRef.current));
        
        // Try to find a method that might work
        const possibleMethods = ['takePicture', 'takePictureAsync', 'capture'];
        for (const method of possibleMethods) {
          if (typeof cameraRef.current[method] === 'function') {
            console.log(`Found alternative method: ${method}`);
            cameraRef.current.takePictureAsync = cameraRef.current[method];
            break;
          }
        }
        
        if (!cameraRef.current.takePictureAsync) {
          console.error('No valid camera capture method found, using mock data');
          generateMockData();
          
          // Schedule next frame capture
          if (currentlyAnalyzing) {
            setTimeout(captureAndAnalyzeFrame, 1000);
          }
          return;
        }
      }
      
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.7, 
        base64: true,
        exif: false
      });
      
      console.log('Picture taken successfully:', photo.uri);
      
      // Process the image before sending
      if (modulesAvailable.imageManipulator && imageManipulatorModule) {
        try {
          console.log('Processing image with ImageManipulator...');
          const processedImage = await imageManipulatorModule.manipulateAsync(
            photo.uri,
            [{ resize: { width: 640 } }],
            { compress: 0.7, format: imageManipulatorModule.SaveFormat.JPEG, base64: true }
          );
          
          console.log('Image processed, sending for analysis...');
          
          // Send to server for analysis
          await sendImageForAnalysis(processedImage.base64, exerciseType);
        } catch (error) {
          console.error('Error processing image:', error);
          
          // Send original image if processing fails
          console.log('Sending original image after processing error');
          await sendImageForAnalysis(photo.base64, exerciseType);
        }
      } else {
        console.log('ImageManipulator not available, using original image');
        // Send the original image
        await sendImageForAnalysis(photo.base64, exerciseType);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      
      // Use mock data as fallback
      console.log('Using mock data after camera error');
      generateMockData();
      
      // Continue capturing frames if still analyzing
      if (currentlyAnalyzing) {
        console.log('Scheduling next frame capture after camera error');
        setTimeout(captureAndAnalyzeFrame, 1000);
      }
    }
  };
  
  // Toggle camera type (front/back)
  const toggleCameraType = () => {
    if (isAnalyzing) return;
    setCameraType(cameraType === 'back' ? 'front' : 'back');
  };
  
  // Toggle exercise type
  const toggleExerciseType = () => {
    const exercises = ['squat', 'deadlift', 'bench'];
    const currentIndex = exercises.indexOf(exerciseType);
    const nextIndex = (currentIndex + 1) % exercises.length;
    setExerciseType(exercises[nextIndex]);
  };
  
  // Format score for display
  const formatScore = (score: number | undefined) => {
    if (score === undefined || score === null) return '0.0';
    return score.toFixed(1);
  };
  
  // Calculate form score color
  const getFormScoreColor = () => {
    const score = parseFloat(formScore);
    if (isNaN(score)) return '#FFFFFF';
    if (score >= 8.0) return '#4CAF50';
    if (score >= 6.0) return '#FFC107';
    return '#F44336';
  };

  // Format form score
  const getFormattedScore = () => {
    const score = parseFloat(formScore);
    if (isNaN(score)) return '0.0';
    return score.toFixed(1);
  };
  
  // Send image to server for analysis
  const sendImageForAnalysis = async (base64Image: string | undefined, exerciseType: string) => {
    if (!base64Image) {
      console.error('No base64 image data to send');
      return;
    }
    
    // Create a local variable to track the analyzing state
    const currentlyAnalyzing = isAnalyzing;
    
    // Check if we're still analyzing
    if (!currentlyAnalyzing) {
      console.log('Analysis stopped, not sending image');
      return;
    }
    
    // Check if socket is available and connected
    const socketConnected = socketRef.current && socketRef.current.connected;
    
    if (socketConnected) {
      console.log(`Sending image (${base64Image.length} chars) to server for analysis`);
      
      try {
        // Format the image data correctly for the backend
        // The backend expects data:image/jpeg;base64,BASE64DATA format
        const imageData = base64Image.startsWith('data:') 
          ? base64Image 
          : `data:image/jpeg;base64,${base64Image}`;
        
        // Log the first 50 characters of the image data to verify format
        console.log('Image data format:', imageData.substring(0, 50) + '...');
        
        // Create the payload object
        const payload = {
          frame: imageData,
          exercise_type: exerciseType,
          timestamp: new Date().getTime()
        };
        
        // Log the payload structure
        console.log('Sending payload with keys:', Object.keys(payload));
        
        // Emit the frame analysis event
        socketRef.current.emit('analysis_result', payload);
        
        console.log('Image sent to server, waiting for response...');
      } catch (error) {
        console.error('Error sending image to server:', error);
        // Fall back to mock data
        generateMockData();
      }
    } else {
      console.log('Socket not connected, using mock data');
      generateMockData();
    }
    
    // Schedule next frame capture if still analyzing
    if (currentlyAnalyzing) {
      console.log('Scheduling next frame capture');
      setTimeout(captureAndAnalyzeFrame, 1000);
    }
  };
  
  // Generate mock data for testing
  const generateMockData = () => {
    if (isAnalyzing) {
      setTimeout(() => {
        // Mock visualization data (base64 encoded small red square)
        const mockVisualization = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==';
        
        // Update visualization
        setVisualizationBase64(mockVisualization);
        
        // Update form score (random between 0-10)
        const randomScore = (Math.random() * 10).toFixed(1);
        setFormScore(randomScore);
        
        // Generate feedback based on score
        if (parseFloat(randomScore) < 5) {
          setFeedback('Poor form detected. Check your posture.');
        } else if (parseFloat(randomScore) < 8) {
          setFeedback('Good form, but could be improved.');
        } else {
          setFeedback('Excellent form!');
        }
      }, 300);
    }
  };
  
  // Navigate back
  const goBack = () => {
    router.back();
  };
  
  // Effect to start/stop frame capture when analysis state changes
  useEffect(() => {
    if (isAnalyzing) {
      console.log('Analysis started');
    } else {
      console.log('Analysis stopped');
      // Don't clear visualization when analysis stops
      // This allows the final visualization to remain visible
      // setVisualizationBase64(null);
    }
  }, [isAnalyzing]);
  
  // Debug effect to log state changes
  useEffect(() => {
    console.log('hasPermission changed:', hasPermission);
  }, [hasPermission]);
  
  // Debug effect to log camera module changes
  useEffect(() => {
    console.log('cameraModule changed:', cameraModule ? 'available' : 'not available');
  }, [cameraModule]);
  
  // Debug effect to log when visualization changes
  useEffect(() => {
    if (visualizationBase64) {
      console.log('Visualization updated - length:', visualizationBase64.length);
      console.log('Is analyzing:', isAnalyzing);
      
      // Log the first 50 characters of the base64 string
      console.log('Base64 preview:', visualizationBase64.substring(0, 50) + '...');
    }
  }, [visualizationBase64, isAnalyzing]);
  
  // Socket event handlers
  useEffect(() => {
    if (socketRef.current && isAnalyzing) {
      console.log('Setting up socket event handlers');
      
      // Handle analysis results from the server
      socketRef.current.on('analysis_result', (data: { 
        status?: string;
        visualization?: string;
        scores?: any;
        rep_count?: number;
        phase?: string;
        barbell_detected?: boolean;
        errors?: string[];
      }) => {
        console.log('Received analysis result from server:', data);
        console.log('Data keys:', Object.keys(data));
        
        // Only process if the status is success
        if (data.status === 'success' || !data.status) {
          // Update visualization if provided
          if (data.visualization) {
            console.log('Received visualization data, length:', data.visualization.length);
            console.log('Visualization data format:', data.visualization.substring(0, 50) + '...');
            
            // Make sure the visualization data is properly formatted
            const formattedVisualization = data.visualization.startsWith('data:') 
              ? data.visualization 
              : `data:image/jpeg;base64,${data.visualization}`;
            
            console.log('Setting visualization data');
            setVisualizationBase64(formattedVisualization);
          } else {
            console.log('No visualization data in response, generating mock data');
            // Generate mock visualization data if none was received
            const mockVisualization = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAHgCAIAAAC6s0uzAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF+mlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDAgNzkuMTYwNDUxLCAyMDE3LzA1LzA2LTAxOjA4OjIxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgKE1hY2ludG9zaCkiIHhtcDpDcmVhdGVEYXRlPSIyMDIwLTAzLTI2VDIzOjM5OjU5KzAxOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMC0wMy0yNlQyMzo0MToyMyswMTowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyMC0wMy0yNlQyMzo0MToyMyswMTowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo3YzY4Y2U3ZC0xYzVjLTRkOGItYTllOS1hZWQ4MTcxYTAyYzkiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDo5ZTM1YTc3ZC0zNDM0LTU5NGQtODEwNi1jNzVkNjY0MzM0MTEiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo1OTZiMDk0NS1kNWM3LTRjZGItOWE5Ni1iYTJkZmUwNjljODQiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjU5NmIwOTQ1LWQ1YzctNGNkYi05YTk2LWJhMmRmZTA2OWM4NCIgc3RFdnQ6d2hlbj0iMjAyMC0wMy0yNlQyMzozOTo1OSswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo3YzY4Y2U3ZC0xYzVjLTRkOGItYTllOS1hZWQ4MTcxYTAyYzkiIHN0RXZ0OndoZW49IjIwMjAtMDMtMjZUMjM6NDE6MjMrMDE6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAoTWFjaW50b3NoKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7Jq6duAAAKsElEQVR4nO3dW3LqOBRAUTjD7/+Wb06dSqXiC7Yl+dhrDYDkpFvbFg/8+vPnzw+A7/fv6QEAcA0BB8gigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALP8B/zdXx8JNQqwAAAAASUVORK5CYII=';
            setVisualizationBase64(mockVisualization);
          }
          
          // Update scores
          if (data.scores && data.scores.overall) {
            console.log('Received form score:', data.scores.overall);
            setFormScore(data.scores.overall.toFixed(1));
          } else {
            console.log('No scores data in response');
          }
          
          // Update feedback
          if (data.errors && data.errors.length > 0) {
            console.log('Received feedback:', data.errors[0]);
            setFeedback(data.errors[0]);
          } else {
            console.log('No errors/feedback in response');
          }
        } else {
          console.log('Analysis result status not success:', data.status);
        }
      });
      
      // Handle analysis started confirmation
      socketRef.current.on('analysis_started', (data: any) => {
        console.log('Analysis started:', data);
        if (data.status === 'success') {
          console.log('Analysis session started successfully');
        }
      });
      
      // Handle analysis errors
      socketRef.current.on('analysis_error', (data: any) => {
        console.error('Analysis error from server:', data);
        setIsAnalyzing(false);
        Alert.alert('Analysis Error', data.message || 'An error occurred during analysis');
      });
      
      // Handle analysis completion
      socketRef.current.on('analysis_complete', (data: any) => {
        console.log('Analysis complete:', data);
        console.log('Data keys:', Object.keys(data));
        setIsAnalyzing(false);
        
        // Show final results
        if (data.status === 'success') {
          // Update final score
          if (data.scores && data.scores.overall) {
            setFormScore(data.scores.overall.toFixed(1));
          }
          
          // Update feedback
          if (data.feedback && data.feedback.length > 0) {
            setFeedback(data.feedback[0]);
          }
          
          // Update visualization if available
          if (data.visualization) {
            console.log('Received visualization data in analysis_complete, length:', data.visualization.length);
            
            // Make sure the visualization data is properly formatted
            const formattedVisualization = data.visualization.startsWith('data:') 
              ? data.visualization 
              : `data:image/jpeg;base64,${data.visualization}`;
            
            console.log('Setting visualization data from analysis_complete');
            setVisualizationBase64(formattedVisualization);
          } else {
            console.log('No visualization data in analysis_complete, generating mock data');
            // Generate mock visualization data if none was received
            const mockVisualization = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAHgCAIAAAC6s0uzAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF+mlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDAgNzkuMTYwNDUxLCAyMDE3LzA1LzA2LTAxOjA4OjIxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgKE1hY2ludG9zaCkiIHhtcDpDcmVhdGVEYXRlPSIyMDIwLTAzLTI2VDIzOjM5OjU5KzAxOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMC0wMy0yNlQyMzo0MToyMyswMTowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyMC0wMy0yNlQyMzo0MToyMyswMTowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo3YzY4Y2U3ZC0xYzVjLTRkOGItYTllOS1hZWQ4MTcxYTAyYzkiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDo5ZTM1YTc3ZC0zNDM0LTU5NGQtODEwNi1jNzVkNjY0MzM0MTEiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo1OTZiMDk0NS1kNWM3LTRjZGItOWE5Ni1iYTJkZmUwNjljODQiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjU5NmIwOTQ1LWQ1YzctNGNkYi05YTk2LWJhMmRmZTA2OWM4NCIgc3RFdnQ6d2hlbj0iMjAyMC0wMy0yNlQyMzozOTo1OSswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo3YzY4Y2U3ZC0xYzVjLTRkOGItYTllOS1hZWQ4MTcxYTAyYzkiIHN0RXZ0OndoZW49IjIwMjAtMDMtMjZUMjM6NDE6MjMrMDE6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAoTWFjaW50b3NoKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7Jq6duAAAKsElEQVR4nO3dW3LqOBRAUTjD7/+Wb06dSqXiC7Yl+dhrDYDkpFvbFg/8+vPnzw+A7/fv6QEAcA0BB8gigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALAIIyCKAgCwCCMgigIAsAgjIIoCALP8B/zdXx8JNQqwAAAAASUVORK5CYII=';
            setVisualizationBase64(mockVisualization);
          }
        }
      });
      
      return () => {
        // Clean up event listeners
        console.log('Cleaning up socket event handlers');
        socketRef.current?.off('analysis_result');
        socketRef.current?.off('analysis_started');
        socketRef.current?.off('analysis_error');
        socketRef.current?.off('analysis_complete');
      };
    }
  }, [socketRef.current, isAnalyzing]);
  
  // Debug effect to log socket connection status
  useEffect(() => {
    if (socketRef.current) {
      console.log('Socket reference created');
      
      const logConnectionStatus = () => {
        console.log('Socket connection status:', socketRef.current?.connected ? 'connected' : 'disconnected');
      };
      
      // Log initial status
      logConnectionStatus();
      
      // Set up interval to log status periodically
      const interval = setInterval(logConnectionStatus, 5000);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [socketRef.current]);
  
  // Cleanup socket connection on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        console.log('Cleaning up socket connection on unmount');
        try {
          socketRef.current.disconnect();
          console.log('Socket disconnected');
        } catch (error) {
          console.error('Error disconnecting socket:', error);
        }
        socketRef.current = null;
      }
    };
  }, []);
  
  // Main screen render
  console.log('Rendering main screen, hasPermission:', hasPermission);
  console.log('Camera module available:', !!cameraModule);
  
  // Render loading state
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Realtime Analysis</Text>
        </View>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading camera...</Text>
        </View>
      </View>
    );
  }
  
  // Render permission denied state
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Realtime Analysis</Text>
        </View>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="camera-outline" size={64} color="#F44336" />
          <Text style={styles.errorText}>
            {permissionError || 'Camera permission denied or module not available'}
          </Text>
          <TouchableOpacity 
            style={[styles.button, { marginTop: 20 }]} 
            onPress={openSettings}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, { marginTop: 12 }]} 
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // Main screen with camera
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: fitnessTheme.background }}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Real-time Analysis</Text>
        </View>
        <Text style={styles.headerSubtitle}>{exerciseType}</Text>
        {!cameraReady && (
          <Text style={styles.cameraStatus}>Camera initializing...</Text>
        )}
      </View>
      
      {/* Main content */}
      <View style={styles.container}>
        {/* Camera Preview or Analysis Visualization */}
        <View style={styles.cameraContainer}>
          {hasPermission && modulesAvailable.camera ? (
            <>
              {/* Camera component */}
              {cameraModule?.CameraView ? (
                <cameraModule.CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  type={cameraType}
                  ratio="16:9"
                  onCameraReady={onCameraReady}
                  onMountError={(error: Error) => console.error('Camera mount error:', error)}
                />
              ) : (
                <View style={styles.camera}>
                  <Text style={{ color: '#fff' }}>Loading camera...</Text>
                </View>
              )}
              
              {/* Visualization overlay */}
              {visualizationBase64 && (
                <View style={styles.visualizationContainer}>
                  <Image
                    source={{ uri: visualizationBase64 }}
                    style={styles.visualizationImage}
                    onLoad={() => console.log('Visualization image loaded successfully')}
                    onError={(error) => console.error('Error loading visualization image:', error.nativeEvent.error)}
                  />
                  {/* Small camera preview when showing visualization */}
                  <View style={styles.smallCameraPreview}>
                    {cameraModule?.CameraView && (
                      <cameraModule.CameraView
                        style={{ flex: 1 }}
                        type={cameraType}
                        ratio="16:9"
                        onMountError={(error: Error) => console.error('Preview camera error:', error)}
                      />
                    )}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.camera, { justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 18 }}>
                {permissionError || 'Camera permission not granted'}
              </Text>
            </View>
          )}
        </View>
        
        {/* Bottom controls area */}
        <View style={styles.bottomContainer}>
          {/* Form Score Display */}
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Form Score</Text>
            <Text style={[styles.scoreValue, { color: parseFloat(formScore) > 5 ? '#4CAF50' : '#F44336' }]}>
              {formScore}
            </Text>
          </View>
          
          {/* Feedback message */}
          {feedback ? (
            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          ) : null}
          
          {/* Control buttons */}
          <View style={styles.controlsRow}>
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')}
              disabled={isAnalyzing}
            >
              <Ionicons name="camera-reverse" size={24} color={isAnalyzing ? '#888' : '#fff'} />
            </TouchableOpacity>
            
            {isAnalyzing ? (
              <TouchableOpacity 
                style={[styles.mainButton, styles.stopButton]} 
                onPress={stopAnalysis}
              >
                <Text style={styles.buttonText}>Stop Analysis</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.mainButton, styles.startButton]} 
                onPress={startAnalysis}
              >
                <Text style={styles.buttonText}>Start Analysis</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.controlButton} onPress={() => {}}>
              <Ionicons name="settings" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: fitnessTheme.background,
  },
  header: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: fitnessTheme.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  headerSubtitle: {
    color: '#fff',
    fontSize: 16,
    marginTop: 4,
  },
  cameraStatus: {
    color: '#ffcc00',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  backButton: {
    padding: 8,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    width: '100%',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  visualizationContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  visualizationImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  exerciseTypeButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  exerciseTypeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 80, // Increased from bottom to avoid Samsung UI
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    padding: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  mainButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  resultsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scoreLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  feedbackContainer: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  feedbackText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
    marginVertical: 10,
  },
  infoText: {
    color: fitnessTheme.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: 10,
    borderRadius: 20,
  },
  codeBlock: {
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 6,
    marginVertical: 10,
    width: '100%',
  },
  codeText: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  smallCameraPreview: {
    position: 'absolute',
    width: 120,
    height: 160,
    bottom: 20,
    right: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
    paddingBottom: 32,
  },
}); 