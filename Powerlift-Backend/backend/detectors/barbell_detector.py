"""
Barbell detection implementation using YOLO.
"""

import cv2
import numpy as np
from ultralytics import YOLO

class BarbellDetector:
    def __init__(self, model_path):
        try:
            # Load the YOLOv8 model
            self.model = YOLO(model_path, verbose=False)
            print(f"Barbell detector model loaded successfully: {model_path}")
        except Exception as e:
            print(f"Error loading barbell detection model: {str(e)}")
            raise
        
        # Define barbell skeleton connections
        self.barbell_skeleton = [
            (0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), 
            (6, 7), (7, 8), (8, 9), (9, 10), (10, 11), (11, 12), (12, 13)
        ]
        
        # Define colors for each connection in skeleton
        self.colors = [(0, 255, 0), (0, 0, 255), (255, 0, 0), 
                  (255, 255, 0), (255, 0, 255), (0, 255, 255),
                  (128, 128, 0), (0, 128, 128), (128, 0, 128)]
    
    def detect_barbell(self, frame, conf_threshold=0.25):
        """
        Detect barbell in a frame
        Returns list of detections with bounding boxes, keypoints, and confidence scores
        """
        try:
            # Ensure frame is a valid image
            if frame is None or frame.size == 0:
                print("Warning: Empty frame passed to barbell detector")
                return None
                
            # Run inference with verbose=False to suppress progress output
            results = self.model(
                source=frame,
                conf=conf_threshold,
                save=False,
                verbose=False
            )
            
            if not results:
                return None
            
            return results[0]  # Return the first result
            
        except Exception as e:
            print(f"Error in barbell detection: {str(e)}")
            return None
    
    def draw_barbell(self, frame, result):
        """Draw detected barbell bounding boxes and keypoints on the frame"""
        if result is None or not hasattr(result, 'boxes') or len(result.boxes) == 0:
            return frame
        
        # Process keypoints and bounding boxes
        if hasattr(result, 'keypoints') and result.keypoints is not None:
            # Extract keypoints
            kpts = result.keypoints.data.cpu().numpy()
            
            # Draw bounding boxes
            for i, box in enumerate(result.boxes.data.cpu().numpy()):
                x1, y1, x2, y2, conf, class_id = box
                class_id = int(class_id)
                
                # Draw box
                cv2.rectangle(frame, 
                          (int(x1), int(y1)), 
                          (int(x2), int(y2)), 
                          (255, 0, 0), 2)
                
                # Get class name
                class_name = result.names[class_id]
                
                # Add text with confidence
                text = f"{class_name}: {conf:.2f}"
                cv2.putText(frame, text, 
                        (int(x1), int(y1) - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
                
                # Draw keypoints for this detection
                if i < len(kpts):
                    # Get keypoints for this detection
                    keypoints = kpts[i]
                    
                    # Plot keypoints
                    for j, (x, y, conf) in enumerate(keypoints):
                        if conf > 0.5:  # Only draw high-confidence keypoints
                            x, y = int(x), int(y)
                            cv2.circle(frame, (x, y), 4, (0, 0, 255), -1)  # Red circles for keypoints
                            # Add keypoint number as text near the point
                            cv2.putText(frame, f"B{j}", (x+5, y+5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
                    
                    # Plot skeleton (connections between keypoints)
                    for j, (p1_idx, p2_idx) in enumerate(self.barbell_skeleton):
                        if p1_idx < len(keypoints) and p2_idx < len(keypoints):
                            if (keypoints[p1_idx][2] > 0.5 and keypoints[p2_idx][2] > 0.5):  # Check if both connected points are visible
                                color = self.colors[j % len(self.colors)]
                                pt1 = (int(keypoints[p1_idx][0]), int(keypoints[p1_idx][1]))
                                pt2 = (int(keypoints[p2_idx][0]), int(keypoints[p2_idx][1]))
                                cv2.line(frame, pt1, pt2, color, thickness=2)
        
        return frame
        
    def extract_keypoints(self, result):
        """
        Extract keypoints from detection result in a consistent format
        Returns: numpy array of shape (N, 3) with [x, y, confidence] for each keypoint
        """
        if result is None or not hasattr(result, 'keypoints') or result.keypoints is None:
            return None
        
        try:
            # Extract keypoints data
            kpts = result.keypoints.data[0].cpu().numpy()
            
            # Ensure kpts is 2D array with shape (N, 3)
            if len(kpts.shape) == 1 and kpts.size == 3:
                kpts = kpts.reshape(1, 3)
            elif len(kpts.shape) != 2 or kpts.shape[1] != 3:
                print(f"Warning: Unexpected keypoints shape: {kpts.shape}")
                return None
                
            return kpts
        except Exception as e:
            print(f"Error extracting barbell keypoints: {str(e)}")
            return None 