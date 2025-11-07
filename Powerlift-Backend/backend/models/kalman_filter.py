"""
Extended Kalman Filter for smoothing keypoint trajectories.
"""

import numpy as np

class ExtendedKalmanFilter:
    """
    Extended Kalman Filter for smoothing keypoint trajectories
    Each keypoint is tracked with its own filter
    State vector: [x, y, dx, dy] where (x,y) is position and (dx,dy) is velocity
    """
    def __init__(self, num_keypoints, process_noise=0.03, measurement_noise=0.1):
        self.num_keypoints = num_keypoints
        
        # Initialize filters for each keypoint
        self.filters = []
        for _ in range(num_keypoints):
            self.filters.append({
                'state': np.zeros(4),  # [x, y, dx, dy]
                'covariance': np.eye(4),
                'initialized': False
            })
        
        # Process noise (how much we expect the state to change between frames)
        self.process_noise = process_noise
        
        # Measurement noise (how reliable the detections are)
        self.measurement_noise = measurement_noise
        
        # Time step (will be updated based on FPS if available)
        self.dt = 1.0/30.0  # Default to 30 fps if not set
        
        # State transition model (constant velocity model)
        self.F = np.array([
            [1, 0, self.dt, 0],
            [0, 1, 0, self.dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ])
        
        # Measurement model (we only observe position, not velocity)
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ])
        
        # Process noise covariance
        self.Q = np.array([
            [self.process_noise, 0, 0, 0],
            [0, self.process_noise, 0, 0],
            [0, 0, self.process_noise*2, 0],
            [0, 0, 0, self.process_noise*2]
        ])
        
        # Measurement noise covariance
        self.R = np.array([
            [self.measurement_noise, 0],
            [0, self.measurement_noise]
        ])
    
    def set_fps(self, fps):
        """Update time step based on video FPS"""
        self.dt = 1.0 / fps
        # Update state transition matrix
        self.F[0, 2] = self.dt
        self.F[1, 3] = self.dt
    
    def predict(self, idx):
        """Predict the state of keypoint idx"""
        if not self.filters[idx]['initialized']:
            return None
            
        filter = self.filters[idx]
        
        # Predict state
        predicted_state = self.F @ filter['state']
        
        # Predict covariance
        predicted_covariance = self.F @ filter['covariance'] @ self.F.T + self.Q
        
        # Update filter
        filter['state'] = predicted_state
        filter['covariance'] = predicted_covariance
        
        return filter['state'][:2]  # Return predicted position (x, y)
    
    def update(self, idx, measurement, confidence):
        """Update the filter for keypoint idx with a new measurement"""
        if measurement is None:
            # No measurement, just return the prediction
            return self.predict(idx)
        
        # Initialize if this is the first detection
        if not self.filters[idx]['initialized']:
            self.filters[idx]['state'][:2] = measurement
            self.filters[idx]['initialized'] = True
            return measurement
        
        # Get the filter for this keypoint
        filter = self.filters[idx]
        
        # Measurement vector (x, y)
        z = np.array(measurement)
        
        # Predicted measurement
        predicted_z = self.H @ filter['state']
        
        # Innovation (difference between measurement and prediction)
        y = z - predicted_z
        
        # Innovation covariance
        S = self.H @ filter['covariance'] @ self.H.T + self.R / max(confidence, 0.1)
        
        # Kalman gain
        K = filter['covariance'] @ self.H.T @ np.linalg.inv(S)
        
        # Update state
        filter['state'] = filter['state'] + K @ y
        
        # Update covariance
        I = np.eye(4)
        filter['covariance'] = (I - K @ self.H) @ filter['covariance']
        
        return filter['state'][:2]  # Return updated position (x, y)
    
    def smooth_keypoints(self, keypoints, confidences):
        """
        Smooth a set of keypoints using the Extended Kalman Filter
        
        Args:
            keypoints: Array of shape [num_keypoints, 2] with (x, y) coordinates, or None for undetected keypoints
            confidences: Array of shape [num_keypoints] with detection confidences
            
        Returns:
            Smoothed keypoints array of shape [num_keypoints, 2]
        """
        # Validate inputs
        if keypoints is None or len(keypoints) == 0:
            print("Warning: Empty keypoints array provided to Kalman filter")
            return [None] * self.num_keypoints
        
        if len(keypoints) != self.num_keypoints:
            print(f"Warning: Expected {self.num_keypoints} keypoints, got {len(keypoints)}")
            # Pad with None if too few keypoints
            if len(keypoints) < self.num_keypoints:
                keypoints = keypoints + [None] * (self.num_keypoints - len(keypoints))
            # Truncate if too many keypoints
            else:
                keypoints = keypoints[:self.num_keypoints]
        
        # Ensure confidences has same length as keypoints
        if len(confidences) != self.num_keypoints:
            print(f"Warning: Confidences array length mismatch: expected {self.num_keypoints}, got {len(confidences)}")
            # Pad with zeros if too few confidences
            if len(confidences) < self.num_keypoints:
                confidences = confidences + [0.0] * (self.num_keypoints - len(confidences))
            # Truncate if too many confidences
            else:
                confidences = confidences[:self.num_keypoints]
        
        smoothed_keypoints = []
        
        for i in range(self.num_keypoints):
            kp = keypoints[i]
            conf = confidences[i]
            
            # Skip invalid keypoints or low confidence detections
            if kp is None or conf < 0.1:
                # No reliable detection, just predict based on previous states
                predicted_pos = self.predict(i)
                smoothed_keypoints.append(predicted_pos)
            else:
                # Update the filter with the new detection
                updated_pos = self.update(i, kp, conf)
                smoothed_keypoints.append(updated_pos)
        
        return smoothed_keypoints 