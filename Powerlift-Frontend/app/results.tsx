import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import TabBar from '../components/TabBar';
import { fitnessTheme } from '../constants/Colors';
import useAuth from '../hooks/useAuth';
import useProgress from '../hooks/useProgress';
import PowerLiftAPI from '../services/api';

// Type for route params
type ResultsParams = {
  analysisId: string;
  videoUrl?: string;
  radarChartUrl?: string;
  scores?: string; // JSON string of scores
  exerciseType?: string;
  bodyWeight?: string;
  weightUsed?: string;
  isRealTimeAnalysis?: string; // Flag to indicate if this is a real-time analysis
  noBarbellDetected?: string; // Flag to indicate if no barbell was detected
};

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<ResultsParams>();
  const { user } = useAuth();
  const { addProgressEntry } = useProgress();
  
  // State
  const [loading, setLoading] = useState(true);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [radarChartUrl, setRadarChartUrl] = useState<string | null>(null);

  const [scores, setScores] = useState<{
    knee_alignment?: number;
    spine_alignment?: number;
    hip_stability?: number;
    bar_path_efficiency?: number;
    form?: number;
    stability?: number;
    range_of_motion?: number;
    tempo?: number;
    overall: number;
  } | null>(null);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [mcsvmAnalysis, setMcsvmAnalysis] = useState<{
    classification: string;
    confidence: number;
    recommendations: string[];
    probabilities: { [key: string]: number };
    features?: number[];
    real_time?: any;
  } | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [noBarbellDetected, setNoBarbellDetected] = useState<boolean>(false);
  const [infoModalVisible, setInfoModalVisible] = useState<boolean>(false);
  const [activeScoreInfo, setActiveScoreInfo] = useState<{
    title: string;
    description: string;
  }>({ title: '', description: '' });
  
  // Get exercise info from params
  const exerciseType = params.exerciseType as string || 'deadlift';
  const bodyWeight = params.bodyWeight as string || '';
  const weightUsed = params.weightUsed as string || '';
  const analysisId = params.analysisId as string || '';
  
  // Check if no barbell was detected
  useEffect(() => {
    if (params.noBarbellDetected === 'true') {
      setNoBarbellDetected(true);
    }
  }, [params.noBarbellDetected]);
  
  // Get screen dimensions for video sizing
  const { width } = Dimensions.get('window');
  const videoHeight = width * (9/16); // 16:9 aspect ratio

  // Parse scores once when component mounts
  useEffect(() => {
    if (params.scores) {
      try {
        const parsedScores = JSON.parse(params.scores);
        setScores(parsedScores);
        setLoading(false);
        
        // Save to progress tracking if we have an analysis ID and user is logged in
        if (user && analysisId && parsedScores.overall) {
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
          
          addProgressEntry({
            exercise_type: exerciseType,
            date: today,
            score: parsedScores.overall,
            weight_used: weightUsed,
            body_weight: bodyWeight,
            notes: `Analysis ID: ${analysisId}`
          }).catch(err => {
            console.error('Failed to save progress entry:', err);
          });
        }
      } catch (e) {
        console.error('Error parsing scores:', e);
      }
    }
  }, [params.scores, analysisId, user, addProgressEntry, exerciseType, weightUsed, bodyWeight]);

  // Set URLs just once when they're available in params
  useEffect(() => {
    if (params.videoUrl) {
      setVideoUrl(params.videoUrl);
    }
    
    if (params.radarChartUrl) {
      setRadarChartUrl(params.radarChartUrl);
    }
  }, [params.videoUrl, params.radarChartUrl]);

  // Load URLs from API if not provided in params
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check if this is a real-time analysis
        const isRealTimeAnalysis = params.isRealTimeAnalysis === 'true';
        
        // Only fetch video URL if not a real-time analysis
        if (!params.videoUrl && analysisId && !videoUrl && !isRealTimeAnalysis) {
          const url = await PowerLiftAPI.getAnalysisVideoUrl(analysisId);
          setVideoUrl(url);
        } else if (isRealTimeAnalysis) {
          // For real-time analyses, set video error to true
          setVideoError(true);
        }
        
        if (!params.radarChartUrl && analysisId && !radarChartUrl) {
          const url = await PowerLiftAPI.getRadarChartUrl(analysisId);
          setRadarChartUrl(url);
        }
        
        // Always fetch analysis data from backend if we have an analysisId
        if (analysisId) {
          console.log(`Fetching analysis data for ID: ${analysisId}`);
          const analysisData = await PowerLiftAPI.checkAnalysisStatus(analysisId);
          console.log('Raw analysis data from API:', JSON.stringify(analysisData, null, 2));
          
          if (analysisData.status === 'completed') {
            if (analysisData.scores) {
              console.log('Using real scores from backend:', analysisData.scores);
              setScores(analysisData.scores);
              if (analysisData.feedback) {
                setFeedback(analysisData.feedback);
              }
              // Check for MCSVM analysis data
              if (analysisData.mcsvm_analysis) {
                console.log('MCSVM analysis data found:', analysisData.mcsvm_analysis);
                setMcsvmAnalysis(analysisData.mcsvm_analysis);
              }
            } else {
              console.warn('API returned completed status but no scores');
              if (!scores) {
                console.log('No scores available, using default scores');
                setScores({
                  knee_alignment: 75,
                  spine_alignment: 80,
                  hip_stability: 70,
                  bar_path_efficiency: 85,
                  overall: 78
                });
              }
            }
          } else if (!scores) {
            // Only use default scores if we don't have any scores and the API didn't return them
            console.log('API returned no scores, using default scores');
            setScores({
              knee_alignment: 75,
              spine_alignment: 80,
              hip_stability: 70,
              bar_path_efficiency: 85,
              overall: 78
            });
            setFeedback([
              "Keep your back straight throughout the movement",
              "Maintain more consistent tempo during the eccentric phase",
              "Keep your knees tracking over your toes during the entire movement"
            ]);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading analysis data:', error);
        setVideoError(true);
        
        // Only use default scores if we don't have any scores already
        if (!scores) {
          console.log('Error fetching scores, using default scores');
          setScores({
            knee_alignment: 75,
            spine_alignment: 80,
            hip_stability: 70,
            bar_path_efficiency: 85,
            overall: 78
          });
          setFeedback([
            "Keep your back straight throughout the movement",
            "Maintain more consistent tempo during the eccentric phase",
            "Keep your knees tracking over your toes during the entire movement"
          ]);
          setLoading(false);
        }
      }
    };
    
    loadData();
  }, [analysisId, params.videoUrl, params.radarChartUrl, params.isRealTimeAnalysis, videoUrl, radarChartUrl]);
  
  // Share analysis results
  const shareResults = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out my PowerLift form analysis! Overall score: ${scores?.overall.toFixed(1) || 'N/A'}/100`,
        title: 'PowerLift Form Analysis',
      });
    } catch (error) {
      console.error('Error sharing results:', error);
    }
  }, [scores]);

  // Submit feedback for MCSVM form classification
  const submitMcsvmFeedback = useCallback(async (isCorrect: boolean, correctForm?: string) => {
    if (!mcsvmAnalysis || feedbackSubmitted || submittingFeedback) return;
    
    setSubmittingFeedback(true);
    try {
      // Use the actual features from MCSVM analysis
      const frameFeatures = mcsvmAnalysis.features || Array(50).fill(0);
      
      const feedbackData = {
        exercise_type: exerciseType,
        predicted_form: mcsvmAnalysis.classification,
        is_correct: isCorrect,
        correct_form: correctForm || mcsvmAnalysis.classification,
        frame_features: frameFeatures,
        confidence_score: mcsvmAnalysis.confidence,
        analysis_id: analysisId
      };
      
      await PowerLiftAPI.submitFormFeedback(feedbackData);
      setFeedbackSubmitted(true);
      console.log('Feedback submitted successfully');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setSubmittingFeedback(false);
    }
  }, [mcsvmAnalysis, feedbackSubmitted, submittingFeedback, exerciseType, analysisId]);
  
  // Calculate color based on score
  const getScoreColor = useCallback((score: number) => {
    if (score < 50) return fitnessTheme.error; // Red
    if (score < 75) return fitnessTheme.warning; // Yellow
    return fitnessTheme.primary; // Primary color
  }, []);
  
  // Navigate back to home
  const goToHome = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);
  
  // Handle retry recording
  const handleRetry = useCallback(() => {
    router.back();
  }, [router]);
  
  // Get exercise title
  const getExerciseTitle = useCallback(() => {
    switch (exerciseType) {
      case 'deadlift':
        return 'Deadlift';
      case 'bench':
        return 'Bench Press';
      case 'squat':
        return 'Squat';
      default:
        return 'Exercise';
    }
  }, [exerciseType]);
  
  // Function to show score info
  const showScoreInfo = useCallback((scoreType: string) => {
    let title = '';
    let description = '';
    
    switch (scoreType) {
      case 'knee_alignment':
        title = 'Knee Alignment';
        description = exerciseType === 'deadlift' 
          ? 'Measures knee angle at the bottom position (should be 110-130°) and tracks lateral knee movement. Deductions are applied for knee angles outside the optimal range, lateral movement (valgus/varus), and asymmetry between left and right knees.'
          : exerciseType === 'squat'
          ? 'Evaluates if knees track over toes without excessive inward/outward movement and measures knee angle at the bottom (should be 90-110°). Deductions are applied for knee angles outside the optimal range, lateral movement, and asymmetry.'
          : 'Tracks stability of leg position during the press. Less emphasis on knees for bench press, but still monitors for proper foot placement and leg drive.';
        break;
        
      case 'spine_alignment':
        title = 'Spine Alignment';
        description = exerciseType === 'deadlift'
          ? 'Measures lumbar curve and tracks excessive rounding or hyperextension. Deductions are applied for excessive lumbar flexion (rounding), hyperextension of spine, lateral flexion (side bending), and inconsistent spine position.'
          : exerciseType === 'squat'
          ? 'Evaluates torso angle and spine curvature throughout the movement. Deductions are applied for excessive forward lean, lumbar flexion, lateral flexion, and inconsistent spine position.'
          : 'Tracks arching of the back and stability of the torso during the press. Evaluates proper arch without excessive hyperextension and stability throughout the movement.';
        break;
        
      case 'hip_stability':
        title = 'Hip Stability';
        description = exerciseType === 'deadlift'
          ? 'Tracks hip height at starting position, hip hinge pattern, and symmetry. Deductions are applied for asymmetrical hip position, excessive hip rotation, improper hip height at start position, and hip shift during movement.'
          : exerciseType === 'squat'
          ? 'Measures hip rotation, depth, and symmetry during descent and ascent. Deductions are applied for asymmetrical hip position, excessive hip rotation, and hip shift during movement.'
          : 'Evaluates hip position on bench and stability throughout the press. Monitors for excessive movement or shifting during the press.';
        break;
        
      case 'bar_path_efficiency':
        title = 'Bar Path Efficiency';
        description = exerciseType === 'deadlift'
          ? 'Tracks vertical bar path with minimal horizontal deviation. Deductions are applied for horizontal deviation from ideal path, inconsistent bar path between reps, bar path instability (wobbling), and improper bar position relative to body.'
          : exerciseType === 'squat'
          ? 'Measures bar path relative to mid-foot and evaluates consistency. Deductions are applied for horizontal deviation, inconsistent bar path, and bar path instability.'
          : 'Tracks bar path from rack to chest and back, evaluating straightness and consistency. For bench press, this is the most heavily weighted component (50% of overall score).';
        break;
        
      default:
        title = 'Score Information';
        description = 'This score evaluates your form based on biomechanical analysis of your movement patterns.';
    }
    
    setActiveScoreInfo({ title, description });
    setInfoModalVisible(true);
  }, [exerciseType]);
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={fitnessTheme.primary} />
          <Text style={styles.loadingText}>Analyzing your form...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* No Barbell Warning Banner */}
        {noBarbellDetected && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={24} color={fitnessTheme.text} />
            <Text style={styles.warningText}>
              No barbell was detected in this analysis. Results may not be accurate.
            </Text>
          </View>
        )}
        
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Analysis Results</Text>
          
          {scores && scores.overall !== undefined && (
            <View style={styles.overallScoreContainer}>
              <Text style={styles.overallScore}>
                {scores.overall !== undefined && scores.overall !== null ? scores.overall.toFixed(1) : '0.0'}
              </Text>
              <Text style={styles.overallScoreLabel}>/100</Text>
            </View>
          )}
        </View>
        
        {/* Video Analysis */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Video Analysis</Text>
          
          <View style={[styles.videoContainer, { height: videoHeight }]}>
            {videoError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color={fitnessTheme.error} />
                <Text style={styles.errorText}>
                  {params.isRealTimeAnalysis === 'true' 
                    ? 'No Video Available' 
                    : 'Failed to load video'}
                </Text>
                <Text style={styles.errorSubtext}>
                  {params.isRealTimeAnalysis === 'true'
                    ? 'Real-time analyses don\'t save video recordings.'
                    : 'The video format may not be supported by your device.'}
                </Text>
                {params.isRealTimeAnalysis !== 'true' && (
                  <TouchableOpacity 
                    style={styles.retryButton} 
                    onPress={() => {
                      setVideoError(false);
                      setLoadingVideo(true);
                      // Force refresh by setting videoUrl to null then back
                      setVideoUrl(null);
                      setTimeout(() => {
                        if (params.videoUrl) {
                          setVideoUrl(params.videoUrl);
                        }
                      }, 500);
                    }}
                  >
                    <Text style={styles.retryText}>Try Again</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : videoUrl ? (
              <WebView
                source={{
                  html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
                      <style>
                        body, html { 
                          margin: 0; 
                          padding: 0; 
                          height: 100%; 
                          background: ${fitnessTheme.background}; 
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          overflow: hidden;
                        }
                        .video-container {
                          width: 100%;
                          height: 100%;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          position: relative;
                        }
                        video { 
                          max-width: 100%;
                          max-height: 100%;
                          object-fit: contain;
                          background: transparent;
                          transition: transform 0.3s ease;
                        }
                        /* Handle video rotation based on orientation */
                        .rotate-90 {
                          transform: rotate(90deg);
                          transform-origin: center center;
                          width: 100vh;
                          height: 100vw;
                          position: absolute;
                          top: 50%;
                          left: 50%;
                          margin-top: -50vw;
                          margin-left: -50vh;
                        }
                        .rotate-180 {
                          transform: rotate(180deg);
                          transform-origin: center center;
                        }
                        .rotate-270 {
                          transform: rotate(270deg);
                          transform-origin: center center;
                          width: 100vh;
                          height: 100vw;
                          position: absolute;
                          top: 50%;
                          left: 50%;
                          margin-top: -50vw;
                          margin-left: -50vh;
                        }
                        /* Specific handling for mobile orientations */
                        @media screen and (orientation: portrait) {
                          .rotate-90, .rotate-270 {
                            width: 100vh;
                            height: 100vw;
                            max-width: none;
                            max-height: none;
                          }
                        }
                        @media screen and (orientation: landscape) {
                          .rotate-90, .rotate-270 {
                            width: 100vw;
                            height: 100vh;
                            max-width: none;
                            max-height: none;
                          }
                        }
                        /* Ensure rotated videos don't overflow */
                        .video-container:has(.rotate-90),
                        .video-container:has(.rotate-270) {
                          overflow: hidden;
                        }
                      </style>
                    </head>
                    <body>
                      <div class="video-container">
                        <video 
                          id="mainVideo"
                          controls 
                          autoplay 
                          playsinline 
                          src="${videoUrl}"
                          onloadedmetadata="handleVideoMetadata()"
                        ></video>
                      </div>
                      
                      <script>
                        function detectDeviceType() {
                          const userAgent = navigator.userAgent.toLowerCase();
                          const isOppo = userAgent.includes('oppo') || userAgent.includes('realme') || userAgent.includes('oneplus');
                          const isSamsung = userAgent.includes('samsung') || userAgent.includes('sm-');
                          const isXiaomi = userAgent.includes('xiaomi') || userAgent.includes('mi ');
                          const isHuawei = userAgent.includes('huawei') || userAgent.includes('honor');
                          
                          return { isOppo, isSamsung, isXiaomi, isHuawei };
                        }

                        function analyzeVideoCharacteristics(video) {
                          const videoWidth = video.videoWidth;
                          const videoHeight = video.videoHeight;
                          const aspectRatio = videoWidth / videoHeight;
                          
                          // Common mobile video recording aspect ratios
                          const is16by9 = Math.abs(aspectRatio - (16/9)) < 0.1;
                          const is4by3 = Math.abs(aspectRatio - (4/3)) < 0.1;
                          const is9by16 = Math.abs(aspectRatio - (9/16)) < 0.1;
                          const is3by4 = Math.abs(aspectRatio - (3/4)) < 0.1;
                          
                          return {
                            width: videoWidth,
                            height: videoHeight,
                            aspectRatio,
                            is16by9,
                            is4by3,
                            is9by16,
                            is3by4,
                            isLandscapeRatio: aspectRatio > 1.2,
                            isPortraitRatio: aspectRatio < 0.8,
                            isSquareish: aspectRatio >= 0.8 && aspectRatio <= 1.2
                          };
                        }

                        function handleVideoMetadata() {
                          const video = document.getElementById('mainVideo');
                          const container = document.querySelector('.video-container');
                          
                          if (!video.videoWidth || !video.videoHeight) {
                            return; // Video not ready yet
                          }
                          
                          const deviceInfo = detectDeviceType();
                          const videoChar = analyzeVideoCharacteristics(video);
                          
                          // Get screen orientation
                          const screenWidth = window.innerWidth;
                          const screenHeight = window.innerHeight;
                          const isScreenPortrait = screenHeight > screenWidth;
                          
                          console.log('=== Video Orientation Analysis ===');
                          console.log('Device type:', deviceInfo);
                          console.log('Video characteristics:', videoChar);
                          console.log('Screen dimensions:', screenWidth, 'x', screenHeight);
                          console.log('Screen is portrait:', isScreenPortrait);
                          
                          // Reset any previous transformations
                          video.className = '';
                          container.className = 'video-container';
                          
                          let rotationApplied = false;
                          
                          // Enhanced logic with device-specific handling
                          if (isScreenPortrait) {
                            // Portrait screen orientation
                            
                            if (videoChar.isLandscapeRatio) {
                              // Landscape video on portrait screen
                              if (deviceInfo.isSamsung) {
                                // Samsung devices often need different handling
                                if (videoChar.is16by9 && videoChar.width > videoChar.height) {
                                  console.log('Samsung: Rotating landscape video 90° for portrait screen');
                                  video.classList.add('rotate-90');
                                  rotationApplied = true;
                                }
                              } else if (deviceInfo.isOppo) {
                                // Oppo devices usually handle orientation better
                                if (videoChar.aspectRatio >= 1.5) {
                                  console.log('Oppo: Rotating wide landscape video 90° for portrait screen');
                                  video.classList.add('rotate-90');
                                  rotationApplied = true;
                                }
                              } else {
                                // Generic handling for other devices
                                if (videoChar.aspectRatio >= 1.33) {
                                  console.log('Generic: Rotating landscape video 90° for portrait screen');
                                  video.classList.add('rotate-90');
                                  rotationApplied = true;
                                }
                              }
                            } else if (videoChar.isPortraitRatio) {
                              // Portrait video on portrait screen
                              
                              if (deviceInfo.isSamsung) {
                                // Samsung portrait videos sometimes appear rotated
                                // Check if it's actually a rotated landscape video
                                if (videoChar.is9by16 && videoChar.height > videoChar.width) {
                                  // This looks like a proper portrait video
                                  console.log('Samsung: Portrait video appears correct, no rotation');
                                } else if (videoChar.aspectRatio > 0.5 && videoChar.aspectRatio < 0.8) {
                                  // Suspicious aspect ratio that might be rotated landscape
                                  console.log('Samsung: Suspicious portrait aspect ratio, might need 90° rotation');
                                  video.classList.add('rotate-90');
                                  rotationApplied = true;
                                }
                              } else {
                                // For other devices, trust portrait videos
                                console.log('Portrait video on portrait screen - keeping as is');
                              }
                            }
                            
                          } else {
                            // Landscape screen orientation
                            
                            if (videoChar.isPortraitRatio) {
                              // Portrait video on landscape screen - usually keep as is
                              console.log('Portrait video on landscape screen - no rotation needed');
                              
                            } else if (videoChar.isLandscapeRatio) {
                              // Landscape video on landscape screen
                              
                              // Check device orientation angle for potential upside-down issues
                              const orientation = screen.orientation ? screen.orientation.angle : window.orientation;
                              console.log('Device orientation angle:', orientation);
                              
                              if (orientation === 180 || orientation === -180) {
                                console.log('Device upside down - applying 180° rotation');
                                video.classList.add('rotate-180');
                                rotationApplied = true;
                              } else if ((orientation === -90 || orientation === 270) && deviceInfo.isSamsung) {
                                // Samsung devices sometimes have issues with right-side landscape
                                console.log('Samsung right-side landscape - checking if 180° rotation needed');
                                video.classList.add('rotate-180');
                                rotationApplied = true;
                              }
                            }
                          }
                          
                          console.log('Rotation applied:', rotationApplied);
                          console.log('Final video class:', video.className);
                          console.log('=== Analysis Complete ===');
                        }
                        
                        // Fallback mechanism - detect if applied rotation looks wrong
                        function validateRotation() {
                          const video = document.getElementById('mainVideo');
                          
                          setTimeout(() => {
                            if (!video.videoWidth || !video.videoHeight) return;
                            
                            const videoChar = analyzeVideoCharacteristics(video);
                            const isScreenPortrait = window.innerHeight > window.innerWidth;
                            const currentRotation = video.className;
                            
                            console.log('=== Rotation Validation ===');
                            console.log('Current rotation class:', currentRotation);
                            console.log('Video fits screen well:', checkVideoFit(video));
                            
                            // If video appears too small or oddly positioned, try different rotation
                            if (!checkVideoFit(video)) {
                              console.log('Video fit is poor, trying alternative rotation...');
                              
                              if (currentRotation === 'rotate-90') {
                                video.className = 'rotate-270';
                                console.log('Switched from 90° to 270°');
                              } else if (currentRotation === 'rotate-270') {
                                video.className = 'rotate-90';
                                console.log('Switched from 270° to 90°');
                              } else if (currentRotation === '') {
                                // Try 180° rotation if no rotation was applied
                                video.className = 'rotate-180';
                                console.log('Applied 180° as fallback');
                              }
                            }
                          }, 1000); // Wait 1 second for video to settle
                        }
                        
                        function checkVideoFit(video) {
                          // Simple heuristic to check if video appears well-fitted
                          const rect = video.getBoundingClientRect();
                          const screenWidth = window.innerWidth;
                          const screenHeight = window.innerHeight;
                          
                          // Check if video is using reasonable amount of screen space
                          const widthRatio = rect.width / screenWidth;
                          const heightRatio = rect.height / screenHeight;
                          
                          // Video should use at least 40% of available space in at least one dimension
                          const isReasonablyFilled = widthRatio > 0.4 || heightRatio > 0.4;
                          
                          // Video shouldn't be tiny (less than 20% in both dimensions)
                          const notTooSmall = widthRatio > 0.2 && heightRatio > 0.2;
                          
                          console.log('Video fit check - Width ratio:', widthRatio.toFixed(2), 'Height ratio:', heightRatio.toFixed(2));
                          
                          return isReasonablyFilled && notTooSmall;
                        }

                        // Handle orientation changes
                        window.addEventListener('orientationchange', function() {
                          setTimeout(() => {
                            handleVideoMetadata();
                            validateRotation();
                          }, 500);
                        });

                        // Handle window resize
                        window.addEventListener('resize', function() {
                          setTimeout(() => {
                            handleVideoMetadata();
                            validateRotation();
                          }, 300);
                        });

                        // Error handling
                        document.getElementById('mainVideo').addEventListener('error', function(e) {
                          console.error('Video loading error:', e);
                          document.body.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">Failed to load video</div>';
                        });

                        // Enhanced event listeners
                        document.getElementById('mainVideo').addEventListener('loadeddata', () => {
                          handleVideoMetadata();
                          validateRotation();
                        });
                        
                        document.getElementById('mainVideo').addEventListener('canplay', () => {
                          handleVideoMetadata();
                          validateRotation();
                        });

                        // Final validation after video starts playing
                        document.getElementById('mainVideo').addEventListener('timeupdate', function() {
                          if (this.currentTime > 0.5 && this.currentTime < 1.0) {
                            // Final check during early playback
                            setTimeout(() => {
                              if (!checkVideoFit(this)) {
                                console.log('Final validation: Video fit is still poor');
                                // Could implement additional fallback logic here
                              } else {
                                console.log('Final validation: Video orientation appears correct');
                              }
                            }, 200);
                          }
                        });
                      </script>
                    </body>
                    </html>
                  `
                }}
                style={styles.webView}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                originWhitelist={['*']}
                domStorageEnabled={true}
                onMessage={(event) => {
                  // Handle messages from WebView for debugging
                  console.log('WebView message:', event.nativeEvent.data);
                }}
              />
            ) : null}
          </View>
        </View>
        
        {/* Radar Chart */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Form Analysis</Text>
          
          <View style={styles.radarChartContainer}>
            {(loadingChart || !radarChartUrl) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00FF88" />
                <Text style={styles.loadingText}>Loading analysis...</Text>
              </View>
            )}
            
            {radarChartUrl && (
              <Image
                source={{ uri: radarChartUrl }}
                style={styles.radarChart}
                onLoad={() => setLoadingChart(false)}
                onError={() => setLoadingChart(false)}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
        
        {/* Exercise Information */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Exercise Information</Text>
          
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Exercise Type:</Text>
              <Text style={styles.infoValue}>{getExerciseTitle()}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Body Weight:</Text>
              <Text style={styles.infoValue}>{bodyWeight} kg</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Weight Used:</Text>
              <Text style={styles.infoValue}>{weightUsed} kg</Text>
            </View>
          </View>
        </View>
        
        {/* Detailed Scores */}
        {scores && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Detailed Scores</Text>
            
            <View style={styles.scoresContainer}>
              {scores.knee_alignment !== undefined && (
                <View style={styles.scoreItem}>
                  <View style={styles.scoreLabelContainer}>
                    <Text style={styles.scoreLabel}>Knee Alignment</Text>
                    <TouchableOpacity 
                      style={styles.infoButton}
                      onPress={() => showScoreInfo('knee_alignment')}
                    >
                      <Ionicons name="information-circle-outline" size={18} color={fitnessTheme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.scoreValueContainer}>
                    <Text style={[styles.scoreValue, { color: getScoreColor(scores.knee_alignment) }]}>
                      {scores.knee_alignment !== null ? scores.knee_alignment.toFixed(1) : '0.0'}/100
                    </Text>
                  </View>
                </View>
              )}
              
              {scores.spine_alignment !== undefined && (
                <View style={styles.scoreItem}>
                  <View style={styles.scoreLabelContainer}>
                    <Text style={styles.scoreLabel}>Spine Alignment</Text>
                    <TouchableOpacity 
                      style={styles.infoButton}
                      onPress={() => showScoreInfo('spine_alignment')}
                    >
                      <Ionicons name="information-circle-outline" size={18} color={fitnessTheme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.scoreValueContainer}>
                    <Text style={[styles.scoreValue, { color: getScoreColor(scores.spine_alignment) }]}>
                      {scores.spine_alignment !== null ? scores.spine_alignment.toFixed(1) : '0.0'}/100
                    </Text>
                  </View>
                </View>
              )}
              
              {scores.hip_stability !== undefined && (
                <View style={styles.scoreItem}>
                  <View style={styles.scoreLabelContainer}>
                    <Text style={styles.scoreLabel}>Hip Stability</Text>
                    <TouchableOpacity 
                      style={styles.infoButton}
                      onPress={() => showScoreInfo('hip_stability')}
                    >
                      <Ionicons name="information-circle-outline" size={18} color={fitnessTheme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.scoreValueContainer}>
                    <Text style={[styles.scoreValue, { color: getScoreColor(scores.hip_stability) }]}>
                      {scores.hip_stability !== null ? scores.hip_stability.toFixed(1) : '0.0'}/100
                    </Text>
                  </View>
                </View>
              )}
              
              {scores.bar_path_efficiency !== undefined && (
                <View style={styles.scoreItem}>
                  <View style={styles.scoreLabelContainer}>
                    <Text style={styles.scoreLabel}>Bar Path Efficiency</Text>
                    <TouchableOpacity 
                      style={styles.infoButton}
                      onPress={() => showScoreInfo('bar_path_efficiency')}
                    >
                      <Ionicons name="information-circle-outline" size={18} color={fitnessTheme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.scoreValueContainer}>
                    <Text style={[styles.scoreValue, { color: getScoreColor(scores.bar_path_efficiency) }]}>
                      {scores.bar_path_efficiency !== null ? scores.bar_path_efficiency.toFixed(1) : '0.0'}/100
                    </Text>
                  </View>
                </View>
              )}
              
              {scores.form !== undefined && (
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreLabel}>Form</Text>
                  <View style={styles.scoreValueContainer}>
                    <Text style={[styles.scoreValue, { color: getScoreColor(scores.form) }]}>
                      {scores.form !== null ? scores.form.toFixed(1) : '0.0'}/100
                    </Text>
                  </View>
                </View>
              )}
              
              {scores.stability !== undefined && (
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreLabel}>Stability</Text>
                  <View style={styles.scoreValueContainer}>
                    <Text style={[styles.scoreValue, { color: getScoreColor(scores.stability) }]}>
                      {scores.stability !== null ? scores.stability.toFixed(1) : '0.0'}/100
                    </Text>
                  </View>
                </View>
              )}
              
              {scores.range_of_motion !== undefined && (
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreLabel}>Range of Motion</Text>
                  <View style={styles.scoreValueContainer}>
                    <Text style={[styles.scoreValue, { color: getScoreColor(scores.range_of_motion) }]}>
                      {scores.range_of_motion !== null ? scores.range_of_motion.toFixed(1) : '0.0'}/100
                    </Text>
                  </View>
                </View>
              )}
              
              {scores.tempo !== undefined && (
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreLabel}>Tempo</Text>
                  <View style={styles.scoreValueContainer}>
                    <Text style={[styles.scoreValue, { color: getScoreColor(scores.tempo) }]}>
                      {scores.tempo !== null ? scores.tempo.toFixed(1) : '0.0'}/100
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* Improvement Tips */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Form Improvement Tips</Text>
          
          <View style={styles.tipsContainer}>
            {feedback.length > 0 ? (
              feedback.map((tip, index) => (
                <View key={index} style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={20} color={fitnessTheme.primary} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))
            ) : (
              <View style={styles.tipItem}>
                <Ionicons name="information-circle" size={20} color={fitnessTheme.accent} />
                <Text style={styles.tipText}>
                  Great job! Keep practicing to improve your form and technique.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Enhanced MCSVM Form Classification Feedback */}
        {mcsvmAnalysis && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Form Classification</Text>
            
            <View style={styles.mcsvmContainer}>
              {/* Classification with enhanced visual indicators */}
              <View style={styles.classificationRow}>
                <Text style={styles.classificationLabel}>Detected Form:</Text>
                <View style={styles.classificationContainer}>
                  <View style={[styles.classificationBadge, {
                    backgroundColor: mcsvmAnalysis.classification === 'Good' ? '#4CAF50' :
                                   mcsvmAnalysis.classification === 'Needs Improvement' ? '#FF9800' :
                                   mcsvmAnalysis.classification === 'Poor' ? '#F44336' :
                                   fitnessTheme.primary
                  }]}>
                    <Ionicons 
                      name={mcsvmAnalysis.classification === 'Good' ? 'checkmark-circle' :
                            mcsvmAnalysis.classification === 'Needs Improvement' ? 'warning' :
                            mcsvmAnalysis.classification === 'Poor' ? 'close-circle' :
                            'help-circle'} 
                      size={16} 
                      color="white" 
                    />
                    <Text style={styles.classificationBadgeText}>
                      {mcsvmAnalysis.classification}
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Confidence with progress bar */}
              <View style={styles.classificationRow}>
                <Text style={styles.classificationLabel}>Confidence:</Text>
                <View style={styles.confidenceContainer}>
                  <Text style={styles.classificationValue}>
                    {(mcsvmAnalysis.confidence * 100).toFixed(1)}%
                  </Text>
                  <View style={styles.confidenceBar}>
                    <View style={[styles.confidenceBarFill, {
                      width: `${mcsvmAnalysis.confidence * 100}%`,
                      backgroundColor: mcsvmAnalysis.confidence > 0.8 ? '#4CAF50' :
                                     mcsvmAnalysis.confidence > 0.6 ? '#FF9800' :
                                     '#F44336'
                    }]} />
                  </View>
                </View>
              </View>

              {/* Probability Distribution */}
              {mcsvmAnalysis.probabilities && (
                <View style={styles.probabilitySection}>
                  <Text style={styles.probabilityTitle}>Classification Probabilities:</Text>
                  {Object.entries(mcsvmAnalysis.probabilities).map(([form, probability]) => (
                    <View key={form} style={styles.probabilityRow}>
                      <Text style={styles.probabilityLabel}>{form}:</Text>
                      <View style={styles.probabilityBarContainer}>
                        <View style={styles.probabilityBar}>
                          <View style={[styles.probabilityBarFill, {
                            width: `${(probability as number) * 100}%`,
                            backgroundColor: form === 'Good' ? '#4CAF50' :
                                           form === 'Needs Improvement' ? '#FF9800' :
                                           '#F44336'
                          }]} />
                        </View>
                        <Text style={styles.probabilityValue}>
                          {((probability as number) * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Enhanced Feedback Section */}
              {!feedbackSubmitted && (
                <View style={styles.feedbackSection}>
                  <View style={styles.feedbackHeader}>
                    <Ionicons name="thumbs-up" size={20} color={fitnessTheme.accent} />
                    <Text style={styles.feedbackQuestion}>
                      Was this classification correct?
                    </Text>
                  </View>
                  <Text style={styles.feedbackSubtext}>
                    Your feedback helps improve our form analysis system
                  </Text>
                  
                  <View style={styles.feedbackButtons}>
                    <TouchableOpacity
                      style={[styles.feedbackButton, styles.correctButton, submittingFeedback && styles.disabledButton]}
                      onPress={() => submitMcsvmFeedback(true)}
                      disabled={submittingFeedback}
                    >
                      {submittingFeedback ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={20} color="white" />
                          <Text style={styles.feedbackButtonText}>Yes, Correct</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.feedbackButton, styles.incorrectButton, submittingFeedback && styles.disabledButton]}
                      onPress={() => submitMcsvmFeedback(false)}
                      disabled={submittingFeedback}
                    >
                      <Ionicons name="close" size={20} color="white" />
                      <Text style={styles.feedbackButtonText}>No, Incorrect</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Enhanced Thank You Message */}
              {feedbackSubmitted && (
                <View style={styles.thankYouContainer}>
                  <View style={styles.thankYouHeader}>
                    <Ionicons name="heart" size={24} color={fitnessTheme.primary} />
                    <Text style={styles.thankYouTitle}>Thank you!</Text>
                  </View>
                  <Text style={styles.thankYouText}>
                    Your feedback helps improve our form analysis system for everyone.
                  </Text>
                  <View style={styles.feedbackStats}>
                    <Ionicons name="trending-up" size={16} color={fitnessTheme.accent} />
                    <Text style={styles.feedbackStatsText}>
                      Contributing to better form analysis
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
      
      {/* Bottom Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleRetry}
        >
          <Ionicons name="refresh" size={20} color={fitnessTheme.text} />
          <Text style={styles.actionButtonText}>Try Again</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={shareResults}
        >
          <Ionicons name="share-social" size={20} color={fitnessTheme.text} />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={goToHome}
        >
          <Ionicons name="home" size={20} color={fitnessTheme.text} />
          <Text style={styles.actionButtonText}>Home</Text>
        </TouchableOpacity>
      </View>
      
      {/* Tab Bar */}
      <TabBar />
      
      {/* Add the information modal */}
      <Modal
        visible={infoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeScoreInfo.title}</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setInfoModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={fitnessTheme.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>{activeScoreInfo.description}</Text>
            
            <View style={styles.weightInfoContainer}>
              <Text style={styles.weightInfoTitle}>Score Weight in Overall Score:</Text>
              <View style={styles.weightItem}>
                <Text style={styles.weightLabel}>Deadlift:</Text>
                <Text style={styles.weightValue}>
                  {activeScoreInfo.title === 'Knee Alignment' ? '20%' : 
                   activeScoreInfo.title === 'Spine Alignment' ? '35%' : 
                   activeScoreInfo.title === 'Hip Stability' ? '25%' : 
                   activeScoreInfo.title === 'Bar Path Efficiency' ? '20%' : ''}
                </Text>
              </View>
              <View style={styles.weightItem}>
                <Text style={styles.weightLabel}>Squat:</Text>
                <Text style={styles.weightValue}>
                  {activeScoreInfo.title === 'Knee Alignment' ? '30%' : 
                   activeScoreInfo.title === 'Spine Alignment' ? '25%' : 
                   activeScoreInfo.title === 'Hip Stability' ? '25%' : 
                   activeScoreInfo.title === 'Bar Path Efficiency' ? '20%' : ''}
                </Text>
              </View>
              <View style={styles.weightItem}>
                <Text style={styles.weightLabel}>Bench Press:</Text>
                <Text style={styles.weightValue}>
                  {activeScoreInfo.title === 'Knee Alignment' ? '10%' : 
                   activeScoreInfo.title === 'Spine Alignment' ? '20%' : 
                   activeScoreInfo.title === 'Hip Stability' ? '20%' : 
                   activeScoreInfo.title === 'Bar Path Efficiency' ? '50%' : ''}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: fitnessTheme.background,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 120, // Extra padding for the bottom action buttons
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: fitnessTheme.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: fitnessTheme.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  overallScoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  overallScore: {
    color: fitnessTheme.primary,
    fontSize: 36,
    fontWeight: 'bold',
  },
  overallScoreLabel: {
    color: fitnessTheme.textSecondary,
    fontSize: 16,
    marginLeft: 4,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: fitnessTheme.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  videoContainer: {
    backgroundColor: fitnessTheme.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: fitnessTheme.surface,
    padding: 20,
  },
  errorText: {
    color: fitnessTheme.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    color: fitnessTheme.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: fitnessTheme.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: fitnessTheme.text,
    fontWeight: 'bold',
  },
  radarChartContainer: {
    width: '100%',
    height: 300,
    backgroundColor: fitnessTheme.surface,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarChart: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    backgroundColor: fitnessTheme.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    color: fitnessTheme.textMuted,
    fontSize: 16,
  },
  infoValue: {
    color: fitnessTheme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoresContainer: {
    backgroundColor: fitnessTheme.surface,
    borderRadius: 12,
    padding: 16,
  },
  scoreItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreLabel: {
    color: fitnessTheme.text,
    fontSize: 16,
  },
  scoreValueContainer: {
    backgroundColor: fitnessTheme.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scoreValue: {
    color: fitnessTheme.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  tipsContainer: {
    backgroundColor: fitnessTheme.surface,
    borderRadius: 8,
    padding: 16,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  tipText: {
    color: fitnessTheme.text,
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 60, // Position above the tab bar
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: fitnessTheme.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: fitnessTheme.border,
    zIndex: 10, // Ensure it's above the tab bar
    elevation: 10, // For Android
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: fitnessTheme.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: fitnessTheme.text,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  warningBanner: {
    backgroundColor: fitnessTheme.error,
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningText: {
    color: fitnessTheme.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: fitnessTheme.background,
    padding: 20,
    borderRadius: 12,
    width: '80%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: fitnessTheme.text,
  },
  closeButton: {
    padding: 8,
  },
  modalDescription: {
    color: fitnessTheme.text,
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  weightInfoContainer: {
    marginBottom: 20,
  },
  weightInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: fitnessTheme.text,
    marginBottom: 8,
  },
  weightItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weightLabel: {
    color: fitnessTheme.textMuted,
    fontSize: 14,
  },
  weightValue: {
    color: fitnessTheme.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeModalButton: {
    backgroundColor: fitnessTheme.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoButton: {
    padding: 8,
    marginLeft: 4,
  },
  mcsvmContainer: {
    backgroundColor: fitnessTheme.surface,
    borderRadius: 12,
    padding: 16,
  },
  classificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  classificationLabel: {
    color: fitnessTheme.textMuted,
    fontSize: 16,
  },
  classificationValue: {
    color: fitnessTheme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  recommendationsContainer: {
    backgroundColor: fitnessTheme.surfaceVariant,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  recommendationsTitle: {
    color: fitnessTheme.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationText: {
    color: fitnessTheme.text,
    fontSize: 14,
    marginLeft: 4,
  },
  feedbackSection: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: fitnessTheme.surfaceVariant,
  },
  feedbackQuestion: {
    color: fitnessTheme.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  feedbackSubtext: {
    color: fitnessTheme.textMuted,
    fontSize: 14,
    marginBottom: 12,
  },
  feedbackButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  correctButton: {
    backgroundColor: fitnessTheme.primary,
  },
  incorrectButton: {
    backgroundColor: fitnessTheme.error,
  },
  disabledButton: {
    opacity: 0.6,
  },
  feedbackButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  thankYouContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    backgroundColor: fitnessTheme.surfaceVariant,
    borderRadius: 8,
  },
  thankYouText: {
    color: fitnessTheme.text,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  // Enhanced classification styles
  classificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  classificationBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  confidenceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    flex: 1,
  },
  confidenceBar: {
    width: 100,
    height: 4,
    backgroundColor: fitnessTheme.surfaceVariant,
    borderRadius: 2,
    marginTop: 4,
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  thankYouHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  thankYouTitle: {
    color: fitnessTheme.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  feedbackStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: fitnessTheme.surfaceVariant,
  },
  feedbackStatsText: {
    color: fitnessTheme.textMuted,
    fontSize: 12,
    marginLeft: 6,
    fontStyle: 'italic',
  },
  // Probability distribution styles
  probabilitySection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: fitnessTheme.surfaceVariant,
    borderRadius: 8,
  },
  probabilityTitle: {
    color: fitnessTheme.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  probabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  probabilityLabel: {
    color: fitnessTheme.text,
    fontSize: 12,
    width: 80,
  },
  probabilityBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  probabilityBar: {
    flex: 1,
    height: 6,
    backgroundColor: fitnessTheme.surface,
    borderRadius: 3,
    marginRight: 8,
  },
  probabilityBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  probabilityValue: {
    color: fitnessTheme.text,
    fontSize: 12,
    width: 40,
    textAlign: 'right',
  },
});