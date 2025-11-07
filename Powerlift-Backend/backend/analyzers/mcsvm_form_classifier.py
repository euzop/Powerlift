"""
Multiclass Support Vector Machine (One vs All) for Powerlifting Form Classification
Analyzes pose keypoints to detect movement inefficiencies and form errors
"""

import numpy as np
import pandas as pd
from sklearn.svm import SVC
from sklearn.multiclass import OneVsRestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import os
from typing import List, Dict, Tuple, Optional
import logging

class PowerliftFormClassifier:
    """
    MCSVM classifier for powerlifting form analysis
    Classifies movement patterns into form categories
    """
    
    def __init__(self, exercise_type: str = "deadlift"):
        self.exercise_type = exercise_type
        self.classifier = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.feature_names = []
        self.is_trained = False
        
        # Form categories for classification
        self.form_categories = {
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
                "bar_path_error"
            ]
        }
        
        # Initialize logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
    def extract_features(self, keypoints_sequence: np.ndarray, barbell_positions: Optional[np.ndarray] = None) -> np.ndarray:
        """
        Extract comprehensive features from pose keypoints and barbell positions
        
        Args:
            keypoints_sequence: Shape (n_frames, 17, 3) - pose keypoints over time
            barbell_positions: Shape (n_frames, 4) - barbell bbox coordinates
            
        Returns:
            Feature vector for classification
        """
        features = []
        
        if len(keypoints_sequence) == 0:
            return np.array([])
        
        # 1. JOINT ANGLE FEATURES
        joint_angles = self._calculate_joint_angles(keypoints_sequence)
        features.extend(joint_angles)
        
        # 2. SYMMETRY FEATURES  
        symmetry_features = self._calculate_symmetry_features(keypoints_sequence)
        features.extend(symmetry_features)
        
        # 3. MOVEMENT TRAJECTORY FEATURES
        trajectory_features = self._calculate_trajectory_features(keypoints_sequence)
        features.extend(trajectory_features)
        
        # 4. TEMPORAL FEATURES
        temporal_features = self._calculate_temporal_features(keypoints_sequence)
        features.extend(temporal_features)
        
        # 5. BARBELL PATH FEATURES (if available)
        if barbell_positions is not None:
            barbell_features = self._calculate_barbell_features(barbell_positions)
            features.extend(barbell_features)
        
        # 6. STABILITY FEATURES
        stability_features = self._calculate_stability_features(keypoints_sequence)
        features.extend(stability_features)
        
        return np.array(features)
    
    def _calculate_joint_angles(self, keypoints_sequence: np.ndarray) -> List[float]:
        """Calculate key joint angles throughout movement"""
        features = []
        
        # Average keypoints across frames for stable angle calculation
        avg_keypoints = np.mean(keypoints_sequence, axis=0)
        
        # Key joint indices (COCO format)
        joints = {
            'left_shoulder': 5, 'right_shoulder': 6,
            'left_elbow': 7, 'right_elbow': 8,
            'left_hip': 11, 'right_hip': 12,
            'left_knee': 13, 'right_knee': 14,
            'left_ankle': 15, 'right_ankle': 16
        }
        
        # Calculate key angles
        if self.exercise_type == "deadlift":
            # Hip angle (hip-knee-ankle)
            left_hip_angle = self._angle_between_points(
                avg_keypoints[joints['left_hip']][:2],
                avg_keypoints[joints['left_knee']][:2], 
                avg_keypoints[joints['left_ankle']][:2]
            )
            right_hip_angle = self._angle_between_points(
                avg_keypoints[joints['right_hip']][:2],
                avg_keypoints[joints['right_knee']][:2],
                avg_keypoints[joints['right_ankle']][:2]
            )
            
            # Knee angle
            left_knee_angle = self._angle_between_points(
                avg_keypoints[joints['left_hip']][:2],
                avg_keypoints[joints['left_knee']][:2],
                avg_keypoints[joints['left_ankle']][:2]
            )
            right_knee_angle = self._angle_between_points(
                avg_keypoints[joints['right_hip']][:2],
                avg_keypoints[joints['right_knee']][:2], 
                avg_keypoints[joints['right_ankle']][:2]
            )
            
            features.extend([left_hip_angle, right_hip_angle, left_knee_angle, right_knee_angle])
        
        # Add angle variations (standard deviation across frames)
        angle_variations = []
        for frame in keypoints_sequence:
            frame_angles = []
            if self.exercise_type == "deadlift":
                left_hip = self._angle_between_points(
                    frame[joints['left_hip']][:2],
                    frame[joints['left_knee']][:2],
                    frame[joints['left_ankle']][:2]
                )
                frame_angles.append(left_hip)
            angle_variations.append(frame_angles)
        
        if angle_variations:
            angle_std = np.std(angle_variations, axis=0)
            features.extend(angle_std.tolist())
        
        return features
    
    def _calculate_symmetry_features(self, keypoints_sequence: np.ndarray) -> List[float]:
        """Calculate left-right symmetry features"""
        features = []
        
        # Average across frames
        avg_keypoints = np.mean(keypoints_sequence, axis=0)
        
        # Symmetry pairs
        symmetry_pairs = [
            (5, 6),   # shoulders
            (7, 8),   # elbows  
            (11, 12), # hips
            (13, 14), # knees
            (15, 16)  # ankles
        ]
        
        for left_idx, right_idx in symmetry_pairs:
            left_point = avg_keypoints[left_idx][:2]
            right_point = avg_keypoints[right_idx][:2]
            
            # Calculate horizontal symmetry (x-coordinate difference)
            x_symmetry = abs(left_point[0] - right_point[0])
            
            # Calculate vertical alignment (y-coordinate difference)  
            y_alignment = abs(left_point[1] - right_point[1])
            
            features.extend([x_symmetry, y_alignment])
        
        return features
    
    def _calculate_trajectory_features(self, keypoints_sequence: np.ndarray) -> List[float]:
        """Calculate movement trajectory features"""
        features = []
        
        if len(keypoints_sequence) < 2:
            return [0] * 10  # Return zero features if insufficient data
        
        # Key points to track
        key_points = [11, 12, 13, 14]  # Hips and knees
        
        for point_idx in key_points:
            positions = keypoints_sequence[:, point_idx, :2]  # x, y coordinates
            
            # Calculate velocity (change in position)
            velocities = np.diff(positions, axis=0)
            velocity_magnitude = np.linalg.norm(velocities, axis=1)
            
            # Trajectory smoothness (acceleration changes)
            accelerations = np.diff(velocities, axis=0)
            acceleration_magnitude = np.linalg.norm(accelerations, axis=1)
            
            features.extend([
                np.mean(velocity_magnitude),
                np.std(velocity_magnitude),
                np.mean(acceleration_magnitude) if len(acceleration_magnitude) > 0 else 0
            ])
        
        return features
    
    def _calculate_temporal_features(self, keypoints_sequence: np.ndarray) -> List[float]:
        """Calculate temporal movement features"""
        features = []
        
        # Movement duration
        movement_duration = len(keypoints_sequence)
        features.append(movement_duration)
        
        # Phase detection (simplified - based on hip height)
        hip_heights = np.mean(keypoints_sequence[:, [11, 12], 1], axis=1)  # Average hip y-coordinate
        
        if len(hip_heights) > 3:
            # Find movement phases
            min_height_idx = np.argmin(hip_heights)
            
            # Descent phase duration
            descent_duration = min_height_idx
            # Ascent phase duration  
            ascent_duration = len(hip_heights) - min_height_idx
            
            features.extend([descent_duration, ascent_duration])
            
            # Movement consistency (variance in hip height change)
            hip_height_changes = np.diff(hip_heights)
            consistency = np.std(hip_height_changes)
            features.append(consistency)
        else:
            features.extend([0, 0, 0])
        
        return features
    
    def _calculate_barbell_features(self, barbell_positions: np.ndarray) -> List[float]:
        """Calculate barbell path features"""
        features = []
        
        if len(barbell_positions) < 2:
            return [0] * 5
        
        # Barbell center points
        centers = np.column_stack([
            (barbell_positions[:, 0] + barbell_positions[:, 2]) / 2,  # x center
            (barbell_positions[:, 1] + barbell_positions[:, 3]) / 2   # y center
        ])
        
        # Bar path deviation (horizontal movement)
        horizontal_deviation = np.std(centers[:, 0])
        
        # Bar path smoothness
        center_velocities = np.diff(centers, axis=0)
        velocity_magnitude = np.linalg.norm(center_velocities, axis=1)
        path_smoothness = np.std(velocity_magnitude)
        
        # Total bar path length
        path_segments = np.linalg.norm(center_velocities, axis=1)
        total_path_length = np.sum(path_segments)
        
        # Efficiency (straight line vs actual path)
        straight_line_distance = np.linalg.norm(centers[-1] - centers[0])
        efficiency = straight_line_distance / max(total_path_length, 0.001)
        
        features.extend([
            horizontal_deviation,
            path_smoothness, 
            total_path_length,
            efficiency,
            np.mean(velocity_magnitude)
        ])
        
        return features
    
    def _calculate_stability_features(self, keypoints_sequence: np.ndarray) -> List[float]:
        """Calculate stability and balance features"""
        features = []
        
        # Center of mass estimation (simplified)
        com_points = np.mean(keypoints_sequence[:, [11, 12], :2], axis=1)  # Hip center
        
        if len(com_points) > 1:
            # COM movement (stability indicator)
            com_movement = np.std(com_points, axis=0)
            features.extend(com_movement.tolist())
            
            # Base of support (foot distance)
            left_ankle = keypoints_sequence[:, 15, :2]
            right_ankle = keypoints_sequence[:, 16, :2]
            foot_distances = np.linalg.norm(left_ankle - right_ankle, axis=1)
            
            features.extend([
                np.mean(foot_distances),
                np.std(foot_distances)
            ])
        else:
            features.extend([0, 0, 0, 0])
        
        return features
    
    def _angle_between_points(self, p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
        """Calculate angle between three points (p2 is the vertex)"""
        v1 = p1 - p2
        v2 = p3 - p2
        
        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        cos_angle = np.clip(cos_angle, -1, 1)  # Handle numerical errors
        angle = np.arccos(cos_angle)
        
        return np.degrees(angle)
    
    def train(self, training_data: List[Dict], validation_split: float = 0.2):
        """
        Train the MCSVM classifier
        
        Args:
            training_data: List of training examples with 'features' and 'label' keys
            validation_split: Fraction of data to use for validation
        """
        self.logger.info(f"Training MCSVM classifier for {self.exercise_type}")
        
        # Prepare training data
        X = []
        y = []
        
        for sample in training_data:
            features = sample['features']
            label = sample['label']
            
            # Handle different feature formats
            if isinstance(features, list):
                # Convert list to numpy array
                features_array = np.array(features)
            elif isinstance(features, np.ndarray):
                features_array = features.flatten()  # Ensure 1D
            else:
                continue  # Skip invalid features
            
            # Only include samples with valid features
            if len(features_array) > 0:
                X.append(features_array)
                y.append(label)
        
        if len(X) == 0:
            raise ValueError("No valid training data provided")
        
        # Check feature consistency
        feature_lengths = [len(features) for features in X]
        if len(set(feature_lengths)) > 1:
            # Features have different lengths - need to standardize
            max_length = max(feature_lengths)
            print(f"Warning: Inconsistent feature lengths detected. Max: {max_length}, Min: {min(feature_lengths)}")
            
            # Pad shorter features with zeros or truncate longer ones to a common length
            common_length = min(max_length, 50)  # Use 50 as standard length
            X_standardized = []
            
            for features in X:
                if len(features) > common_length:
                    # Truncate
                    X_standardized.append(features[:common_length])
                elif len(features) < common_length:
                    # Pad with zeros
                    padded = np.pad(features, (0, common_length - len(features)), mode='constant')
                    X_standardized.append(padded)
                else:
                    X_standardized.append(features)
            
            X = X_standardized
        
        # Convert to numpy arrays and ensure consistent shape
        try:
            X = np.array(X)
            y = np.array(y)
        except ValueError as e:
            print(f"Error converting to numpy arrays: {e}")
            print(f"Feature shapes: {[np.array(features).shape for features in X[:5]]}")
            raise
        
        # Handle empty features
        if X.size == 0:
            raise ValueError("No training data provided")
        
        # Store feature names for interpretation
        self.feature_names = [f"feature_{i}" for i in range(X.shape[1])]
        
        # Encode labels
        y_encoded = self.label_encoder.fit_transform(y)
        
        # Split data
        X_train, X_val, y_train, y_val = train_test_split(
            X, y_encoded, test_size=validation_split, random_state=42, stratify=y_encoded
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        
        # Train One-vs-Rest SVM classifier
        svm_base = SVC(
            kernel='rbf',
            C=1.0,
            gamma='scale',
            probability=True,
            random_state=42
        )
        
        self.classifier = OneVsRestClassifier(svm_base)
        self.classifier.fit(X_train_scaled, y_train)
        
        # Validate
        val_score = self.classifier.score(X_val_scaled, y_val)
        self.logger.info(f"Validation accuracy: {val_score:.3f}")
        
        # Cross-validation
        cv_scores = cross_val_score(self.classifier, X_train_scaled, y_train, cv=5)
        self.logger.info(f"Cross-validation scores: {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")
        
        self.is_trained = True
        
        # Generate classification report
        y_pred = self.classifier.predict(X_val_scaled)
        class_names = self.label_encoder.classes_
        
        # Get unique labels present in validation set to avoid mismatch
        unique_labels_in_val = np.unique(np.concatenate([y_val, y_pred]))
        target_names_filtered = [class_names[i] for i in unique_labels_in_val]
        
        try:
            report = classification_report(y_val, y_pred, labels=unique_labels_in_val, target_names=target_names_filtered, zero_division=0)
            self.logger.info(f"Classification Report:\n{report}")
        except Exception as e:
            self.logger.warning(f"Could not generate classification report: {e}")
            # Fallback: just report accuracy
            accuracy = np.mean(y_val == y_pred)
            self.logger.info(f"Validation accuracy: {accuracy:.3f}")
        
    def predict(self, keypoints_sequence: np.ndarray, barbell_positions: Optional[np.ndarray] = None) -> Dict:
        """
        Predict form classification for given movement
        
        Returns:
            Dictionary with prediction, confidence, and detailed analysis
        """
        if not self.is_trained:
            raise ValueError("Classifier must be trained before prediction")
        
        # Extract features
        features = self.extract_features(keypoints_sequence, barbell_positions)
        
        if len(features) == 0:
            return {
                'prediction': 'insufficient_data',
                'confidence': 0.0,
                'probabilities': {},
                'analysis': 'Insufficient keypoint data for analysis'
            }
        
        # Scale features
        features_scaled = self.scaler.transform(features.reshape(1, -1))
        
        # Predict
        prediction_encoded = self.classifier.predict(features_scaled)[0]
        prediction = self.label_encoder.inverse_transform([prediction_encoded])[0]
        
        # Get probabilities
        probabilities = self.classifier.predict_proba(features_scaled)[0]
        class_names = self.label_encoder.classes_
        prob_dict = {class_names[i]: prob for i, prob in enumerate(probabilities)}
        
        # Confidence (max probability)
        confidence = max(probabilities)
        
        # Detailed analysis
        analysis = self._generate_analysis(features, prediction, prob_dict)
        
        return {
            'prediction': prediction,
            'confidence': confidence,
            'probabilities': prob_dict,
            'analysis': analysis,
            'features': features.tolist()
        }
    
    def _generate_analysis(self, features: np.ndarray, prediction: str, probabilities: Dict) -> str:
        """Generate detailed movement analysis"""
        analysis_parts = []
        
        # Primary prediction
        analysis_parts.append(f"Form Classification: {prediction.replace('_', ' ').title()}")
        
        # Top concerns (highest probability issues except excellent_form)
        concerns = {k: v for k, v in probabilities.items() if k != 'excellent_form' and v > 0.1}
        if concerns:
            top_concerns = sorted(concerns.items(), key=lambda x: x[1], reverse=True)[:3]
            concern_text = ", ".join([f"{concern.replace('_', ' ')} ({prob:.1%})" 
                                    for concern, prob in top_concerns])
            analysis_parts.append(f"Key Concerns: {concern_text}")
        
        # Feature-based insights (simplified)
        if len(features) > 10:  # Ensure we have enough features
            # Symmetry analysis (features 4-13 are symmetry features)
            symmetry_features = features[4:14] if len(features) > 14 else features[4:min(len(features), 14)]
            asymmetry_score = np.mean(symmetry_features)
            
            if asymmetry_score > 0.1:
                analysis_parts.append("Note: Significant left-right asymmetry detected")
            
            # Movement stability (last few features)
            if len(features) > 20:
                stability_features = features[-4:]
                stability_score = np.mean(stability_features)
                
                if stability_score > 0.2:
                    analysis_parts.append("Note: Movement stability could be improved")
        
        return ". ".join(analysis_parts)
    
    def save_model(self, filepath: str):
        """Save trained model to disk"""
        if not self.is_trained:
            raise ValueError("No trained model to save")
        
        model_data = {
            'classifier': self.classifier,
            'scaler': self.scaler,
            'label_encoder': self.label_encoder,
            'exercise_type': self.exercise_type,
            'feature_names': self.feature_names,
            'form_categories': self.form_categories
        }
        
        joblib.dump(model_data, filepath)
        self.logger.info(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """Load trained model from disk"""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file not found: {filepath}")
        
        model_data = joblib.load(filepath)
        
        self.classifier = model_data['classifier']
        self.scaler = model_data['scaler'] 
        self.label_encoder = model_data['label_encoder']
        self.exercise_type = model_data['exercise_type']
        self.feature_names = model_data['feature_names']
        self.form_categories = model_data['form_categories']
        self.is_trained = True
        
        self.logger.info(f"Model loaded from {filepath}")
