"""
Form analyzer for PowerLift.
Analyzes human pose data for form errors in powerlifting exercises.
"""

import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend to avoid tkinter thread issues
import matplotlib.pyplot as plt
import cv2
import math
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
import io
import base64
from matplotlib.colors import LinearSegmentedColormap

class FormAnalyzer:
    """
    Analyzes powerlifting form to detect errors and calculate biomechanical efficiency
    """
    
    def __init__(self):
        # Define thresholds for form errors
        self.knee_valgus_threshold = 0.15  # Normalized inward knee deviation
        self.hip_instability_threshold = 0.1  # Hip angle asymmetry
        self.spine_misalignment_threshold = 20  # Degrees
        
        # Error counters for each category
        self.error_counts = {
            'knee_valgus': 0,
            'spine_misalignment': 0, 
            'hip_instability': 0,
            'bar_path': 0
        }
        
        # Error frames for each category (to highlight in video)
        self.error_frames = {
            'knee_valgus': [],
            'spine_misalignment': [],
            'hip_instability': [],
            'bar_path': []
        }
        
        # Error severity tracking (0-1 scale, higher is more severe)
        self.error_severities = {
            'knee_valgus': [],
            'spine_misalignment': [],
            'hip_instability': [],
            'bar_path': []
        }
        
        # Tracking for bar path analysis
        self.bar_positions = []
        
        # Movement phase tracking
        self.phase_history = []
        self.current_phase = "unknown"
        
        # Overall scores (0-100)
        self.scores = {
            'knee_alignment': 100,
            'spine_alignment': 100,
            'hip_stability': 100,
            'bar_path_efficiency': 100,
            'overall': 100
        }
        
        # Track repetitions
        self.rep_count = 0
        self.rep_markers = []  # Frame indices where reps start
        self.hip_height_history = []  # For rep detection
        
        # Track barbell detection
        self.barbell_detected_frames = 0
        self.total_analyzed_frames = 0
        
    def detect_movement_phase(self, pose_keypoints, frame_idx):
        """
        Detect the current movement phase based on joint positions
        Phases: setup, descent, bottom, ascent, lockout
        """
        # Get hip height (y-coordinate)
        if len(pose_keypoints) > 11 and pose_keypoints[11][2] > 0.5:  # Left hip with good confidence
            hip_height = pose_keypoints[11][0]  # Y-coordinate in image space
            self.hip_height_history.append((frame_idx, hip_height))
            
            # Need at least 10 frames to determine phase
            if len(self.hip_height_history) < 10:
                return "setup"
            
            # Calculate recent movement direction
            recent_heights = [h[1] for h in self.hip_height_history[-10:]]
            height_change = recent_heights[-1] - recent_heights[0]
            
            # Detect repetition transitions
            if len(self.hip_height_history) > 20:
                # Look for local minima in hip height (bottom of movement)
                if self._is_local_minimum(recent_heights):
                    self.rep_count += 1
                    self.rep_markers.append(frame_idx)
                    return "bottom"
            
            # Determine phase based on movement direction
            if abs(height_change) < 5:
                if len(recent_heights) > 5 and min(recent_heights) == recent_heights[-1]:
                    return "bottom"
                elif len(recent_heights) > 5 and max(recent_heights) == recent_heights[-1]:
                    return "lockout"
                else:
                    return "setup"
            elif height_change > 10:  # Moving up
                return "ascent"
            elif height_change < -10:  # Moving down
                return "descent"
            
        return "unknown"
    
    def _is_local_minimum(self, values):
        """Check if the middle of the sequence is a local minimum"""
        if len(values) < 5:
            return False
            
        mid_idx = len(values) // 2
        mid_val = values[mid_idx]
        
        # Check if middle value is lower than neighbors
        return (mid_val < values[mid_idx-2] and 
                mid_val < values[mid_idx-1] and
                mid_val < values[mid_idx+1] and
                mid_val < values[mid_idx+2])
    
    def analyze_frame(self, pose_keypoints, barbell_keypoints, frame_idx):
        """
        Analyze a single frame for form errors
        Returns dict of detected errors and color-coded joint positions
        """
        errors = []
        color_coded_joints = {}
        error_severities = {}
        
        # Increment total frames counter
        self.total_analyzed_frames += 1
        
        # Detect movement phase
        self.current_phase = self.detect_movement_phase(pose_keypoints, frame_idx)
        
        # Track barbell detection
        if barbell_keypoints is not None and len(barbell_keypoints) > 0:
            self.barbell_detected_frames += 1
            self.bar_positions.append((frame_idx, barbell_keypoints[0][0], barbell_keypoints[0][1]))
        
        # Check for knee valgus (knees caving in)
        knee_error, knee_severity = self._check_knee_valgus(pose_keypoints)
        if knee_error:
            errors.append(knee_error)
            self.error_counts['knee_valgus'] += 1
            self.error_frames['knee_valgus'].append(frame_idx)
            self.error_severities['knee_valgus'].append(knee_severity)
            error_severities['knee_valgus'] = knee_severity
            # Color code the knees
            color_coded_joints[13] = (0, 0, 255)  # left knee - red
            color_coded_joints[14] = (0, 0, 255)  # right knee - red
            
        # Check for spine misalignment
        spine_error, spine_severity = self._check_spine_alignment(pose_keypoints)
        if spine_error:
            errors.append(spine_error)
            self.error_counts['spine_misalignment'] += 1
            self.error_frames['spine_misalignment'].append(frame_idx)
            self.error_severities['spine_misalignment'].append(spine_severity)
            error_severities['spine_misalignment'] = spine_severity
            # Color code the spine
            color_coded_joints[5] = (0, 0, 255)  # left shoulder - red
            color_coded_joints[6] = (0, 0, 255)  # right shoulder - red
            color_coded_joints[11] = (0, 0, 255)  # left hip - red
            color_coded_joints[12] = (0, 0, 255)  # right hip - red
            
        # Check for hip instability
        hip_error, hip_severity = self._check_hip_stability(pose_keypoints)
        if hip_error:
            errors.append(hip_error)
            self.error_counts['hip_instability'] += 1
            self.error_frames['hip_instability'].append(frame_idx)
            self.error_severities['hip_instability'].append(hip_severity)
            error_severities['hip_instability'] = hip_severity
            # Color code the hips
            color_coded_joints[11] = (0, 0, 255)  # left hip - red
            color_coded_joints[12] = (0, 0, 255)  # right hip - red
        
        # Check bar path (if we have enough data)
        if len(self.bar_positions) > 5 and barbell_keypoints is not None and len(barbell_keypoints) > 0:
            bar_error, bar_severity = self._check_bar_path()
            if bar_error:
                errors.append(bar_error)
                self.error_counts['bar_path'] += 1
                self.error_frames['bar_path'].append(frame_idx)
                self.error_severities['bar_path'].append(bar_severity)
                error_severities['bar_path'] = bar_severity
                
        return {
            'errors': errors,
            'color_coded_joints': color_coded_joints,
            'phase': self.current_phase,
            'error_severities': error_severities
        }
    
    def _check_knee_valgus(self, pose_keypoints):
        """Check for knee valgus (knees caving inward)"""
        # Get relevant keypoints
        left_hip = pose_keypoints[11]
        right_hip = pose_keypoints[12]
        left_knee = pose_keypoints[13]
        right_knee = pose_keypoints[14]
        left_ankle = pose_keypoints[15]
        right_ankle = pose_keypoints[16]
        
        # Skip if any keypoints are missing
        if (left_hip[2] < 0.5 or right_hip[2] < 0.5 or
            left_knee[2] < 0.5 or right_knee[2] < 0.5 or
            left_ankle[2] < 0.5 or right_ankle[2] < 0.5):
            return None, 0
            
        # Calculate knee alignment relative to hip-ankle line
        left_deviation = self._point_to_line_distance(
            (left_knee[1], left_knee[0]),  # x, y
            (left_hip[1], left_hip[0]),
            (left_ankle[1], left_ankle[0])
        )
        
        right_deviation = self._point_to_line_distance(
            (right_knee[1], right_knee[0]),  # x, y
            (right_hip[1], right_hip[0]),
            (right_ankle[1], right_ankle[0])
        )
        
        # Normalize by limb length
        left_limb_length = np.sqrt(
            (left_hip[1] - left_ankle[1])**2 + 
            (left_hip[0] - left_ankle[0])**2
        )
        
        right_limb_length = np.sqrt(
            (right_hip[1] - right_ankle[1])**2 + 
            (right_hip[0] - right_ankle[0])**2
        )
        
        left_ratio = left_deviation / left_limb_length if left_limb_length > 0 else 0
        right_ratio = right_deviation / right_limb_length if right_limb_length > 0 else 0
        
        # Calculate severity (0-1 scale)
        max_ratio = max(left_ratio, right_ratio)
        severity = 0
        
        # Check if either knee exceeds threshold
        if max_ratio > self.knee_valgus_threshold:
            # Calculate severity based on how much the threshold is exceeded
            severity = min(1.0, (max_ratio - self.knee_valgus_threshold) / self.knee_valgus_threshold)
            return f"Knee valgus detected - knees caving inward", severity
        
        return None, 0
    
    def _check_spine_alignment(self, pose_keypoints):
        """Check for spine misalignment"""
        # Get relevant keypoints
        left_shoulder = pose_keypoints[5]
        right_shoulder = pose_keypoints[6]
        left_hip = pose_keypoints[11]
        right_hip = pose_keypoints[12]
        
        # Skip if any keypoints are missing
        if (left_shoulder[2] < 0.5 or right_shoulder[2] < 0.5 or
            left_hip[2] < 0.5 or right_hip[2] < 0.5):
            return None, 0
            
        # Calculate angle between shoulders and hips
        shoulder_midpoint = (
            (left_shoulder[1] + right_shoulder[1])/2,
            (left_shoulder[0] + right_shoulder[0])/2
        )
        
        hip_midpoint = (
            (left_hip[1] + right_hip[1])/2,
            (left_hip[0] + right_hip[0])/2
        )
        
        # Calculate the angle with vertical
        spine_angle = math.degrees(math.atan2(
            shoulder_midpoint[0] - hip_midpoint[0],
            shoulder_midpoint[1] - hip_midpoint[1]
        ))
        
        # Calculate severity (0-1 scale)
        severity = 0
        
        if abs(spine_angle) > self.spine_misalignment_threshold:
            # Calculate severity based on how much the threshold is exceeded
            severity = min(1.0, (abs(spine_angle) - self.spine_misalignment_threshold) / 
                          (90 - self.spine_misalignment_threshold))
            return f"Spine misalignment detected: {spine_angle:.1f}° tilt", severity
            
        return None, 0
    
    def _check_hip_stability(self, pose_keypoints):
        """Check for hip instability (hip shifting or rotation)"""
        # Get relevant keypoints
        left_hip = pose_keypoints[11]
        right_hip = pose_keypoints[12]
        left_knee = pose_keypoints[13]
        right_knee = pose_keypoints[14]
        
        # Skip if any keypoints are missing
        if (left_hip[2] < 0.5 or right_hip[2] < 0.5 or
            left_knee[2] < 0.5 or right_knee[2] < 0.5):
            return None, 0
            
        # Calculate hip angles
        left_hip_angle = self._calculate_angle(
            (left_hip[1], left_hip[0] - 0.1),  # point above left hip
            (left_hip[1], left_hip[0]),
            (left_knee[1], left_knee[0])
        )
        
        right_hip_angle = self._calculate_angle(
            (right_hip[1], right_hip[0] - 0.1),  # point above right hip
            (right_hip[1], right_hip[0]),
            (right_knee[1], right_knee[0])
        )
        
        # Check for asymmetry
        angle_diff = abs(left_hip_angle - right_hip_angle)
        
        # Calculate severity (0-1 scale)
        severity = 0
        
        if angle_diff > self.hip_instability_threshold:
            # Calculate severity based on how much the threshold is exceeded
            severity = min(1.0, (angle_diff - self.hip_instability_threshold) / 
                          (45 - self.hip_instability_threshold))
            return f"Hip instability detected: {angle_diff:.1f}° asymmetry", severity
            
        return None, 0
        
    def _check_bar_path(self):
        """Check for efficient bar path"""
        # Need at least a few points to analyze
        if len(self.bar_positions) < 5:
            return None, 0
            
        # Get the last few positions
        recent_positions = self.bar_positions[-5:]
        
        # Calculate horizontal deviation
        x_positions = [pos[1] for pos in recent_positions]
        x_deviation = max(x_positions) - min(x_positions)
        
        # Calculate severity (0-1 scale)
        severity = 0
        
        # If horizontal deviation is too large, flag it
        if x_deviation > 50:  # pixels
            # Calculate severity based on deviation
            severity = min(1.0, (x_deviation - 50) / 100)
            return f"Inefficient bar path: {x_deviation:.1f}px horizontal deviation", severity
            
        return None, 0
    
    def _point_to_line_distance(self, point, line_point1, line_point2):
        """Calculate the distance from a point to a line defined by two points"""
        x0, y0 = point
        x1, y1 = line_point1
        x2, y2 = line_point2
        
        # Handle vertical or nearly vertical lines
        if abs(x2 - x1) < 1e-6:
            return abs(x0 - x1)
            
        # Calculate line parameters
        m = (y2 - y1) / (x2 - x1)
        b = y1 - m * x1
        
        # Calculate distance
        return abs(y0 - m*x0 - b) / math.sqrt(1 + m*m)
    
    def _calculate_angle(self, point1, point2, point3):
        """Calculate the angle between three points (in degrees)"""
        # Convert to numpy arrays for easier calculation
        a = np.array([point1[1], point1[0]])
        b = np.array([point2[1], point2[0]])
        c = np.array([point3[1], point3[0]])
        
        # Calculate vectors
        ba = a - b
        bc = c - b
        
        # Calculate angle
        cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
        angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
        
        return math.degrees(angle)
    
    def calculate_final_scores(self, total_frames):
        """Calculate final scores based on error counts and severities"""
        if total_frames <= 0:
            return
            
        # Calculate individual scores with non-linear penalty
        knee_errors = len(self.error_frames['knee_valgus'])
        spine_errors = len(self.error_frames['spine_misalignment'])
        hip_errors = len(self.error_frames['hip_instability'])
        bar_path_errors = len(self.error_frames['bar_path'])
        
        # Calculate average severity for each error type
        knee_severity = sum(self.error_severities['knee_valgus']) / max(1, knee_errors)
        spine_severity = sum(self.error_severities['spine_misalignment']) / max(1, spine_errors)
        hip_severity = sum(self.error_severities['hip_instability']) / max(1, hip_errors)
        bar_path_severity = sum(self.error_severities['bar_path']) / max(1, bar_path_errors)
        
        # Calculate error rates
        knee_error_rate = knee_errors / total_frames
        spine_error_rate = spine_errors / total_frames
        hip_error_rate = hip_errors / total_frames
        bar_path_error_rate = bar_path_errors / total_frames
        
        # Non-linear scoring that penalizes higher error rates more severely
        self.scores['knee_alignment'] = 100 * math.exp(-3 * knee_error_rate * (1 + knee_severity))
        self.scores['spine_alignment'] = 100 * math.exp(-3 * spine_error_rate * (1 + spine_severity))
        self.scores['hip_stability'] = 100 * math.exp(-3 * hip_error_rate * (1 + hip_severity))
        self.scores['bar_path_efficiency'] = 100 * math.exp(-3 * bar_path_error_rate * (1 + bar_path_severity))
        
        # Ensure scores are within 0-100 range
        for key in self.scores:
            if key != 'overall':
                self.scores[key] = max(0, min(100, self.scores[key]))
        
        # Calculate overall score (weighted average)
        self.scores['overall'] = (
            self.scores['knee_alignment'] * 0.25 +
            self.scores['spine_alignment'] * 0.3 +
            self.scores['hip_stability'] * 0.25 +
            self.scores['bar_path_efficiency'] * 0.2
        )
        
        # Add barbell detection rate to scores
        if self.total_analyzed_frames > 0:
            self.scores['barbell_detection_rate'] = self.barbell_detected_frames / self.total_analyzed_frames
            
            # If no barbell was detected in most frames, set all scores to 0
            if self.scores['barbell_detection_rate'] < 0.1:  # Less than 10% barbell detection
                self.scores['knee_alignment'] = 0
                self.scores['spine_alignment'] = 0
                self.scores['hip_stability'] = 0
                self.scores['bar_path_efficiency'] = 0
                self.scores['overall'] = 0
    
    def generate_exercise_specific_feedback(self, exercise_type):
        """Generate exercise-specific feedback based on scores and detected errors"""
        feedback = []
        
        # Common feedback based on scores
        if self.scores['knee_alignment'] < 70:
            feedback.append("Focus on keeping your knees properly aligned with your toes throughout the movement")
        
        if self.scores['spine_alignment'] < 70:
            feedback.append("Maintain a neutral spine position to avoid injury")
        
        if self.scores['hip_stability'] < 70:
            feedback.append("Work on hip stability and control during the movement")
        
        if self.scores['bar_path_efficiency'] < 70:
            feedback.append("Try to keep the bar path more vertical for better efficiency")
        
        # Exercise-specific feedback
        if exercise_type == 'deadlift':
            if self.scores['spine_alignment'] < 80:
                feedback.append("Keep your back straight during the deadlift to prevent lower back injury")
            if self.scores['hip_stability'] < 80:
                feedback.append("Initiate the deadlift by hinging at the hips, not by bending the knees first")
                
        elif exercise_type == 'squat':
            if self.scores['knee_alignment'] < 80:
                feedback.append("Ensure your knees track over your toes and don't cave inward during the squat")
            if self.scores['hip_stability'] < 80:
                feedback.append("Maintain proper depth in your squat, aiming to reach parallel or below")
                
        elif exercise_type == 'bench':
            if self.scores['spine_alignment'] < 80:
                feedback.append("Keep your back flat on the bench with a slight arch in your lower back")
            if self.scores['bar_path_efficiency'] < 80:
                feedback.append("Lower the bar to your mid-chest and press straight up for optimal bar path")
        
        # If no specific feedback, add general encouragement
        if not feedback:
            feedback.append("Great form! Keep up the good work and focus on maintaining consistency")
            
        return feedback
    
    def generate_radar_chart(self, save_to_file=False):
        """Generate a radar chart visualization of the scores"""
        try:
            # Define categories and scores
            categories = ['Knee Alignment', 'Spine Alignment', 'Hip Stability', 'Bar Path']
            scores = [
                self.scores['knee_alignment'],
                self.scores['spine_alignment'],
                self.scores['hip_stability'],
                self.scores['bar_path_efficiency']
            ]
            
            # Number of variables
            N = len(categories)
            
            # Create angles for each category (equally spaced)
            angles = [n / float(N) * 2 * np.pi for n in range(N)]
            angles += angles[:1]  # Close the polygon
            
            # Add scores to complete the polygon
            scores = scores + [scores[0]]
            
            # Create figure with dark background
            fig = plt.figure(figsize=(12, 12), facecolor='#121212', dpi=200)
            ax = fig.add_subplot(111, polar=True)
            
            # Set background color
            ax.set_facecolor('#121212')
            
            # Draw the polygon and fill with color
            ax.fill(angles, scores, alpha=0.25, color='#FF3B4E')
            ax.plot(angles, scores, color='#FF3B4E', linewidth=2)
            
            # Set category labels
            ax.set_xticks(angles[:-1])
            ax.set_xticklabels(categories, color='white', size=14)
            
            # Set y-axis limits and labels
            ax.set_ylim(0, 100)
            ax.set_yticks([25, 50, 75, 100])
            ax.set_yticklabels(['25', '50', '75', '100'], color='white', size=12)
            
            # Add grid lines
            ax.grid(color='gray', alpha=0.3)
            
            # Add title
            plt.title('Form Analysis', color='white', size=20, pad=20)
            
            # Add overall score in the center
            ax.text(0, 0, f"{self.scores['overall']:.1f}", 
                    ha='center', va='center', color='#FF3B4E', 
                    fontsize=36, fontweight='bold')
            
            # Add rep count if available
            if self.rep_count > 0:
                ax.text(0, -25, f"Reps: {self.rep_count}", 
                        ha='center', va='center', color='white', 
                        fontsize=16)
            
            # Save to file or return as base64
            if save_to_file:
                plt.savefig('radar_chart.png', bbox_inches='tight', facecolor='#121212')
                plt.close()
                return 'radar_chart.png'
            else:
                # Save to buffer and convert to base64
                buf = io.BytesIO()
                plt.savefig(buf, format='png', bbox_inches='tight', facecolor='#121212')
                buf.seek(0)
                img_str = base64.b64encode(buf.read()).decode('utf-8')
                plt.close()
                return img_str
        except Exception as e:
            print(f"Error in generate_radar_chart: {str(e)}")
            # Return empty string on error
            return "" 