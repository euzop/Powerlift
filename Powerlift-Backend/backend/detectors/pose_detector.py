"""
Pose detection implementation using TensorFlow Lite.
"""

import tensorflow as tf
import numpy as np
import cv2
from ..models.kalman_filter import ExtendedKalmanFilter

class PoseDetector:
    def __init__(self, model_path):
        try:
            # Load the TFLite model
            self.interpreter = tf.lite.Interpreter(model_path=model_path)
            self.interpreter.allocate_tensors()
            
            # Get model details
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
            
            self.input_height = self.input_details[0]['shape'][1]
            self.input_width = self.input_details[0]['shape'][2]
            self.input_type = self.input_details[0]['dtype']
            
            print(f"MoveNet model loaded successfully: {model_path}")
            print(f"Input shape: {self.input_height}x{self.input_width}, type: {self.input_type}")
            
        except Exception as e:
            print(f"Error loading MoveNet model: {str(e)}")
            raise
        
        # Define the keypoint names for visualization
        self.keypoint_names = [
            'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
            'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
            'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
            'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
        ]
        
        # Initialize Kalman filter for pose keypoints
        self.kalman_filter = ExtendedKalmanFilter(len(self.keypoint_names))
        
        # Define skeleton connections for visualization
        self.skeleton = {
            (0, 1): 'm',  # nose to left_eye
            (0, 2): 'c',  # nose to right_eye
            (1, 3): 'm',  # left_eye to left_ear
            (2, 4): 'c',  # right_eye to right_ear
            (0, 5): 'm',  # nose to left_shoulder
            (0, 6): 'c',  # nose to right_shoulder
            (5, 7): 'm',  # left_shoulder to left_elbow
            (7, 9): 'm',  # left_elbow to left_wrist
            (6, 8): 'c',  # right_shoulder to right_elbow
            (8, 10): 'c',  # right_elbow to right_wrist
            (5, 6): 'y',  # left_shoulder to right_shoulder
            (5, 11): 'm',  # left_shoulder to left_hip
            (6, 12): 'c',  # right_shoulder to right_hip
            (11, 12): 'y',  # left_hip to right_hip
            (11, 13): 'm',  # left_hip to left_knee
            (13, 15): 'm',  # left_knee to left_ankle
            (12, 14): 'c',  # right_hip to right_knee
            (14, 16): 'c'   # right_knee to right_ankle
        }
        
        self.color_map = {'m': (255, 0, 255),   # magenta
                          'c': (0, 255, 255),   # cyan
                          'y': (0, 255, 0)}    # yellow
        
        # Store the last smoothed keypoints
        self.last_smoothed_keypoints = None

    def detect_pose(self, frame):
        """
        Detect pose in the given frame
        Returns: keypoints with scores, input frame
        """
        # Resize and preprocess the image
        img = cv2.resize(frame, (self.input_width, self.input_height))
        
        # Ensure RGB format (OpenCV uses BGR by default)
        if len(img.shape) == 3 and img.shape[2] == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        input_frame = np.expand_dims(img, axis=0)
        
        # Handle different input types correctly
        if self.input_type == np.float32:
            # Normalize to [-1, 1] for float32 models
            input_frame = (input_frame.astype(np.float32) / 127.5) - 1
        elif self.input_type == np.uint8:
            # Keep as uint8 [0, 255] - this is what your model expects!
            input_frame = input_frame.astype(np.uint8)
        else:
            print(f"Warning: Unexpected input type {self.input_type}, using as-is")
            
        # Set the input tensor
        self.interpreter.set_tensor(self.input_details[0]['index'], input_frame)
        
        # Run inference
        self.interpreter.invoke()
        
        # Get the output tensor
        keypoints_with_scores = self.interpreter.get_tensor(self.output_details[0]['index'])
        
        # Handle the extra dimension in your model's output [1, 1, 17, 3] -> [1, 17, 3]
        if len(keypoints_with_scores.shape) == 4 and keypoints_with_scores.shape[1] == 1:
            keypoints_with_scores = np.squeeze(keypoints_with_scores, axis=1)
        
        # Return the keypoints with scores and the input frame
        return keypoints_with_scores, input_frame
    
    def smooth_keypoints(self, keypoints_with_scores, confidence_threshold=0.2):
        """
        Apply Extended Kalman Filter to smooth the keypoints
        
        Args:
            keypoints_with_scores: Output from detect_pose
            confidence_threshold: Threshold for keypoint confidence
            
        Returns:
            Smoothed keypoints for visualization
        """
        height, width = 1.0, 1.0  # Normalized coordinates
        
        # Validate input shape
        if keypoints_with_scores is None:
            return None
        
        # Handle different input formats
        if len(keypoints_with_scores.shape) > 2:
            shaped = np.squeeze(keypoints_with_scores)
        else:
            shaped = keypoints_with_scores
        
        # Validate that we have keypoints after squeezing
        if shaped.size == 0 or shaped.shape[0] == 0:
            print("Warning: No keypoints found in the input array")
            return None
        
        # Extract keypoints and confidences
        keypoints = []
        confidences = []
        
        # Ensure we have at least y, x, conf dimensions
        if shaped.shape[1] < 3:
            print(f"Warning: Invalid keypoint format, expected at least 3 dimensions but got {shaped.shape[1]}")
            return None
        
        for i, (y, x, conf) in enumerate(shaped):
            if conf > confidence_threshold:
                # Convert from normalized coordinates (for Kalman filter input)
                keypoints.append([x, y])
                confidences.append(conf)
            else:
                keypoints.append(None)
                confidences.append(0.0)
        
        # Apply Kalman filtering
        smoothed_keypoints = self.kalman_filter.smooth_keypoints(keypoints, confidences)
        
        # Create a new array for display
        smoothed_display = np.zeros_like(shaped)
        
        for i, kp in enumerate(smoothed_keypoints):
            if kp is not None:
                # Store the smoothed values in the result array
                smoothed_display[i] = [kp[1], kp[0], shaped[i, 2]]  # y, x, conf
        
        self.last_smoothed_keypoints = smoothed_display
        return smoothed_display

    def draw_connections(self, frame, keypoints_with_scores, confidence_threshold=0.2):
        """Draw the skeleton connections on the frame"""
        height, width, _ = frame.shape
        
        # Use smoothed keypoints if available
        if self.last_smoothed_keypoints is not None:
            shaped = self.last_smoothed_keypoints
        else:
            shaped = np.squeeze(keypoints_with_scores)
        
        for connection, color_code in self.skeleton.items():
            point1_idx, point2_idx = connection
            y1, x1, conf1 = shaped[point1_idx]
            y2, x2, conf2 = shaped[point2_idx]
            
            if conf1 > confidence_threshold and conf2 > confidence_threshold:
                # Convert from normalized coordinates to pixel values
                x1_px, y1_px = int(x1 * width), int(y1 * height)
                x2_px, y2_px = int(x2 * width), int(y2 * height)
                
                # Draw the line using the mapped color
                cv2.line(frame, (x1_px, y1_px), (x2_px, y2_px), self.color_map[color_code], 2)
        
        return frame

    def draw_keypoints(self, frame, keypoints_with_scores, confidence_threshold=0.2):
        """Draw the detected keypoints on the frame"""
        height, width, _ = frame.shape
        
        # Use smoothed keypoints if available
        if self.last_smoothed_keypoints is not None:
            shaped = self.last_smoothed_keypoints
        else:
            shaped = np.squeeze(keypoints_with_scores)
        
        # Draw each keypoint if its confidence is above the threshold
        for i, (y, x, conf) in enumerate(shaped):
            if conf > confidence_threshold:
                # Convert from normalized coordinates to pixel values
                x_px, y_px = int(x * width), int(y * height)
                
                # Draw a circle at the keypoint position
                cv2.circle(frame, (x_px, y_px), 5, (0, 255, 0), -1)
                
                # Optionally, display the keypoint name
                cv2.putText(frame, self.keypoint_names[i], (x_px + 5, y_px), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1, cv2.LINE_AA)
        
        return frame 