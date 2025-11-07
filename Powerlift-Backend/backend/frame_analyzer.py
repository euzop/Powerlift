"""
Frame analyzer for real-time pose analysis.
"""

import cv2
import numpy as np
import os
import base64
import io
import time
import threading
from queue import Queue, Empty

from .detectors.pose_detector import PoseDetector
from .detectors.barbell_detector import BarbellDetector
from .analyzers.form_analyzer import FormAnalyzer
from .analyzers.integrated_form_analyzer import IntegratedFormAnalyzer
from .utils.visualization import draw_pose_with_feedback

# Target FPS for real-time analysis
TARGET_FPS = 5

class FrameAnalyzer:
    """
    Analyzes individual frames for real-time feedback.
    """
    
    def __init__(self, pose_model_path, barbell_model_path):
        """Initialize the frame analyzer with models"""
        self.pose_detector = PoseDetector(pose_model_path)
        
        # Initialize barbell detector only if model path is provided
        self.barbell_detector = None
        if barbell_model_path and os.path.exists(barbell_model_path):
            try:
                self.barbell_detector = BarbellDetector(barbell_model_path)
                print(f"  - Barbell detector initialized with model: {barbell_model_path}")
            except Exception as e:
                print(f"  - Failed to initialize barbell detector: {str(e)}")
        else:
            print("  - Barbell detector not initialized (model not provided or not found)")
            
        self.form_analyzer = FormAnalyzer()
        
        # Initialize MCSVM Form Classifier
        self.mcsvm_analyzer = None
        self.mcsvm_enabled = False
        self.exercise_type = "deadlift"  # Default exercise type
        
        # Try to load pre-trained MCSVM model
        mcsvm_model_path = "models/deadlift_form_classifier.pkl"
        if os.path.exists(mcsvm_model_path):
            try:
                self.mcsvm_analyzer = IntegratedFormAnalyzer(self.exercise_type)
                if self.mcsvm_analyzer.load_trained_model(mcsvm_model_path):
                    self.mcsvm_enabled = True
                    print(f"  - MCSVM form classifier loaded: {mcsvm_model_path}")
                else:
                    print(f"  - Failed to load MCSVM model: {mcsvm_model_path}")
            except Exception as e:
                print(f"  - MCSVM classifier initialization failed: {e}")
        else:
            print(f"  - MCSVM model not found: {mcsvm_model_path}")
        
        # Frame counter for form analysis
        self.frame_count = 0
        
        # Track barbell detection for statistics
        self.barbell_detected_frames = 0
        self.barbell_detection_rate = 0.0
        
        # Store recent frames for smoother analysis
        self.max_frame_history = 10
        self.frame_history = []
        
        # History of scores for smoothing
        self.score_history = []
        self.max_score_history = 5
        
        # Track FPS for optimization
        self.last_fps_check = time.time()
        self.frames_since_check = 0
        self.current_fps = 0
        
        # Processing queue and thread
        self.processing_queue = Queue(maxsize=10)
        self.is_processing = False
        self.processing_thread = None
        
        # Start the processing thread
        self._start_processing_thread()
    
    def reset(self):
        """Reset the analyzer state for a new session"""
        self.frame_count = 0
        self.barbell_detected_frames = 0
        self.barbell_detection_rate = 0.0
        self.frame_history = []
        self.score_history = []
        self.form_analyzer = FormAnalyzer()
        
        # Initialize MCSVM Form Classifier
        self.mcsvm_analyzer = None
        self.mcsvm_enabled = False
        self.exercise_type = "deadlift"  # Default exercise type
        
        # Try to load pre-trained MCSVM model
        mcsvm_model_path = "models/deadlift_form_classifier.pkl"
        if os.path.exists(mcsvm_model_path):
            try:
                self.mcsvm_analyzer = IntegratedFormAnalyzer(self.exercise_type)
                if self.mcsvm_analyzer.load_trained_model(mcsvm_model_path):
                    self.mcsvm_enabled = True
                    print(f"  - MCSVM form classifier loaded: {mcsvm_model_path}")
                else:
                    print(f"  - Failed to load MCSVM model: {mcsvm_model_path}")
            except Exception as e:
                print(f"  - MCSVM classifier initialization failed: {e}")
        else:
            print(f"  - MCSVM model not found: {mcsvm_model_path}")
        
        self.last_fps_check = time.time()
        self.frames_since_check = 0
        self.current_fps = 0
    
    def _start_processing_thread(self):
        """Start the background thread for processing frames"""
        if self.processing_thread is None or not self.processing_thread.is_alive():
            self.is_processing = True
            self.processing_thread = threading.Thread(target=self._processing_worker)
            self.processing_thread.daemon = True
            self.processing_thread.start()
    
    def _processing_worker(self):
        """Background worker that processes frames from the queue"""
        while self.is_processing:
            try:
                # Get frame from queue with timeout
                frame = self.processing_queue.get(timeout=1.0)
                
                # Process the frame
                self._process_frame(frame)
                
                # Mark task as done
                self.processing_queue.task_done()
                
            except Empty:
                # No frames in queue, just continue
                continue
            except Exception as e:
                print(f"Error in processing worker: {str(e)}")
                import traceback
                traceback.print_exc()
    
    def _process_frame(self, frame):
        """Process a single frame and update analysis results"""
        # Increment frame counter
        self.frame_count += 1
        
        # Track FPS
        self.frames_since_check += 1
        now = time.time()
        elapsed = now - self.last_fps_check
        if elapsed > 1.0:  # Update FPS every second
            self.current_fps = self.frames_since_check / elapsed
            self.last_fps_check = now
            self.frames_since_check = 0
            print(f"Current processing FPS: {self.current_fps:.1f}")
            
        # Create a working copy of the frame
        analysis_frame = frame.copy()
        
        # Store the original frame for visualization
        self.current_frame = frame.copy()
            
        # 1. Detect human pose keypoints
        keypoints_with_scores, _ = self.pose_detector.detect_pose(analysis_frame)
            
        # 2. Apply Kalman filtering to human pose keypoints
        smoothed_keypoints = self.pose_detector.smooth_keypoints(keypoints_with_scores, confidence_threshold=0.3)
            
        # 3. Detect barbell
        barbell_result = None
        barbell_keypoints = None
        barbell_detected = False
        
        if self.barbell_detector is not None:
            try:
                barbell_result = self.barbell_detector.detect_barbell(analysis_frame, conf_threshold=0.25)
                
                # Extract barbell keypoints for form analysis
                if barbell_result is not None:
                    barbell_keypoints = self.barbell_detector.extract_keypoints(barbell_result)
                    if barbell_keypoints is not None and len(barbell_keypoints) > 0:
                        barbell_detected = True
                        # Increment barbell detection counter
                        self.barbell_detected_frames += 1
            except Exception as e:
                print(f"Error detecting barbell: {str(e)}")
                # Try again with default parameters
                try:
                    barbell_result = self.barbell_detector.detect_barbell(analysis_frame)
                    if barbell_result is not None:
                        barbell_keypoints = self.barbell_detector.extract_keypoints(barbell_result)
                        if barbell_keypoints is not None and len(barbell_keypoints) > 0:
                            barbell_detected = True
                            self.barbell_detected_frames += 1
                except Exception as e2:
                    print(f"Second barbell detection attempt failed: {str(e2)}")
            
        # Update barbell detection rate
        if self.frame_count > 0:
            self.barbell_detection_rate = self.barbell_detected_frames / self.frame_count
            
        # 4. Form analysis
        pose_kp = np.squeeze(smoothed_keypoints)
        form_feedback = self.form_analyzer.analyze_frame(pose_kp, barbell_keypoints, self.frame_count)
        
        # 4.5. MCSVM Form Classification (if enabled)
        mcsvm_feedback = None
        if self.mcsvm_enabled and self.mcsvm_analyzer is not None:
            try:
                # Add current frame data to MCSVM analyzer
                barbell_bbox = None
                if barbell_result is not None and len(barbell_result) > 0:
                    # Convert barbell detection to bbox format [x1, y1, x2, y2]
                    bbox = barbell_result[0]  # First detection
                    barbell_bbox = np.array([bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2']])
                
                self.mcsvm_analyzer.add_frame_data(smoothed_keypoints, barbell_bbox)
                
                # Get form classification (every few frames to reduce computation)
                if self.frame_count % 5 == 0:  # Analyze every 5 frames
                    mcsvm_result = self.mcsvm_analyzer.analyze_current_movement()
                    if mcsvm_result is not None:
                        mcsvm_feedback = {
                            'classification': mcsvm_result['prediction'],
                            'confidence': mcsvm_result['confidence'],
                            'recommendations': mcsvm_result.get('recommendations', []),
                            'probabilities': mcsvm_result['probabilities'],
                            'features': mcsvm_result.get('features', [])  # Include features for feedback
                        }
                        
                        # Get real-time feedback for display
                        real_time_feedback = self.mcsvm_analyzer.get_real_time_feedback()
                        mcsvm_feedback['real_time'] = real_time_feedback
                        
            except Exception as e:
                print(f"MCSVM analysis error: {e}")
                mcsvm_feedback = None
            
        # Get current movement phase
        movement_phase = form_feedback.get('phase', 'unknown')
            
        # Calculate scores based on recent frames for more stability
        self.form_analyzer.calculate_final_scores(min(self.frame_count, self.max_frame_history))
            
        # Add the current scores to history for smoothing
        current_scores = self.form_analyzer.scores.copy()
        self.score_history.append(current_scores)
        if len(self.score_history) > self.max_score_history:
            self.score_history.pop(0)
            
        # Calculate smoothed scores
        smoothed_scores = self._calculate_smoothed_scores()
            
        # Add scores to form feedback for visualization
        if form_feedback is None:
            form_feedback = {}
        form_feedback['scores'] = smoothed_scores
            
        # 5. Draw visualizations on the frame
        visualized_frame = draw_pose_with_feedback(
            analysis_frame, 
            smoothed_keypoints, 
            confidence_threshold=0.3,  # Increased from 0.2 due to improved keypoint accuracy
            form_feedback=form_feedback, 
            pose_detector=self.pose_detector
        )
            
        # Draw barbell if detected
        if barbell_result is not None and self.barbell_detector is not None:
            visualized_frame = self.barbell_detector.draw_barbell(visualized_frame, barbell_result)
        
        # Add additional information to the frame
        cv2.putText(visualized_frame, f"FPS: {self.current_fps:.1f}", 
                   (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.putText(visualized_frame, f"Frame: {self.frame_count}", 
                   (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        
        if movement_phase != 'unknown':
            cv2.putText(visualized_frame, f"Phase: {movement_phase.upper()}", 
                  (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
            
        # Add rep count if available
        rep_count = getattr(self.form_analyzer, 'rep_count', 0)
        if rep_count > 0:
            cv2.putText(visualized_frame, f"Reps: {rep_count}", 
                  (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 165, 0), 2)
            
        # Convert visualized frame to base64 for sending via WebSocket
        _, buffer = cv2.imencode('.jpg', visualized_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        visualization_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Generate radar chart
        radar_chart_base64 = self.form_analyzer.generate_radar_chart(save_to_file=False)
            
        # Store the latest results
        self.latest_results = {
            'frame_count': self.frame_count,
            'scores': smoothed_scores,
            'errors': form_feedback.get('errors', []),
            'visualization': visualization_base64,
            'radar_chart': radar_chart_base64,
            'barbell_detected': barbell_detected,
            'phase': movement_phase,
            'rep_count': rep_count,
            'mcsvm_analysis': mcsvm_feedback,  # Add MCSVM classification results
            'mcsvm_enabled': self.mcsvm_enabled
        }
    
    def analyze_frame(self, frame):
        """
        Analyze a single frame and return results
        
        Args:
            frame: The frame to analyze
            
        Returns:
            dict with analysis results
        """
        # Add frame to processing queue if not full
        if not self.processing_queue.full():
            self.processing_queue.put(frame)
        
        # Return the latest results
        if hasattr(self, 'latest_results'):
            return self.latest_results
        else:
            # Return default results if no analysis has been done yet
            return {
                'frame_count': 0,
                'scores': {
                    'knee_alignment': 0,
                    'spine_alignment': 0,
                    'hip_stability': 0,
                    'bar_path_efficiency': 0,
                    'overall': 0
                },
                'errors': [],
                'visualization': None,
                'radar_chart': None,
                'barbell_detected': False,
                'phase': 'unknown',
                'rep_count': 0
            }
    
    def _calculate_smoothed_scores(self):
        """Calculate smoothed scores based on recent history"""
        if not self.score_history:
            return {
                'knee_alignment': 0,
                'spine_alignment': 0,
                'hip_stability': 0,
                'bar_path_efficiency': 0,
                'overall': 0
            }
        
        # Initialize with keys from the most recent score
        smoothed = {}
        for key in self.score_history[-1].keys():
            scores = [s.get(key, 0) for s in self.score_history]
            # Calculate weighted average (more recent scores have higher weight)
            weights = [i + 1 for i in range(len(scores))]
            smoothed[key] = sum(s * w for s, w in zip(scores, weights)) / sum(weights)
        
        return smoothed
    
    def _process_frame_sync(self, frame):
        """Process a frame synchronously for the first result"""
        start_time = time.time()
        
        # Increment frame counter
        self.frame_count += 1
        
        # Create a working copy of the frame
        analysis_frame = frame.copy()
        
        try:
            # 1. Detect human pose keypoints
            keypoints_with_scores, _ = self.pose_detector.detect_pose(analysis_frame)
            
            # 2. Apply Kalman filtering to human pose keypoints
            smoothed_keypoints = self.pose_detector.smooth_keypoints(keypoints_with_scores, confidence_threshold=0.3)
            
            # 3. Detect barbell
            barbell_result = None
            barbell_keypoints = None
            barbell_detected = False
            
            if self.barbell_detector is not None:
                try:
                    barbell_result = self.barbell_detector.detect_barbell(analysis_frame, conf_threshold=0.25)
                    
                    # Extract barbell keypoints for form analysis
                    if barbell_result is not None:
                        barbell_keypoints = self.barbell_detector.extract_keypoints(barbell_result)
                        if barbell_keypoints is not None and len(barbell_keypoints) > 0:
                            barbell_detected = True
                            # Increment barbell detection counter
                            self.barbell_detected_frames += 1
                    else:
                        print("No barbell detected")
                except Exception as e:
                    print(f"Error detecting barbell: {str(e)}")
            
            # Update barbell detection rate
            if self.frame_count > 0:
                self.barbell_detection_rate = self.barbell_detected_frames / self.frame_count
            
            # 4. Form analysis
            pose_kp = np.squeeze(smoothed_keypoints)
            form_feedback = self.form_analyzer.analyze_frame(pose_kp, barbell_keypoints, self.frame_count)
            
            # 4.5. MCSVM Form Classification (if enabled)
            mcsvm_feedback = None
            if self.mcsvm_enabled and self.mcsvm_analyzer is not None:
                try:
                    # Add current frame data to MCSVM analyzer
                    barbell_bbox = None
                    if barbell_result is not None and len(barbell_result) > 0:
                        # Convert barbell detection to bbox format [x1, y1, x2, y2]
                        bbox = barbell_result[0]  # First detection
                        barbell_bbox = np.array([bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2']])
                    
                    self.mcsvm_analyzer.add_frame_data(smoothed_keypoints, barbell_bbox)
                    
                    # Get form classification (every few frames to reduce computation)
                    if self.frame_count % 5 == 0:  # Analyze every 5 frames
                        mcsvm_result = self.mcsvm_analyzer.analyze_current_movement()
                        if mcsvm_result is not None:
                            mcsvm_feedback = {
                                'classification': mcsvm_result['prediction'],
                                'confidence': mcsvm_result['confidence'],
                                'recommendations': mcsvm_result.get('recommendations', []),
                                'probabilities': mcsvm_result['probabilities'],
                                'features': mcsvm_result.get('features', [])  # Include features for feedback
                            }
                            
                            # Get real-time feedback for display
                            real_time_feedback = self.mcsvm_analyzer.get_real_time_feedback()
                            mcsvm_feedback['real_time'] = real_time_feedback
                            
                except Exception as e:
                    print(f"MCSVM analysis error: {e}")
                    mcsvm_feedback = None
            
            # Calculate scores
            self.form_analyzer.calculate_final_scores(min(self.frame_count, self.max_frame_history))
            
            # Add the current scores to history for smoothing
            current_scores = self.form_analyzer.scores.copy()
            self.score_history.append(current_scores)
            if len(self.score_history) > self.max_score_history:
                self.score_history.pop(0)
            
            # Calculate smoothed scores
            smoothed_scores = self._calculate_smoothed_scores()
            
            # Add scores to form feedback for visualization
            if form_feedback is None:
                form_feedback = {}
            form_feedback['scores'] = smoothed_scores
            
            # 5. Draw visualizations on the frame
            visualized_frame = draw_pose_with_feedback(
                analysis_frame, 
                smoothed_keypoints, 
                confidence_threshold=0.3,  # Increased from 0.2 due to improved keypoint accuracy
                form_feedback=form_feedback, 
                pose_detector=self.pose_detector
            )
            
            # Draw barbell if detected
            if barbell_result is not None and self.barbell_detector is not None:
                visualized_frame = self.barbell_detector.draw_barbell(visualized_frame, barbell_result)
            
            # Convert visualized frame to base64 for sending via WebSocket
            _, buffer = cv2.imencode('.jpg', visualized_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            visualization_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Generate radar chart
            radar_chart_base64 = self.form_analyzer.generate_radar_chart(save_to_file=False)
            
            # Get movement phase and rep count
            movement_phase = form_feedback.get('phase', 'unknown')
            rep_count = getattr(self.form_analyzer, 'rep_count', 0)
            
            # Calculate processing time
            processing_time = time.time() - start_time
            
            # Return results
            return {
                'frame_count': self.frame_count,
                'scores': smoothed_scores,
                'errors': form_feedback.get('errors', []),
                'visualization': visualization_base64,
                'radar_chart': radar_chart_base64,
                'barbell_detected': barbell_detected,
                'phase': movement_phase,
                'rep_count': rep_count,
                'processing_time': processing_time
            }
            
        except Exception as e:
            print(f"Error processing frame synchronously: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'frame_count': self.frame_count,
                'error': str(e)
            }
        
    def finalize_analysis(self, exercise_type):
        """
        Finalize the analysis and return comprehensive results
        
        Args:
            exercise_type: Type of exercise being analyzed (deadlift, squat, bench)
            
        Returns:
            dict with final analysis results
        """
        # If we have no frames analyzed, return empty results
        if self.frame_count == 0 or not self.score_history:
            # Generate a basic visualization if no frames were processed
            try:
                # Create a blank image with text
                blank_image = np.zeros((480, 640, 3), np.uint8)
                cv2.putText(blank_image, "No frames processed", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 
                            1.5, (255, 255, 255), 2, cv2.LINE_AA)
                
                # Convert to base64
                _, buffer = cv2.imencode('.jpg', blank_image, [cv2.IMWRITE_JPEG_QUALITY, 90])
                mock_visualization = base64.b64encode(buffer).decode('utf-8')
                print(f"Generated mock visualization, length: {len(mock_visualization)}")
            except Exception as e:
                print(f"Error creating mock visualization: {str(e)}")
                import traceback
                traceback.print_exc()
                mock_visualization = None
                
            return {
                "scores": {
                    "knee_alignment": 0,
                    "spine_alignment": 0,
                    "hip_stability": 0,
                    "bar_path_efficiency": 0,
                    "overall": 0
                },
                "feedback": ["Not enough data for analysis"],
                "radar_chart_data": "",
                "barbell_detection_rate": 0.0,
                "rep_count": 0,
                "visualization": mock_visualization  # Include mock visualization
            }
        
        # Calculate final scores based on all analyzed frames
        final_scores = self._calculate_smoothed_scores()
        
        # Generate feedback based on final scores and exercise type
        feedback = self.form_analyzer.generate_exercise_specific_feedback(exercise_type)
        
        # Add feedback about barbell detection if rate is low
        if self.barbell_detection_rate < 0.3:  # Less than 30% of frames have barbell
            feedback.append("Barbell was not consistently detected. For better analysis, ensure the barbell is clearly visible.")
        
        # Generate radar chart with final scores
        self.form_analyzer.scores = final_scores
        radar_chart_data = self.form_analyzer.generate_radar_chart(save_to_file=False)
        
        # Get rep count if available
        rep_count = getattr(self.form_analyzer, 'rep_count', 0)
        
        # Stop the processing thread
        self.is_processing = False
        
        # Get the latest visualization if we have one
        latest_visualization = None
        if hasattr(self, 'latest_results') and self.latest_results and 'visualization' in self.latest_results:
            latest_visualization = self.latest_results['visualization']
        
        # Return final results
        return {
            "scores": final_scores,
            "feedback": feedback,
            "radar_chart_data": radar_chart_data,
            "barbell_detection_rate": self.barbell_detection_rate,
            "rep_count": rep_count,
            "visualization": latest_visualization  # Include the latest visualization
        }