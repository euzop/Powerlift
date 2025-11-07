"""
Test with a real image to verify pose detection works correctly
"""

import cv2
import numpy as np
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.detectors.pose_detector import PoseDetector

def create_better_test_image():
    """Create a more realistic test image with a person-like shape"""
    # Create image
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    img[:] = (50, 50, 50)  # Dark background
    
    # Draw a more realistic stick figure
    # Head
    cv2.circle(img, (320, 80), 25, (200, 200, 200), -1)
    
    # Body (torso)
    cv2.rectangle(img, (305, 105), (335, 220), (180, 180, 180), -1)
    
    # Arms
    cv2.rectangle(img, (275, 120), (305, 140), (160, 160, 160), -1)  # Left arm
    cv2.rectangle(img, (335, 120), (365, 140), (160, 160, 160), -1)  # Right arm
    cv2.rectangle(img, (245, 140), (275, 160), (140, 140, 140), -1)  # Left forearm
    cv2.rectangle(img, (365, 140), (395, 160), (140, 140, 140), -1)  # Right forearm
    
    # Legs  
    cv2.rectangle(img, (310, 220), (325, 300), (160, 160, 160), -1)  # Left thigh
    cv2.rectangle(img, (325, 220), (340, 300), (160, 160, 160), -1)  # Right thigh
    cv2.rectangle(img, (305, 300), (320, 380), (140, 140, 140), -1)  # Left shin
    cv2.rectangle(img, (330, 300), (345, 380), (140, 140, 140), -1)  # Right shin
    
    # Add some texture/noise to make it more realistic
    noise = np.random.randint(0, 30, img.shape, dtype=np.uint8)
    img = cv2.add(img, noise)
    
    return img

def test_with_better_image():
    """Test pose detection with a better test image"""
    model_path = r"c:\Users\euzop\Downloads\Powerlift Final\Powerlift-Backend\singlepose-thunder-tflite-float16.tflite"
    
    print("Loading pose detector...")
    pose_detector = PoseDetector(model_path)
    
    # Create better test image
    test_image = create_better_test_image()
    
    # Save test image for inspection
    cv2.imwrite("test_image.jpg", test_image)
    print("Test image saved as 'test_image.jpg'")
    
    print("Running pose detection...")
    keypoints_with_scores, _ = pose_detector.detect_pose(test_image)
    
    # Squeeze to get keypoints
    squeezed = np.squeeze(keypoints_with_scores)
    
    print(f"\nKeypoint Results (confidence > 0.1):")
    print("-" * 60)
    
    high_conf_keypoints = []
    for i, name in enumerate(pose_detector.keypoint_names):
        if i < squeezed.shape[0]:
            y, x, conf = squeezed[i]
            if conf > 0.1:  # Only show high confidence
                high_conf_keypoints.append((i, name, y, x, conf))
                print(f"{i:2d}. {name:15s}: y={y:.3f}, x={x:.3f}, conf={conf:.3f}")
    
    if len(high_conf_keypoints) == 0:
        print("No high confidence keypoints found (>0.1)")
        print("\nAll keypoints:")
        for i, name in enumerate(pose_detector.keypoint_names):
            if i < squeezed.shape[0]:
                y, x, conf = squeezed[i]
                print(f"{i:2d}. {name:15s}: y={y:.3f}, x={x:.3f}, conf={conf:.3f}")
    
    # Test smoothing
    smoothed = pose_detector.smooth_keypoints(keypoints_with_scores, confidence_threshold=0.05)
    
    if smoothed is not None:
        high_conf_count = sum(1 for i in range(smoothed.shape[0]) if smoothed[i, 2] > 0.05)
        print(f"\nSmoothed keypoints with confidence > 0.05: {high_conf_count}/{smoothed.shape[0]}")
    
    # Visualize results
    output_image = test_image.copy()
    
    # Draw detected keypoints
    height, width = output_image.shape[:2]
    for i in range(squeezed.shape[0]):
        y, x, conf = squeezed[i]
        if conf > 0.05:  # Show keypoints with any reasonable confidence
            px, py = int(x * width), int(y * height)
            cv2.circle(output_image, (px, py), 5, (0, 255, 0), -1)
            cv2.putText(output_image, f"{i}", (px+5, py), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    cv2.imwrite("test_result.jpg", output_image)
    print("Result image saved as 'test_result.jpg'")
    
    print(f"\n📊 SUMMARY:")
    print(f"Raw confidence range: [{np.min(squeezed[:, 2]):.3f}, {np.max(squeezed[:, 2]):.3f}]")
    print(f"Average confidence: {np.mean(squeezed[:, 2]):.3f}")
    print(f"Keypoints > 0.05 confidence: {sum(1 for conf in squeezed[:, 2] if conf > 0.05)}/17")
    print(f"Keypoints > 0.1 confidence: {sum(1 for conf in squeezed[:, 2] if conf > 0.1)}/17")

if __name__ == "__main__":
    test_with_better_image()
