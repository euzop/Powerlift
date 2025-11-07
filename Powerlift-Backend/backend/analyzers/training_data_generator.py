"""
Training data generator for MCSVM Form Classification
Creates synthetic and real training data for powerlifting form analysis
"""

import numpy as np
from typing import List, Dict, Tuple
import json
import os
from .mcsvm_form_classifier import PowerliftFormClassifier

class TrainingDataGenerator:
    """
    Generates training data for MCSVM form classification
    Combines synthetic data with real annotated examples
    """
    
    def __init__(self, exercise_type: str = "deadlift"):
        self.exercise_type = exercise_type
        self.data_samples = []
        
    def generate_synthetic_data(self, samples_per_class: int = 100) -> List[Dict]:
        """
        Generate synthetic training data for form classification
        """
        synthetic_data = []
        form_categories = {
            "deadlift": [
                "excellent_form",
                "rounded_back", 
                "knee_valgus",
                "forward_lean",
                "uneven_hips",
                "bar_drift",
                "poor_lockout"
            ],
            "squat": [
                "excellent_form",
                "knee_valgus", 
                "forward_lean",
                "butt_wink",
                "uneven_depth",
                "heel_lift",
                "weight_shift"
            ],
            "bench": [
                "excellent_form",
                "elbow_flare",
                "arch_excessive", 
                "uneven_press",
                "shoulder_impingement",
                "bar_path_error",
                "partial_range"
            ]
        }
        
        categories = form_categories.get(self.exercise_type, ["excellent_form"])
        
        for category in categories:
            for _ in range(samples_per_class):
                # Generate synthetic keypoint sequence
                keypoints_sequence = self._generate_synthetic_keypoints(category)
                
                # Extract features using the classifier
                classifier = PowerliftFormClassifier(self.exercise_type)
                features = classifier.extract_features(keypoints_sequence)
                
                if len(features) > 0:
                    synthetic_data.append({
                        'features': features,
                        'label': category,
                        'source': 'synthetic'
                    })
        
        return synthetic_data
    
    def _generate_synthetic_keypoints(self, form_category: str, num_frames: int = 30) -> np.ndarray:
        """
        Generate synthetic keypoint sequences for different form categories
        """
        # Get base pose based on exercise type
        if self.exercise_type == "bench":
            base_pose = self._get_bench_press_base_pose()
        else:
            base_pose = self._get_standing_base_pose()
        
        sequence = []
        
        for frame in range(num_frames):
            # Create movement progression
            progress = frame / (num_frames - 1)  # 0 to 1
            
            current_pose = base_pose.copy()
            
            # Apply exercise-specific movement
            current_pose = self._apply_exercise_movement(current_pose, progress)
            
            # Apply form-specific modifications
            current_pose = self._apply_form_modifications(current_pose, form_category, progress)
            
            # Add some noise for realism
            noise = np.random.normal(0, 0.01, current_pose.shape)
            current_pose[:, :2] += noise[:, :2]  # Only add noise to x,y coordinates
            
            # Ensure confidence scores stay reasonable
            current_pose[:, 2] = np.clip(current_pose[:, 2], 0.3, 0.98)
            
            sequence.append(current_pose)
        
        return np.array(sequence)
    
    def _get_standing_base_pose(self) -> np.ndarray:
        """Get base pose for standing exercises (deadlift, squat)"""
        return np.array([
            [0.5, 0.15, 0.9],   # nose
            [0.48, 0.14, 0.9],  # left_eye
            [0.52, 0.14, 0.9],  # right_eye
            [0.46, 0.14, 0.8],  # left_ear
            [0.54, 0.14, 0.8],  # right_ear
            [0.42, 0.25, 0.95], # left_shoulder
            [0.58, 0.25, 0.95], # right_shoulder
            [0.38, 0.35, 0.9],  # left_elbow
            [0.62, 0.35, 0.9],  # right_elbow
            [0.36, 0.45, 0.85], # left_wrist
            [0.64, 0.45, 0.85], # right_wrist
            [0.44, 0.50, 0.95], # left_hip
            [0.56, 0.50, 0.95], # right_hip
            [0.42, 0.70, 0.95], # left_knee
            [0.58, 0.70, 0.95], # right_knee
            [0.40, 0.90, 0.9],  # left_ankle
            [0.60, 0.90, 0.9],  # right_ankle
        ])
    
    def _get_bench_press_base_pose(self) -> np.ndarray:
        """Get base pose for bench press (lying down)"""
        return np.array([
            [0.5, 0.25, 0.9],   # nose
            [0.48, 0.23, 0.9],  # left_eye
            [0.52, 0.23, 0.9],  # right_eye
            [0.46, 0.23, 0.8],  # left_ear
            [0.54, 0.23, 0.8],  # right_ear
            [0.35, 0.35, 0.95], # left_shoulder
            [0.65, 0.35, 0.95], # right_shoulder
            [0.25, 0.25, 0.9],  # left_elbow (arms extended up)
            [0.75, 0.25, 0.9],  # right_elbow
            [0.20, 0.15, 0.85], # left_wrist (holding bar)
            [0.80, 0.15, 0.85], # right_wrist
            [0.35, 0.55, 0.95], # left_hip (lying down)
            [0.65, 0.55, 0.95], # right_hip
            [0.30, 0.75, 0.95], # left_knee
            [0.70, 0.75, 0.95], # right_knee
            [0.25, 0.85, 0.9],  # left_ankle
            [0.75, 0.85, 0.9],  # right_ankle
        ])
    
    def _apply_exercise_movement(self, pose: np.ndarray, progress: float) -> np.ndarray:
        """Apply exercise-specific movement patterns"""
        if self.exercise_type == "deadlift":
            # Hip hinge movement
            hip_movement = 0.1 * np.sin(progress * np.pi)  # Down and up
            knee_bend = 0.05 * np.sin(progress * np.pi)
            pose[11:13, 1] += hip_movement  # Hip movement
            pose[13:15, 1] += knee_bend     # Knee movement
            
        elif self.exercise_type == "squat":
            # Knee dominant movement
            squat_depth = 0.15 * np.sin(progress * np.pi)  # Deeper knee bend
            hip_movement = 0.08 * np.sin(progress * np.pi)
            pose[11:13, 1] += hip_movement  # Hip movement
            pose[13:15, 1] += squat_depth   # Knee movement (more pronounced)
            
        elif self.exercise_type == "bench":
            # Arm extension/flexion (vertical movement of arms)
            arm_movement = 0.1 * np.sin(progress * np.pi)  # Arms down and up
            pose[7:11, 1] += arm_movement   # Elbow and wrist movement
            
        return pose
    
    def _apply_form_modifications(self, pose: np.ndarray, form_category: str, progress: float) -> np.ndarray:
        """Apply specific form modifications based on category"""
        
        if form_category == "excellent_form":
            # Minimal modifications for excellent form
            return pose
        
        elif form_category == "rounded_back":
            # Forward head and rounded shoulders
            pose[0, 0] += 0.03  # Nose forward
            pose[5, 0] += 0.02  # Left shoulder forward
            pose[6, 0] += 0.02  # Right shoulder forward
            pose[5, 1] += 0.02  # Left shoulder down
            pose[6, 1] += 0.02  # Right shoulder down
            
        elif form_category == "knee_valgus":
            # Knees caving in
            pose[13, 0] += 0.03  # Left knee inward
            pose[14, 0] -= 0.03  # Right knee inward
            
        elif form_category == "forward_lean":
            # Excessive forward lean
            forward_lean = 0.05 * progress
            pose[0:11, 0] += forward_lean  # Upper body forward
            
        elif form_category == "uneven_hips":
            # Hip asymmetry
            pose[11, 1] += 0.02  # Left hip higher
            pose[13, 1] += 0.02  # Left knee adjustment
            pose[15, 1] += 0.02  # Left ankle adjustment
            
        elif form_category == "bar_drift":
            # Simulated bar moving away from body
            # This would be reflected in barbell position data
            pass
            
        elif form_category == "poor_lockout":
            # Incomplete hip extension at top
            if progress > 0.7:  # Near end of movement
                hip_extension_deficit = 0.03
                pose[11:13, 1] += hip_extension_deficit
        
        # Bench press specific form issues
        elif form_category == "elbow_flare":
            # Excessive elbow flare (elbows too wide)
            pose[7, 0] -= 0.05   # Left elbow out
            pose[8, 0] += 0.05   # Right elbow out
            pose[9, 0] -= 0.06   # Left wrist follows
            pose[10, 0] += 0.06  # Right wrist follows
            
        elif form_category == "arch_excessive":
            # Excessive lower back arch
            pose[11:13, 1] -= 0.03  # Hips raised too high
            pose[0, 1] += 0.02      # Head tilted back
            
        elif form_category == "uneven_press":
            # Uneven bar press (one side higher)
            pose[7, 1] += 0.03   # Left elbow higher
            pose[9, 1] += 0.03   # Left wrist higher
            
        elif form_category == "shoulder_impingement":
            # Shoulders rolled forward/impinged position
            pose[5, 0] += 0.03   # Left shoulder forward
            pose[6, 0] += 0.03   # Right shoulder forward
            pose[5, 1] += 0.02   # Left shoulder elevated
            pose[6, 1] += 0.02   # Right shoulder elevated
            
        elif form_category == "bar_path_error":
            # Bar path not straight (simulated through arm positioning)
            path_error = 0.03 * np.sin(progress * 2 * np.pi)  # Oscillating path
            pose[7:11, 0] += path_error  # Arms/wrists deviate
            
        elif form_category == "partial_range":
            # Partial range of motion (not touching chest)
            if progress > 0.3 and progress < 0.7:  # Bottom portion
                range_reduction = 0.04  # Don't go as low
                pose[7:11, 1] -= range_reduction
        
        # Squat specific form issues (add missing ones)
        elif form_category == "butt_wink":
            # Lower back rounding at bottom
            if progress > 0.4:  # Bottom of squat
                pose[0, 0] += 0.02   # Head forward
                pose[5:7, 0] += 0.03 # Shoulders round forward
                
        elif form_category == "uneven_depth":
            # Asymmetric squat depth
            pose[13, 1] += 0.03  # Left knee not as deep
            pose[15, 1] += 0.03  # Left ankle adjustment
            
        elif form_category == "heel_lift":
            # Heels coming off ground
            pose[15, 1] -= 0.02  # Left ankle higher
            pose[16, 1] -= 0.02  # Right ankle higher
            
        elif form_category == "weight_shift":
            # Lateral weight shifting
            lateral_shift = 0.02 * np.sin(progress * np.pi)
            pose[11:17, 0] += lateral_shift  # Lower body shifts
        
        # Reduce confidence for problematic keypoints
        if form_category != "excellent_form":
            confidence_reduction = np.random.uniform(0.1, 0.3)
            pose[:, 2] *= (1 - confidence_reduction)
        
        return pose
    
    def load_annotated_data(self, data_file: str) -> List[Dict]:
        """
        Load real annotated training data from file
        Handles both traditional format and user feedback format
        """
        if not os.path.exists(data_file):
            print(f"Warning: Annotated data file not found: {data_file}")
            return []
        
        try:
            with open(data_file, 'r') as f:
                annotated_data = json.load(f)
            
            training_samples = []
            
            # Handle user feedback format (list of feedback entries)
            if isinstance(annotated_data, list) and len(annotated_data) > 0:
                first_item = annotated_data[0]
                
                # Check if this is user feedback format
                if 'features' in first_item and 'label' in first_item:
                    # Direct features format (already processed feedback)
                    for sample in annotated_data:
                        if 'features' in sample and 'label' in sample:
                            training_samples.append({
                                'features': sample['features'],
                                'label': sample['label'],
                                'source': 'feedback'
                            })
                
                elif 'frame_features' in first_item and ('predicted_form' in first_item or 'correct_form' in first_item):
                    # User feedback format
                    for entry in annotated_data:
                        # Use correct form if prediction was wrong, otherwise use predicted form
                        label = entry.get('correct_form') if not entry.get('is_correct', True) else entry.get('predicted_form')
                        features = entry.get('frame_features', [])
                        
                        if label and features and len(features) > 0:
                            training_samples.append({
                                'features': features,
                                'label': label,
                                'source': 'user_feedback'
                            })
                
                elif 'keypoints' in first_item and 'label' in first_item:
                    # Traditional keypoints format
                    for sample in annotated_data:
                        if 'keypoints' in sample and 'label' in sample:
                            # Convert keypoints to numpy array
                            keypoints = np.array(sample['keypoints'])
                            
                            # Extract features
                            classifier = PowerliftFormClassifier(self.exercise_type)
                            features = classifier.extract_features(keypoints)
                            
                            if len(features) > 0:
                                training_samples.append({
                                    'features': features,
                                    'label': sample['label'],
                                    'source': 'annotated'
                                })
            
            print(f"📊 Loaded {len(training_samples)} training samples from {data_file}")
            return training_samples
            
        except Exception as e:
            print(f"Error loading annotated data: {e}")
            return []
    
    def create_training_dataset(self, 
                              synthetic_samples: int = 100,
                              annotated_data_file: str = None) -> List[Dict]:
        """
        Create complete training dataset combining synthetic and real data
        """
        training_data = []
        
        # Add synthetic data
        print(f"Generating {synthetic_samples} synthetic samples per class...")
        synthetic_data = self.generate_synthetic_data(synthetic_samples)
        training_data.extend(synthetic_data)
        
        # Add annotated data if available
        if annotated_data_file:
            print(f"Loading annotated data from {annotated_data_file}...")
            annotated_data = self.load_annotated_data(annotated_data_file)
            training_data.extend(annotated_data)
        
        print(f"Total training samples: {len(training_data)}")
        
        # Print class distribution
        class_counts = {}
        for sample in training_data:
            label = sample['label']
            class_counts[label] = class_counts.get(label, 0) + 1
        
        print("Class distribution:")
        for label, count in class_counts.items():
            print(f"  {label}: {count} samples")
        
        return training_data
    
    def save_training_data(self, training_data: List[Dict], output_file: str):
        """Save training data to file for future use"""
        # Convert numpy arrays to lists for JSON serialization
        serializable_data = []
        for sample in training_data:
            serializable_sample = {
                'features': sample['features'].tolist() if isinstance(sample['features'], np.ndarray) else sample['features'],
                'label': sample['label'],
                'source': sample.get('source', 'unknown')
            }
            serializable_data.append(serializable_sample)
        
        with open(output_file, 'w') as f:
            json.dump(serializable_data, f, indent=2)
        
        print(f"Training data saved to {output_file}")


def train_mcsvm_classifier(exercise_type: str = "deadlift", 
                          model_output_path: str = None,
                          annotated_data_file: str = None):
    """
    Complete training pipeline for MCSVM form classifier
    """
    print(f"Training MCSVM classifier for {exercise_type}")
    
    # Generate training data
    data_generator = TrainingDataGenerator(exercise_type)
    training_data = data_generator.create_training_dataset(
        synthetic_samples=150,
        annotated_data_file=annotated_data_file
    )
    
    if len(training_data) == 0:
        print("Error: No training data generated")
        return None
    
    # Initialize and train classifier
    classifier = PowerliftFormClassifier(exercise_type)
    
    try:
        classifier.train(training_data, validation_split=0.2)
        
        # Save model
        if model_output_path is None:
            model_output_path = f"models/mcsvm_{exercise_type}_classifier.pkl"
        
        os.makedirs(os.path.dirname(model_output_path), exist_ok=True)
        classifier.save_model(model_output_path)
        
        print(f"✅ MCSVM classifier trained and saved to {model_output_path}")
        return classifier
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        return None


if __name__ == "__main__":
    # Example usage
    classifier = train_mcsvm_classifier(
        exercise_type="deadlift",
        model_output_path="models/deadlift_form_classifier.pkl"
    )
