import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useCustomTheme from '../hooks/useCustomTheme';
import PowerLiftAPI from '../services/api';

// Analysis states
type AnalysisState = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

// Tutorial videos
const tutorialVideos = [
  require('../assets/videos/Bench Press Tutorial.mp4'),
  require('../assets/videos/Deadlift Tutorial.mp4'),
  require('../assets/videos/Squat Tutorial.mp4'),
];

// Tutorial video titles
const tutorialTitles = [
  'Bench Press Tutorial',
  'Deadlift Tutorial',
  'Squat Tutorial',
];

// Tutorial video descriptions
const tutorialDescriptions = [
  'Learn proper bench press form for maximum chest development and injury prevention.',
  'Master the deadlift technique to build overall strength and power safely.',
  'Perfect your squat form for stronger legs and better functional movement.',
];

// Exercise type mapping for display
type ExerciseType = 'deadlift' | 'squat' | 'bench';

const exerciseTypeDisplay: Record<ExerciseType, string> = {
  'deadlift': 'Deadlift',
  'squat': 'Squat',
  'bench': 'Bench Press',
};

export default function VideoAnalysisScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useCustomTheme();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [noBarbellDetected, setNoBarbellDetected] = useState<boolean>(false);
  
  // New state for wrong exercise type detection
  const [wrongExerciseDetected, setWrongExerciseDetected] = useState<boolean>(false);
  const [detectedExerciseType, setDetectedExerciseType] = useState<ExerciseType | null>(null);
  
  // Tutorial video state
  const [tutorialVideoIndex, setTutorialVideoIndex] = useState<number>(0);
  const [shouldPlayTutorial, setShouldPlayTutorial] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [videoStatus, setVideoStatus] = useState<AVPlaybackStatus | null>(null);
  const videoRef = useRef<Video>(null);
  
  // Animation for the tutorial card
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // Get params
  const exerciseType = (params.exerciseType as ExerciseType) || 'deadlift';
  const bodyWeight = params.bodyWeight as string || '';
  const weightUsed = params.weightUsed as string || '';

  // Define styles that depend on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      paddingBottom: 10,
    },
    backButton: {
      padding: 10,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    placeholder: {
      width: 44, // Same width as back button for centering
    },
    infoContainer: {
      backgroundColor: theme.surfaceVariant,
      padding: 15,
      borderRadius: 8,
      marginHorizontal: 20,
    },
    infoText: {
      color: theme.text,
      fontSize: 16,
      marginBottom: 5,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 20,
      paddingTop: 10,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: theme.text,
      marginTop: 20,
      fontSize: 16,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    optionsContainer: {
      width: '100%',
    },
    recordOption: {
      alignItems: 'center',
      padding: 20,
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: `${theme.primary}40`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    optionText: {
      color: theme.text,
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    optionDescription: {
      color: theme.textMuted,
      textAlign: 'center',
      fontSize: 14,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 20,
    },
    thumbnailContainer: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 24,
    },
    thumbnail: {
      width: '100%',
      height: 200,
      borderRadius: 12,
      marginBottom: 16,
    },
    changeButton: {
      backgroundColor: theme.surfaceVariant,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    changeButtonText: {
      color: theme.text,
      fontWeight: 'bold',
    },
    analyzeButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    analyzeButtonText: {
      color: theme.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    statusText: {
      color: theme.text,
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 16,
      textAlign: 'center',
    },
    subStatusText: {
      color: theme.textMuted,
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
    },
    progressBar: {
      height: 8,
      width: '80%',
      backgroundColor: theme.surfaceVariant,
      borderRadius: 4,
      marginTop: 16,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
    },
    resultsButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
    },
    resultsButtonText: {
      color: theme.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    newButton: {
      backgroundColor: theme.surfaceVariant,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    newButtonText: {
      color: theme.text,
      fontSize: 16,
    },
    retryButton: {
      backgroundColor: theme.surfaceVariant,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
    },
    retryButtonText: {
      color: theme.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    errorText: {
      color: theme.error,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 16,
    },
    instructions: {
      color: theme.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    noBarbellModalContent: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 24,
      width: '90%',
      maxWidth: 400,
      alignItems: 'center',
    },
    noBarbellTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
      marginBottom: 12,
    },
    noBarbellMessage: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    noBarbellTipContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      width: '100%',
    },
    noBarbellTip: {
      fontSize: 16,
      color: theme.text,
      marginLeft: 12,
    },
    noBarbellButtonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: 20,
    },
    noBarbellButton: {
      backgroundColor: theme.surfaceVariant,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginHorizontal: 8,
      minWidth: 100,
      alignItems: 'center',
    },
    noBarbellContinueButton: {
      backgroundColor: theme.primary,
    },
    noBarbellButtonText: {
      color: theme.text,
      fontWeight: 'bold',
      fontSize: 16,
    },
    tutorialContainer: {
      width: '100%',
      marginTop: 30,
      alignItems: 'center',
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: 'rgba(0, 0, 0, 0.8)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    tutorialCard: {
      width: '100%',
      padding: 20,
      borderRadius: 16,
      backgroundColor: theme.primary,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      marginTop: 20,
    },
    tutorialHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    tutorialTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 10,
    },
    nextButtonText: {
      color: theme.text,
      fontSize: 14,
      marginRight: 5,
    },
    tutorialName: {
      color: theme.text,
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 10,
    },
    tutorialVideo: {
      width: '100%',
      height: 220,
      borderRadius: 12,
      backgroundColor: theme.background,
    },
    videoContainer: {
      width: '100%',
      height: 220,
      borderRadius: 12,
      backgroundColor: theme.background,
    },
    videoControls: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 15,
    },
    muteButton: {
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      padding: 8,
      borderRadius: 20,
      marginRight: 10,
    },
    videoProgressContainer: {
      flex: 1,
      height: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 2,
    },
    videoProgress: {
      height: '100%',
      backgroundColor: theme.text,
      borderRadius: 2,
    },
    tutorialDescription: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 22,
      marginTop: 10,
    },
    wrongExerciseModalContent: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 24,
      width: '90%',
      maxWidth: 400,
      alignItems: 'center',
    },
    wrongExerciseTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.warning,
      marginTop: 16,
      marginBottom: 12,
    },
    wrongExerciseMessage: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    exerciseHighlight: {
      fontWeight: 'bold',
      color: theme.text,
    },
    wrongExerciseTipContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 24,
      width: '100%',
      paddingHorizontal: 8,
    },
    wrongExerciseTip: {
      fontSize: 16,
      color: theme.text,
      marginLeft: 12,
      flex: 1,
    },
    comparisonContainer: {
      width: '100%',
      marginBottom: 24,
      backgroundColor: theme.surfaceVariant,
      borderRadius: 8,
      padding: 16,
    },
    comparison: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    comparisonLabel: {
      color: theme.textMuted,
      fontSize: 14,
      width: 80,
    },
    exerciseTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceVariant,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    exerciseName: {
      color: theme.text,
      fontSize: 16,
      marginLeft: 8,
    },
    wrongExerciseButtonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: 20,
    },
    wrongExerciseButton: {
      backgroundColor: theme.surfaceVariant,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginHorizontal: 8,
      minWidth: 100,
      alignItems: 'center',
    },
    wrongExerciseContinueButton: {
      backgroundColor: theme.warning,
    },
    wrongExerciseButtonText: {
      color: theme.text,
      fontWeight: 'bold',
      fontSize: 16,
    },
  });

  // Request permissions on component mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        try {
          const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
          const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          
          setHasPermission(
            cameraPermission.status === 'granted' && 
            libraryPermission.status === 'granted'
          );
          
          if (cameraPermission.status !== 'granted' || libraryPermission.status !== 'granted') {
            Alert.alert(
              'Permission Required',
              'Camera and media library access are needed for video recording and selection.',
              [{ text: 'OK' }]
            );
          }
        } catch (error) {
          console.error('Permission request error:', error);
          // Continue without permissions
        }
      }
    })();
  }, []);
  
  // Effect to handle tutorial video when processing state changes
  useEffect(() => {
    if (analysisState === 'processing') {
      // Select a random tutorial video
      const randomIndex = Math.floor(Math.random() * tutorialVideos.length);
      setTutorialVideoIndex(randomIndex);
      setShouldPlayTutorial(true);
      
      // Animate the tutorial card appearance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true
        })
      ]).start();
    } else {
      setShouldPlayTutorial(false);
    }
  }, [analysisState]);
  
  // Function to toggle video mute state
  const toggleMute = () => {
    setIsVideoMuted(!isVideoMuted);
  };
  
  // Function to switch to the next tutorial video
  const nextTutorialVideo = () => {
    const nextIndex = (tutorialVideoIndex + 1) % tutorialVideos.length;
    setTutorialVideoIndex(nextIndex);
    
    // Reset video position
    if (videoRef.current) {
      videoRef.current.playFromPositionAsync(0);
    }
  };
  
  // Function to handle video playback status updates
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    setVideoStatus(status);
  };

  // Record video using camera
  const recordVideo = async () => {
    try {
      console.log('Opening camera...');
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 1,
        videoMaxDuration: 30,
      });
      
      console.log('Camera result:', result);
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedVideo = result.assets[0];
        console.log('Recorded video:', selectedVideo);
        setVideoUri(selectedVideo.uri);
        setThumbnailUri(selectedVideo.uri); // Use video URI as placeholder
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Recording Error', 'Failed to record video. Please try again.');
    }
  };

  // Pick a video from the library
  const pickVideo = async () => {
    try {
      console.log('Opening image picker...');
      
      // Launch picker with a simpler approach
      let result;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: true,
          quality: 1,
        });
      } catch (error) {
        console.error('Error in launchImageLibraryAsync:', error);
        
        // Fallback to a simpler picker config if the first attempt fails
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: false,
          quality: 1,
        });
      }

      console.log('Picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedVideo = result.assets[0];
        console.log('Selected video:', selectedVideo);
        setVideoUri(selectedVideo.uri);
        setThumbnailUri(selectedVideo.uri); // We'll use the video URI as a placeholder
        setAnalysisState('idle');
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  // Upload and analyze the video
  const uploadVideo = async () => {
    if (!videoUri) {
      Alert.alert('No video selected', 'Please select a video first.');
      return;
    }

    try {
      setAnalysisState('uploading');
      setUploadProgress(0);

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      console.log('File info:', fileInfo);

      console.log('Uploading with params:', {
        exerciseType,
        bodyWeight,
        weightUsed
      });

      // Upload video
      const response = await PowerLiftAPI.uploadVideo(
        videoUri,
        (progress) => setUploadProgress(progress),
        {
          exerciseType,
          bodyWeight,
          weightUsed
        }
      );

      console.log('Upload complete, response:', response);

      if (response && response.analysis_id) {
        setAnalysisId(response.analysis_id);
        setAnalysisState('processing');
        
        // Start polling for analysis status
        pollAnalysisStatus(response.analysis_id);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setAnalysisState('error');
      Alert.alert('Upload Failed', 'Could not upload the video. Please try again.');
    }
  };

  // Poll for analysis status
  const pollAnalysisStatus = async (id: string) => {
    try {
      const checkStatus = async () => {
        try {
          const statusResponse = await PowerLiftAPI.checkAnalysisStatus(id);
          console.log('Status check:', statusResponse);

          if (statusResponse.status === 'completed') {
            // Store the analysis data
            setAnalysisData(statusResponse);
            
            // Check if wrong exercise type was detected
            if (statusResponse.detected_exercise_type && 
                statusResponse.expected_exercise_type &&
                statusResponse.detected_exercise_type !== statusResponse.expected_exercise_type) {
              console.log(`Wrong exercise type detected: expected ${statusResponse.expected_exercise_type}, detected ${statusResponse.detected_exercise_type}`);
              setDetectedExerciseType(statusResponse.detected_exercise_type as ExerciseType);
              setWrongExerciseDetected(true);
              // Don't set analysis state to completed yet - wait for user decision
            }
            // Check if no barbell was detected
            else if (statusResponse.no_barbell_detected === true) {
              console.log('No barbell detected in the video');
              // Don't set analysis state to completed yet - wait for user decision
              setNoBarbellDetected(true);
            } else {
              // Everything is good, proceed to completed state
              setAnalysisState('completed');
            }
          } else if (statusResponse.status === 'failed') {
            setAnalysisState('error');
            Alert.alert('Analysis Failed', 'The video analysis failed. Please try again with a different video.');
          } else {
            // Still processing, poll again
            setTimeout(checkStatus, 2000);
          }
        } catch (error) {
          console.error('Status check error:', error);
          setAnalysisState('error');
          Alert.alert('Connection Error', 'Failed to check analysis status. Please try again.');
        }
      };

      // Start polling
      checkStatus();
    } catch (error) {
      console.error('Polling error:', error);
      setAnalysisState('error');
    }
  };

  // Reset the analysis
  const resetAnalysis = () => {
    setVideoUri(null);
    setThumbnailUri(null);
    setAnalysisState('idle');
    setUploadProgress(0);
    setAnalysisId(null);
    setAnalysisData(null);
    setNoBarbellDetected(false);
    setWrongExerciseDetected(false);
    setDetectedExerciseType(null);
  };

  // View the analysis results
  const viewResults = async () => {
    if (!analysisId) return;
    
    try {
      // If no barbell was detected or wrong exercise type and user wants to continue anyway,
      // we should first hide the modals before navigating
      if (noBarbellDetected) {
        setNoBarbellDetected(false);
      }
      
      if (wrongExerciseDetected) {
        setWrongExerciseDetected(false);
      }
      
      // Get video and chart URLs
      const videoUrl = await PowerLiftAPI.getAnalysisVideoUrl(analysisId);
      const radarChartUrl = await PowerLiftAPI.getRadarChartUrl(analysisId);
      
      // Get scores from analysis data or use defaults
      let scores = analysisData?.scores;
      if (!scores) {
        scores = {
          knee_alignment: 75,
          spine_alignment: 80,
          hip_stability: 70,
          bar_path_efficiency: 85,
          overall: 78
        };
      }
      
      // Determine which exercise type to use for results
      const resultExerciseType = detectedExerciseType || exerciseType;
      
      // Navigate to results screen with the analysis data
      router.replace({
        pathname: '/results',
        params: {
          analysisId,
          videoUrl,
          radarChartUrl,
          exerciseType: resultExerciseType,
          bodyWeight,
          weightUsed,
          scores: JSON.stringify(scores),
          noBarbellDetected: noBarbellDetected ? 'true' : 'false',
          wrongExerciseDetected: wrongExerciseDetected ? 'true' : 'false',
          detectedExerciseType: detectedExerciseType || ''
        }
      });
    } catch (error) {
      console.error('Error navigating to results:', error);
      Alert.alert('Error', 'Failed to load results. Please try again.');
    }
  };

  // If permissions are not determined yet
  if (hasPermission === null) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.success} />
          <Text style={dynamicStyles.loadingText}>Requesting permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Render the UI based on the current state
  const renderContent = () => {
    switch (analysisState) {
      case 'idle':
        return (
          <View style={dynamicStyles.centerContent}>
            {thumbnailUri ? (
              <View style={dynamicStyles.thumbnailContainer}>
                <Image source={{ uri: thumbnailUri }} style={dynamicStyles.thumbnail} />
                <TouchableOpacity 
                  style={dynamicStyles.changeButton} 
                  onPress={pickVideo}
                >
                  <Text style={dynamicStyles.changeButtonText}>Change Video</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={dynamicStyles.optionsContainer}>
                <TouchableOpacity 
                  style={dynamicStyles.recordOption}
                  onPress={recordVideo}
                >
                  <View style={dynamicStyles.iconContainer}>
                    <Ionicons name="videocam" size={48} color={theme.primary} />
                  </View>
                  <Text style={dynamicStyles.optionText}>Record New Video</Text>
                  <Text style={dynamicStyles.optionDescription}>
                    Use your camera to record a new exercise video
                  </Text>
                </TouchableOpacity>
                
                <View style={dynamicStyles.divider} />
                
                <TouchableOpacity 
                  style={dynamicStyles.recordOption}
                  onPress={pickVideo}
                >
                  <View style={dynamicStyles.iconContainer}>
                    <Ionicons name="images" size={48} color={theme.primary} />
                  </View>
                  <Text style={dynamicStyles.optionText}>Choose Existing Video</Text>
                  <Text style={dynamicStyles.optionDescription}>
                    Select a video from your gallery
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            {videoUri && (
              <TouchableOpacity 
                style={dynamicStyles.analyzeButton}
                onPress={uploadVideo}
              >
                <Text style={dynamicStyles.analyzeButtonText}>Analyze Form</Text>
              </TouchableOpacity>
            )}
          </View>
        );
        
      case 'uploading':
        return (
          <View style={dynamicStyles.centerContent}>
            <ActivityIndicator size="large" color={theme.success} />
            <Text style={dynamicStyles.statusText}>Uploading video... {uploadProgress}%</Text>
            <View style={dynamicStyles.progressBar}>
              <View style={[dynamicStyles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
          </View>
        );
        
      case 'processing':
        return (
          <View style={dynamicStyles.centerContent}>
            <ActivityIndicator size="large" color={theme.success} />
            <Text style={dynamicStyles.statusText}>PowerLift analyzing your form...</Text>
            <Text style={dynamicStyles.subStatusText}>This may take a few minutes</Text>
            
            {shouldPlayTutorial && (
              <Animated.View 
                style={[
                  dynamicStyles.tutorialContainer,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}
              >
                <View style={dynamicStyles.tutorialCard}>
                  <View style={dynamicStyles.tutorialHeader}>
                    <Text style={dynamicStyles.tutorialTitle}>
                      While You Wait
                    </Text>
                    <TouchableOpacity 
                      style={dynamicStyles.nextButton}
                      onPress={nextTutorialVideo}
                    >
                      <Text style={dynamicStyles.nextButtonText}>Next Tip</Text>
                      <Ionicons name="arrow-forward" size={16} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={dynamicStyles.tutorialName}>
                    {tutorialTitles[tutorialVideoIndex]}
                  </Text>
                  
                  <Video
                    ref={videoRef}
                    source={tutorialVideos[tutorialVideoIndex]}
                    rate={1.0}
                    volume={1.0}
                    isMuted={isVideoMuted}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={true}
                    isLooping={true}
                    style={dynamicStyles.videoContainer}
                    useNativeControls
                    onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                  />
                  
                  <View style={dynamicStyles.videoControls}>
                    <TouchableOpacity 
                      style={dynamicStyles.muteButton}
                      onPress={toggleMute}
                    >
                      <Ionicons 
                        name={isVideoMuted ? "volume-mute" : "volume-high"} 
                        size={24} 
                        color={theme.text} 
                      />
                    </TouchableOpacity>
                    
                    <View style={dynamicStyles.videoProgressContainer}>
                      {videoStatus?.isLoaded && (
                        <View 
                          style={[
                            dynamicStyles.videoProgress, 
                            { 
                              width: `${
                                videoStatus.positionMillis / 
                                (videoStatus.durationMillis || 1) * 100
                              }%` 
                            }
                          ]} 
                        />
                      )}
                    </View>
                  </View>
                  
                  <Text style={dynamicStyles.tutorialDescription}>
                    {tutorialDescriptions[tutorialVideoIndex]}
                  </Text>
                </View>
              </Animated.View>
            )}
          </View>
        );
        
      case 'completed':
        return (
          <View style={dynamicStyles.centerContent}>
            <Ionicons name="checkmark-circle" size={64} color={theme.primary} />
            <Text style={dynamicStyles.statusText}>Analysis Complete!</Text>
            
            <TouchableOpacity 
              style={dynamicStyles.resultsButton}
              onPress={viewResults}
            >
              <Text style={dynamicStyles.resultsButtonText}>View Results</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={dynamicStyles.newButton}
              onPress={resetAnalysis}
            >
              <Text style={dynamicStyles.newButtonText}>Analyze Another Video</Text>
            </TouchableOpacity>
          </View>
        );
        
      case 'error':
        return (
          <View style={dynamicStyles.centerContent}>
            <Ionicons name="alert-circle" size={64} color={theme.error} />
            <Text style={dynamicStyles.statusText}>Analysis Failed</Text>
            <Text style={dynamicStyles.errorText}>
              Something went wrong while analyzing your video. Please try again.
            </Text>
            
            <TouchableOpacity 
              style={dynamicStyles.retryButton}
              onPress={resetAnalysis}
            >
              <Text style={dynamicStyles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity 
          style={dynamicStyles.backButton}
          onPress={() => router.back()}
          disabled={analysisState === 'uploading' || analysisState === 'processing'}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>
          {exerciseType.toUpperCase()} RECORDING
        </Text>
        <View style={dynamicStyles.placeholder} />
      </View>
      
      <View style={dynamicStyles.infoContainer}>
        <Text style={dynamicStyles.infoText}>
          Body Weight: {bodyWeight} kg
        </Text>
        <Text style={dynamicStyles.infoText}>
          Weight Used: {weightUsed} kg
        </Text>
      </View>
      
      <ScrollView contentContainerStyle={dynamicStyles.scrollContent}>
        {renderContent()}
        
        {analysisState === 'idle' && !videoUri && (
          <Text style={dynamicStyles.instructions}>
            Position yourself where your full body is visible and make sure there's good lighting
          </Text>
        )}
      </ScrollView>

      {/* No Barbell Detected Modal */}
      <Modal
        visible={noBarbellDetected}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setNoBarbellDetected(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.noBarbellModalContent}>
            <Ionicons name="barbell-outline" size={64} color={theme.error} />
            <Text style={dynamicStyles.noBarbellTitle}>No Barbell Detected</Text>
            <Text style={dynamicStyles.noBarbellMessage}>
              We couldn't detect a barbell in your video. For accurate form analysis, please:
            </Text>
            <View style={dynamicStyles.noBarbellTipContainer}>
              <Ionicons name="checkmark-circle" size={24} color={theme.success} />
              <Text style={dynamicStyles.noBarbellTip}>Use a standard barbell for your exercise</Text>
            </View>
            <View style={dynamicStyles.noBarbellTipContainer}>
              <Ionicons name="checkmark-circle" size={24} color={theme.success} />
              <Text style={dynamicStyles.noBarbellTip}>Ensure the barbell is clearly visible in the frame</Text>
            </View>
            <View style={dynamicStyles.noBarbellTipContainer}>
              <Ionicons name="checkmark-circle" size={24} color={theme.success} />
              <Text style={dynamicStyles.noBarbellTip}>Record in a well-lit environment</Text>
            </View>
            <View style={dynamicStyles.noBarbellButtonContainer}>
              <TouchableOpacity 
                style={dynamicStyles.noBarbellButton}
                onPress={() => {
                  setNoBarbellDetected(false);
                  resetAnalysis();
                }}
              >
                <Text style={dynamicStyles.noBarbellButtonText}>Try Again</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[dynamicStyles.noBarbellButton, dynamicStyles.noBarbellContinueButton]}
                onPress={() => {
                  // Set analysis state to completed before viewing results
                  setAnalysisState('completed');
                  viewResults();
                }}
              >
                <Text style={dynamicStyles.noBarbellButtonText}>Continue Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Wrong Exercise Type Modal */}
      <Modal
        visible={wrongExerciseDetected}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setWrongExerciseDetected(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.wrongExerciseModalContent}>
            <Ionicons name="alert-circle" size={64} color={theme.warning} />
            <Text style={dynamicStyles.wrongExerciseTitle}>Different Exercise Detected</Text>
            <Text style={dynamicStyles.wrongExerciseMessage}>
              You selected <Text style={dynamicStyles.exerciseHighlight}>{exerciseTypeDisplay[exerciseType]}</Text> but our AI detected a <Text style={dynamicStyles.exerciseHighlight}>{detectedExerciseType ? exerciseTypeDisplay[detectedExerciseType] : 'different exercise'}</Text> in your video.
            </Text>
            
            <View style={dynamicStyles.wrongExerciseTipContainer}>
              <Ionicons name="information-circle" size={24} color={theme.success} />
              <Text style={dynamicStyles.wrongExerciseTip}>
                For accurate form analysis, the video should match the selected exercise type
              </Text>
            </View>
            
            {detectedExerciseType && (
              <View style={dynamicStyles.comparisonContainer}>
                <View style={dynamicStyles.comparison}>
                  <Text style={dynamicStyles.comparisonLabel}>Selected:</Text>
                  <View style={dynamicStyles.exerciseTag}>
                    <Ionicons 
                      name={
                        exerciseType === 'squat' ? 'body' : 
                        exerciseType === 'deadlift' ? 'barbell' : 
                        'fitness'
                      } 
                      size={32} 
                      color={theme.error} 
                    />
                    <Text style={dynamicStyles.exerciseName}>{exerciseTypeDisplay[exerciseType]}</Text>
                  </View>
                </View>
                
                <View style={dynamicStyles.comparison}>
                  <Text style={dynamicStyles.comparisonLabel}>Detected:</Text>
                  <View style={dynamicStyles.exerciseTag}>
                    <Ionicons 
                      name={
                        detectedExerciseType === 'squat' ? 'body' : 
                        detectedExerciseType === 'deadlift' ? 'barbell' : 
                        'fitness'
                      } 
                      size={32} 
                      color={theme.success} 
                    />
                    <Text style={dynamicStyles.exerciseName}>{exerciseTypeDisplay[detectedExerciseType]}</Text>
                  </View>
                </View>
              </View>
            )}
            
            <View style={dynamicStyles.wrongExerciseButtonContainer}>
              <TouchableOpacity 
                style={dynamicStyles.wrongExerciseButton}
                onPress={() => {
                  setWrongExerciseDetected(false);
                  resetAnalysis();
                }}
              >
                <Text style={dynamicStyles.wrongExerciseButtonText}>Try Again</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[dynamicStyles.wrongExerciseButton, dynamicStyles.wrongExerciseContinueButton]}
                onPress={() => {
                  // Set analysis state to completed before viewing results
                  setAnalysisState('completed');
                  viewResults();
                }}
              >
                <Text style={dynamicStyles.wrongExerciseButtonText}>Continue Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
} 