"""
Integration module for MCSVM Form Classification with PowerLift system
Connects pose detection, Kalman filtering, and MCSVM classification
"""

from .mcsvm_form_classifier import PowerliftFormClassifier
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging

class IntegratedFormAnalyzer:
    """
    Integrated form analyzer that combines:
    1. Pose Detection (TensorFlow Lite)
    2. Kalman Filtering (smoothing)
    3. MCSVM Classification (form analysis)
    """
    
    def __init__(self, exercise_type: str = "deadlift"):
        self.exercise_type = exercise_type
        self.form_classifier = PowerliftFormClassifier(exercise_type)
        
        # Buffer for collecting keypoints over time
        self.keypoint_buffer = []
        self.barbell_buffer = []
        self.max_buffer_size = 100  # Frames to keep in buffer
        
        # Analysis parameters
        self.min_frames_for_analysis = 10
        self.analysis_window_size = 30  # Frames to analyze at once
        
        # Results tracking
        self.analysis_history = []
        
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
    
    def load_trained_model(self, model_path: str):
        """Load pre-trained MCSVM model"""
        try:
            self.form_classifier.load_model(model_path)
            self.logger.info(f"Loaded MCSVM model for {self.exercise_type}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to load model: {e}")
            return False
    
    def add_frame_data(self, keypoints_with_scores: np.ndarray, barbell_bbox: Optional[np.ndarray] = None):
        """
        Add new frame data to the analysis buffer
        
        Args:
            keypoints_with_scores: Shape (17, 3) - pose keypoints from current frame
            barbell_bbox: Shape (4,) - barbell bounding box [x1, y1, x2, y2]
        """
        # Add to buffers
        self.keypoint_buffer.append(keypoints_with_scores.copy())
        
        if barbell_bbox is not None:
            self.barbell_buffer.append(barbell_bbox.copy())
        
        # Maintain buffer size
        if len(self.keypoint_buffer) > self.max_buffer_size:
            self.keypoint_buffer.pop(0)
            if self.barbell_buffer:
                self.barbell_buffer.pop(0)
    
    def analyze_current_movement(self) -> Optional[Dict]:
        """
        Analyze the current movement in the buffer
        Returns form classification and recommendations
        """
        if len(self.keypoint_buffer) < self.min_frames_for_analysis:
            return None
        
        if not self.form_classifier.is_trained:
            self.logger.warning("MCSVM classifier not trained - skipping classification")
            return None
        
        # Get analysis window
        window_size = min(self.analysis_window_size, len(self.keypoint_buffer))
        keypoints_window = np.array(self.keypoint_buffer[-window_size:])
        
        barbell_window = None
        if self.barbell_buffer and len(self.barbell_buffer) >= window_size:
            barbell_window = np.array(self.barbell_buffer[-window_size:])
        
        # Run MCSVM classification
        try:
            classification_result = self.form_classifier.predict(keypoints_window, barbell_window)
            
            # Add frame context
            classification_result['frame_count'] = len(self.keypoint_buffer)
            classification_result['analysis_window'] = window_size
            classification_result['timestamp'] = len(self.analysis_history)
            
            # Store in history
            self.analysis_history.append(classification_result)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(classification_result)
            classification_result['recommendations'] = recommendations
            
            return classification_result
            
        except Exception as e:
            self.logger.error(f"Classification failed: {e}")
            return None
    
    def get_real_time_feedback(self) -> Dict:
        """
        Get real-time feedback based on recent movement patterns
        """
        if len(self.analysis_history) == 0:
            return {
                'status': 'collecting_data',
                'message': 'Collecting movement data...',
                'confidence': 0.0
            }
        
        # Get latest analysis
        latest_analysis = self.analysis_history[-1]
        
        # Determine feedback level based on confidence and prediction
        feedback = self._generate_real_time_feedback(latest_analysis)
        
        return feedback
    
    def get_movement_summary(self) -> Dict:
        """
        Get summary of movement quality over the entire session
        """
        if len(self.analysis_history) < 3:
            return {
                'status': 'insufficient_data',
                'message': 'Need more movement data for summary'
            }
        
        # Analyze trends in the session
        predictions = [analysis['prediction'] for analysis in self.analysis_history]
        confidences = [analysis['confidence'] for analysis in self.analysis_history]
        
        # Most common form issues
        form_issues = [pred for pred in predictions if pred != 'excellent_form']
        issue_counts = {}
        for issue in form_issues:
            issue_counts[issue] = issue_counts.get(issue, 0) + 1
        
        # Overall quality score
        excellent_count = predictions.count('excellent_form')
        quality_score = excellent_count / len(predictions)
        
        # Consistency score (based on confidence variations)
        consistency_score = 1.0 - np.std(confidences)
        
        return {
            'total_analyses': len(self.analysis_history),
            'quality_score': quality_score,
            'consistency_score': max(0.0, consistency_score),
            'common_issues': sorted(issue_counts.items(), key=lambda x: x[1], reverse=True)[:3],
            'average_confidence': np.mean(confidences),
            'improvement_trend': self._calculate_improvement_trend()
        }
    
    def _generate_recommendations(self, classification_result: Dict) -> List[str]:
        """Generate specific recommendations based on classification"""
        recommendations = []
        prediction = classification_result['prediction']
        probabilities = classification_result['probabilities']
        
        if prediction == 'excellent_form':
            recommendations.append("✅ Excellent form! Maintain this technique.")
            return recommendations
        
        # Specific recommendations for each form issue
        form_recommendations = {
            'rounded_back': [
                "🔴 Keep your chest up and shoulders back",
                "🔴 Engage your lats to maintain neutral spine", 
                "🔴 Consider reducing weight to focus on form"
            ],
            'knee_valgus': [
                "🔴 Push your knees out in line with your toes",
                "🔴 Strengthen your glutes and hip external rotators",
                "🔴 Focus on proper foot positioning"
            ],
            'forward_lean': [
                "🔴 Keep the weight centered over mid-foot",
                "🔴 Maintain upright torso throughout the lift",
                "🔴 Check your ankle mobility"
            ],
            'bar_drift': [
                "🔴 Keep the bar close to your body throughout the lift",
                "🔴 Engage your lats to control bar path",
                "🔴 Focus on pulling straight up"
            ],
            'uneven_hips': [
                "🔴 Check for mobility imbalances",
                "🔴 Ensure even weight distribution",
                "🔴 Consider unilateral exercises to address asymmetries"
            ]
        }
        
        # Add primary recommendation
        if prediction in form_recommendations:
            recommendations.extend(form_recommendations[prediction])
        
        # Add secondary recommendations for high-probability issues
        for issue, prob in probabilities.items():
            if issue != prediction and prob > 0.3 and issue in form_recommendations:
                recommendations.append(f"⚠️ Also watch for: {issue.replace('_', ' ')}")
        
        return recommendations[:4]  # Limit to top 4 recommendations
    
    def _generate_real_time_feedback(self, latest_analysis: Dict) -> Dict:
        """Generate real-time feedback for display"""
        prediction = latest_analysis['prediction']
        confidence = latest_analysis['confidence']
        
        if confidence < 0.5:
            return {
                'status': 'uncertain',
                'message': 'Move closer to camera for better analysis',
                'confidence': confidence,
                'color': 'yellow'
            }
        
        if prediction == 'excellent_form':
            return {
                'status': 'excellent',
                'message': '✅ Excellent Form!',
                'confidence': confidence,
                'color': 'green'
            }
        else:
            form_issue = prediction.replace('_', ' ').title()
            return {
                'status': 'needs_improvement',
                'message': f'🔴 {form_issue} Detected',
                'confidence': confidence,
                'color': 'red'
            }
    
    def _calculate_improvement_trend(self) -> str:
        """Calculate if form is improving, declining, or stable"""
        if len(self.analysis_history) < 5:
            return "insufficient_data"
        
        # Look at recent vs earlier analyses
        recent_analyses = self.analysis_history[-5:]
        earlier_analyses = self.analysis_history[-10:-5] if len(self.analysis_history) >= 10 else []
        
        if not earlier_analyses:
            return "insufficient_data"
        
        # Calculate quality scores
        recent_quality = sum(1 for a in recent_analyses if a['prediction'] == 'excellent_form') / len(recent_analyses)
        earlier_quality = sum(1 for a in earlier_analyses if a['prediction'] == 'excellent_form') / len(earlier_analyses)
        
        improvement = recent_quality - earlier_quality
        
        if improvement > 0.2:
            return "improving"
        elif improvement < -0.2:
            return "declining" 
        else:
            return "stable"
    
    def reset_session(self):
        """Reset the analysis session"""
        self.keypoint_buffer.clear()
        self.barbell_buffer.clear()
        self.analysis_history.clear()
        self.logger.info("Analysis session reset")
    
    def export_session_data(self) -> Dict:
        """Export session data for training or review"""
        return {
            'exercise_type': self.exercise_type,
            'keypoint_data': self.keypoint_buffer.copy(),
            'barbell_data': self.barbell_buffer.copy(),
            'analysis_history': self.analysis_history.copy(),
            'session_summary': self.get_movement_summary()
        }
