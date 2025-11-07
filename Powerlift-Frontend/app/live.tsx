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
// Import CameraView with proper types

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

// Use 5 FPS as per requirements
const TARGET_FPS = 5;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// Main screen component
export default function LiveScreen() {
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
  // Timer reference to stop analysis after fixed duration
  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Get screen dimensions
  const { width: screenWidth } = Dimensions.get('window');
  const height = Math.round((screenWidth * 16) / 9);
  
  /* ------------------------------------------------------------------
     Helper Functions declared early so they are available everywhere
  ------------------------------------------------------------------*/

  function formatScore(score: number | undefined): string {
    if (score === undefined || score === null) return '0.0';
    return score.toFixed(1);
  }

  function getFormScoreColor(scoreStr: string): string {
    const score = parseFloat(scoreStr);
    if (isNaN(score)) return '#FFFFFF';
    if (score >= 8.0) return '#4CAF50';
    if (score >= 6.0) return '#FFC107';
    return '#F44336';
  }

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
      
      // Load camera module - now we're just using it for permission checks
      try {
        const cameraModule = await import('expo-camera');
        console.log('Camera module loaded:', cameraModule);
        setCameraModule(cameraModule);
        setModulesAvailable(prev => ({ ...prev, camera: true }));
      } catch (error) {
        console.error('Error with camera module:', error);
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
        // Emit stop event first before cleanup
        if (socketRef.current && socketRef.current.connected) {
          try {
            console.log('Emitting stop_analysis event during unmount');
            socketRef.current.emit('stop_analysis', {});
          } catch (error) {
            console.error('Error stopping analysis during unmount:', error);
          }
        }
        setIsAnalyzing(false);
      }
      
      // Clean up socket connection when component unmounts
      try {
        if (socketRef.current) {
          console.log('Disconnecting socket during unmount');
          // Remove all event listeners to prevent memory leaks
          socketRef.current.off('connect');
          socketRef.current.off('disconnect');
          socketRef.current.off('connect_error');
          socketRef.current.off('connection_response');
          socketRef.current.off('analysis_result');
          socketRef.current.off('live_result');
          // Then disconnect
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
      
      // Add handler for analysis results
      socket.on('analysis_result', (data: any) => {
        console.log('Received analysis result:', data);
        
        try {
          if (data && data.visualization) {
            // Check if the visualization is already a complete data URI or needs prefix
            if (data.visualization.startsWith('data:image')) {
              setVisualizationBase64(data.visualization);
            } else {
              setVisualizationBase64(`data:image/jpeg;base64,${data.visualization}`);
            }
            
            // Update form score if available
            if (data.scores && data.scores.overall !== undefined) {
              setFormScore(formatScore(data.scores.overall));
            }
            
            // Update other states
            if (data.errors) {
              setErrors(data.errors);
            }
            
            if (data.phase) {
              setPhase(data.phase);
            }
            
            if (data.rep_count !== undefined) {
              setRepCount(data.rep_count);
            }
            
            setBarbellDetected(!!data.barbell_detected);
            
            // Update radar chart if available
            if (data.radar_chart) {
              if (data.radar_chart.startsWith('data:image')) {
                setRadarChartBase64(data.radar_chart);
              } else {
                setRadarChartBase64(`data:image/jpeg;base64,${data.radar_chart}`);
              }
            }
            
            // Update feedback if available
            if (data.feedback) {
              if (Array.isArray(data.feedback) && data.feedback.length > 0) {
                setFeedback(data.feedback[0]);
              } else if (typeof data.feedback === 'string') {
                setFeedback(data.feedback);
              }
            }
          }
        } catch (error) {
          console.error('Error processing analysis result:', error);
        }
      });
      
      // (Optional) Backward compatibility: listen for possible legacy event names
      socket.on('live_result', (data: any) => {
        console.log('Received legacy live_result event, treating as analysis_result');
        try {
          if (data && data.visualization) {
            // Check if the visualization is already a complete data URI or needs prefix
            if (data.visualization.startsWith('data:image')) {
              setVisualizationBase64(data.visualization);
            } else {
              setVisualizationBase64(`data:image/jpeg;base64,${data.visualization}`);
            }
            
            // Update form score if available
            if (data.scores && data.scores.overall !== undefined) {
              setFormScore(formatScore(data.scores.overall));
            }
            
            // Update other states
            if (data.errors) {
              setErrors(data.errors);
            }
            
            if (data.phase) {
              setPhase(data.phase);
            }
            
            if (data.rep_count !== undefined) {
              setRepCount(data.rep_count);
            }
            
            setBarbellDetected(!!data.barbell_detected);
            
            // Update radar chart if available
            if (data.radar_chart) {
              if (data.radar_chart.startsWith('data:image')) {
                setRadarChartBase64(data.radar_chart);
              } else {
                setRadarChartBase64(`data:image/jpeg;base64,${data.radar_chart}`);
              }
            }
            
            // Update feedback if available
            if (data.feedback) {
              if (Array.isArray(data.feedback) && data.feedback.length > 0) {
                setFeedback(data.feedback[0]);
              } else if (typeof data.feedback === 'string') {
                setFeedback(data.feedback);
              }
            }
          }
        } catch (error) {
          console.error('Error processing legacy live_result event:', error);
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
    
    console.log('Starting live analysis...');
    
    // Clear any previous visualization
    setVisualizationBase64(null);
    
    // Reset form score and feedback
    setFormScore('0.0');
    setFeedback('');
    
    // Set analyzing state first - IMPORTANT: This needs to be set before emitting events
    setIsAnalyzing(true);
    
    // Wait briefly then emit start event; frame capture will begin from useEffect once isAnalyzing && cameraReady
    await new Promise(resolve => setTimeout(resolve, 100));

    if (socketRef.current && socketRef.current.connected) {
      console.log('Emitting start_analysis event');
      socketRef.current.emit('start_analysis', {
        exercise_type: exerciseType,
        body_weight: '',
        weight_used: '',
        fps: TARGET_FPS
      });
    }

    // Automatically stop analysis after 30 seconds
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }
    analysisTimeoutRef.current = setTimeout(() => {
      console.log('Auto stopping analysis after 30 seconds');
      stopAnalysis();
    }, 30000);
  };
  
  // Stop analysis
  const stopAnalysis = () => {
    console.log('Stopping live analysis...');
    
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

    // Clear automatic stop timer if exists
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }
  };
  
  // Capture and analyze a single frame
  async function captureAndAnalyzeFrame() {
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
            // Schedule using defined FRAME_INTERVAL
            setTimeout(captureAndAnalyzeFrame, FRAME_INTERVAL);
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
        // Schedule using defined FRAME_INTERVAL
        setTimeout(captureAndAnalyzeFrame, FRAME_INTERVAL);
      }
    }
  }
  
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
      console.log(`Sending image (${base64Image.length} chars) to server for live analysis`);
      
      try {
        // Format the image data correctly for the backend
        // The backend expects data:image/jpeg;base64,BASE64DATA format
        const imageData = base64Image.startsWith('data:') 
          ? base64Image 
          : `data:image/jpeg;base64,${base64Image}`;
        
        // Log the first 50 characters of the image data to verify format
        console.log('Image data format:', imageData.substring(0, 50) + '...');
        
        // Create the payload object for live analysis
        const payload = {
          frame: imageData,
          exercise_type: exerciseType,
          timestamp: new Date().getTime()
        };
        
        // Log the payload structure
        console.log('Sending payload with keys:', Object.keys(payload));
        
        // Emit frame with standard event name expected by backend
        socketRef.current.emit('analysis_result', payload);
        console.log('Sent image with analysis_result event');
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
      // Schedule using defined FRAME_INTERVAL
      setTimeout(captureAndAnalyzeFrame, FRAME_INTERVAL);
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
      console.log('Live analysis started');
    } else {
      console.log('Live analysis stopped');
    }
  }, [isAnalyzing]);
  
  // Begin frame capture whenever analyzing flag becomes true and camera is ready
  useEffect(() => {
    if (isAnalyzing && cameraReady) {
      console.log('[DEBUG] Starting first frame capture via useEffect');
      captureAndAnalyzeFrame();
    }
  }, [isAnalyzing, cameraReady]);
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={32} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.screenTitle}>Live Analysis</Text>
          {isConnected ? (
            <View style={[styles.connectionIndicator, { backgroundColor: '#4CAF50' }]} />
          ) : (
            <View style={[styles.connectionIndicator, { backgroundColor: '#F44336' }]} />
          )}
        </View>
        
        <View style={styles.topBarRight}>
          <TouchableOpacity 
            onPress={toggleExerciseType} 
            style={styles.exerciseTypeButton}
            disabled={isAnalyzing}
          >
            <Text style={[
              styles.exerciseTypeText, 
              isAnalyzing ? { opacity: 0.5 } : null
            ]}>
              {exerciseType.charAt(0).toUpperCase() + exerciseType.slice(1)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.cameraContainer}>
        {hasPermission === null ? (
          <View style={[styles.camera, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading camera...</Text>
          </View>
        ) : hasPermission === false ? (
          <View style={[styles.camera, { justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="alert-circle" size={64} color="#F44336" />
            <Text style={styles.errorText}>{permissionError || 'Camera permission denied'}</Text>
            <TouchableOpacity style={styles.settingsButton} onPress={openSettings}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        ) : modulesAvailable.camera ? (
          <>
            {cameraModule?.CameraView ? (
              <cameraModule.CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={cameraType as any}
                onCameraReady={onCameraReady}
                onMountError={(error: Error) => console.error('Camera mount error:', error)}
              />
            ) : (
              <View style={styles.camera}>
                <Text style={{ color: '#fff' }}>Loading camera...</Text>
              </View>
            )}
          </>
        ) : (
          <MockCamera 
            style={styles.camera} 
            type={cameraType} 
            ratio="16:9"
            cameraRef={cameraRef}
          />
        )}
        
        {/* Visualization overlay */}
        {visualizationBase64 && (
          <View style={styles.visualizationContainer}>
            <Image
              source={{ uri: visualizationBase64 }}
              style={styles.visualizationImage}
              resizeMode="contain"
              onError={(e) => console.error('Image loading error:', e.nativeEvent.error)}
            />
          </View>
        )}
        
        {/* Score display */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Form Score</Text>
          <Text style={[styles.scoreValue, { color: getFormScoreColor(formScore) }]}>
            {getFormattedScore()}
          </Text>
          <Text style={styles.feedbackText}>
            {feedback || (barbellDetected ? 'Barbell detected' : 'No barbell detected')}
          </Text>
          
          <View style={styles.additionalInfo}>
            {phase && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Phase:</Text>
                <Text style={styles.infoValue}>{phase}</Text>
              </View>
            )}
            
            {repCount > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Reps:</Text>
                <Text style={styles.infoValue}>{repCount}</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Camera controls */}
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={[styles.cameraButton, { opacity: isAnalyzing ? 0.5 : 1 }]}
            onPress={toggleCameraType}
            disabled={isAnalyzing}
          >
            <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          {isAnalyzing ? (
            <TouchableOpacity
              style={[styles.captureButton, { backgroundColor: '#F44336' }]}
              onPress={stopAnalysis}
            >
              <Ionicons name="stop" size={36} color="#FFFFFF" />
              <Text style={styles.buttonText}>Stop</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={startAnalysis}
            >
              <Ionicons name="play" size={36} color="#FFFFFF" />
              <Text style={styles.buttonText}>Start Live</Text>
            </TouchableOpacity>
          )}
          
          <View style={{ width: 50 }} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  backButton: {
    padding: 5,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: FONTS.bold,
    marginRight: 10,
  },
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseTypeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  exerciseTypeText: {
    color: '#FFFFFF',
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  visualizationContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  visualizationImage: {
    width: '100%',
    height: '100%',
  },
  scoreContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    minWidth: 120,
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  scoreValue: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    marginVertical: 5,
  },
  feedbackText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: 'center',
  },
  additionalInfo: {
    marginTop: 10,
    width: '100%',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    paddingHorizontal: 30,
  },
  cameraButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: fitnessTheme.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
  },
  errorText: {
    color: '#FFFFFF',
    marginTop: 15,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  settingsButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontFamily: FONTS.medium,
  },
}); 