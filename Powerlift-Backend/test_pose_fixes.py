"""
Test script to verify pose detection fixes
"""

import cv2
import numpy as np
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.detectors.pose_detector import PoseDetector

def test_pose_detection():
    """Test pose detection with a simple image"""
    model_path = r"c:\Users\euzop\Downloads\Powerlift Final\Powerlift-Backend\singlepose-thunder-tflite-float16.tflite"
    
    print("Loading pose detector...")
    pose_detector = PoseDetector(model_path)
    
    print(f"Model input shape: {pose_detector.input_height}x{pose_detector.input_width}")
    print(f"Model input type: {pose_detector.input_type}")
    
    # Create a test image (or load a real one)
    test_image = np.zeros((480, 640, 3), dtype=np.uint8)
    test_image[:] = (128, 128, 128)  # Gray background
    
    # Add a simple stick figure-like pattern for testing
    cv2.circle(test_image, (320, 100), 20, (255, 255, 255), -1)  # Head
    cv2.rectangle(test_image, (310, 120), (330, 200), (255, 255, 255), -1)  # Body
    cv2.rectangle(test_image, (290, 140), (310, 160), (255, 255, 255), -1)  # Left arm
    cv2.rectangle(test_image, (330, 140), (350, 160), (255, 255, 255), -1)  # Right arm
    cv2.rectangle(test_image, (310, 200), (320, 250), (255, 255, 255), -1)  # Left leg
    cv2.rectangle(test_image, (320, 200), (330, 250), (255, 255, 255), -1)  # Right leg
    
    print("Running pose detection...")
    keypoints_with_scores, _ = pose_detector.detect_pose(test_image)
    
    print(f"Raw output shape: {keypoints_with_scores.shape}")
    
    # Squeeze to get keypoints
    squeezed = np.squeeze(keypoints_with_scores)
    print(f"Squeezed shape: {squeezed.shape}")
    
    print("\nKeypoint Analysis:")
    print("-" * 50)
    
    for i, name in enumerate(pose_detector.keypoint_names):
        if i < squeezed.shape[0]:
            y, x, conf = squeezed[i]
            print(f"{i:2d}. {name:15s}: y={y:.3f}, x={x:.3f}, conf={conf:.3f}")
            
            # Check if coordinates are reasonable (should be 0-1 for normalized)
            if not (0 <= y <= 1 and 0 <= x <= 1):
                print(f"    ⚠️  WARNING: Coordinates out of [0,1] range!")
        else:
            print(f"{i:2d}. {name:15s}: NOT AVAILABLE")
    
    # Test smoothing
    print("\nTesting keypoint smoothing...")
    smoothed = pose_detector.smooth_keypoints(keypoints_with_scores, confidence_threshold=0.1)
    
    if smoothed is not None:
        print(f"Smoothed keypoints shape: {smoothed.shape}")
        
        # Count high-confidence keypoints
        high_conf_count = 0
        for i in range(smoothed.shape[0]):
            if smoothed[i, 2] > 0.1:  # confidence > 0.1
                high_conf_count += 1
        
        print(f"High confidence keypoints (>0.1): {high_conf_count}/{smoothed.shape[0]}")
    else:
        print("⚠️  Smoothing failed!")
    
    print("\n" + "="*60)
    print("DIAGNOSIS SUMMARY:")
    print("="*60)
    
    if squeezed.shape == (17, 3):
        print("✓ Correct keypoint count (17)")
    else:
        print(f"❌ Incorrect keypoint count: {squeezed.shape}")
    
    # Check coordinate ranges
    coords_ok = True
    for i in range(squeezed.shape[0]):
        y, x, conf = squeezed[i]
        if not (0 <= y <= 1 and 0 <= x <= 1):
            coords_ok = False
            break
    
    if coords_ok:
        print("✓ Coordinates in valid range [0,1]")
    else:
        print("❌ Coordinates outside valid range [0,1]")
    
    # Check confidence distribution
    confidences = squeezed[:, 2]
    avg_conf = np.mean(confidences)
    max_conf = np.max(confidences)
    
    print(f"✓ Confidence stats: avg={avg_conf:.3f}, max={max_conf:.3f}")
    
    if max_conf > 0.5:
        print("✓ Model producing reasonable confidence scores")
    else:
        print("⚠️  Low confidence scores - may need different input preprocessing")

if __name__ == "__main__":
    test_pose_detection()
