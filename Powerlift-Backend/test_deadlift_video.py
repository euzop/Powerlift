"""
Test pose detection with the actual deadlift video
"""

import cv2
import numpy as np
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.detectors.pose_detector import PoseDetector

def test_deadlift_video():
    """Test pose detection with the deadlift video"""
    model_path = r"c:\Users\euzop\Downloads\Powerlift Final\Powerlift-Backend\singlepose-thunder-tflite-float16.tflite"
    video_path = r"c:\Users\euzop\Downloads\Powerlift Final\deadlift.mp4"
    
    if not os.path.exists(video_path):
        print(f"❌ Video file not found: {video_path}")
        return
    
    print("Loading pose detector...")
    pose_detector = PoseDetector(model_path)
    
    print(f"Model input shape: {pose_detector.input_height}x{pose_detector.input_width}")
    print(f"Model input type: {pose_detector.input_type}")
    
    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Failed to open video: {video_path}")
        return
    
    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    print(f"Video properties: {width}x{height}, {fps:.1f} FPS, {total_frames} frames")
    
    # Process first few frames to test
    test_frames = min(10, total_frames)
    frame_results = []
    
    print(f"\nProcessing first {test_frames} frames...")
    
    for frame_idx in range(test_frames):
        ret, frame = cap.read()
        if not ret:
            break
        
        # Run pose detection
        keypoints_with_scores, _ = pose_detector.detect_pose(frame)
        squeezed = np.squeeze(keypoints_with_scores)
        
        # Count high confidence keypoints
        high_conf_count = sum(1 for conf in squeezed[:, 2] if conf > 0.3)
        medium_conf_count = sum(1 for conf in squeezed[:, 2] if conf > 0.1)
        
        frame_results.append({
            'frame': frame_idx,
            'high_conf': high_conf_count,
            'medium_conf': medium_conf_count,
            'max_conf': np.max(squeezed[:, 2]),
            'avg_conf': np.mean(squeezed[:, 2]),
            'keypoints': squeezed.copy()
        })
        
        print(f"Frame {frame_idx:2d}: High conf (>0.3): {high_conf_count:2d}/17, Medium conf (>0.1): {medium_conf_count:2d}/17, Max: {np.max(squeezed[:, 2]):.3f}")
    
    cap.release()
    
    # Find the best frame (highest confidence scores)
    best_frame = max(frame_results, key=lambda x: x['max_conf'])
    print(f"\n🎯 Best frame: #{best_frame['frame']} (max confidence: {best_frame['max_conf']:.3f})")
    
    # Analyze the best frame in detail
    print(f"\n📊 Detailed analysis of best frame:")
    print("-" * 70)
    
    keypoints = best_frame['keypoints']
    for i, name in enumerate(pose_detector.keypoint_names):
        y, x, conf = keypoints[i]
        status = "🟢" if conf > 0.3 else "🟡" if conf > 0.1 else "🔴"
        print(f"{status} {i:2d}. {name:15s}: y={y:.3f}, x={x:.3f}, conf={conf:.3f}")
    
    # Create output video with keypoints for first few frames
    analysis_dir = r"c:\Users\euzop\Downloads\Powerlift Final\analysis_output"
    if not os.path.exists(analysis_dir):
        os.makedirs(analysis_dir)
    output_path = os.path.join(analysis_dir, "deadlift_FULL_VIDEO_keypoints_analysis.mp4")
    print(f"\n🎬 Creating test output video: {output_path}")
    
    # Reopen video for output creation
    cap = cv2.VideoCapture(video_path)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    frames_to_process = total_frames  # Process the entire video
    
    for frame_idx in range(frames_to_process):
        ret, frame = cap.read()
        if not ret:
            break
        
        # Progress indicator for full video processing
        if frame_idx % 30 == 0 or frame_idx == frames_to_process - 1:
            progress = (frame_idx + 1) / frames_to_process * 100
            print(f"  Processing frame {frame_idx + 1}/{frames_to_process} ({progress:.1f}%)")

        # Run pose detection
        keypoints_with_scores, _ = pose_detector.detect_pose(frame)
        squeezed = np.squeeze(keypoints_with_scores)
        
        # Draw keypoints on frame with better visualization
        for i, (y, x, conf) in enumerate(squeezed):
            if conf > 0.05:  # Show all detectable keypoints
                px, py = int(x * width), int(y * height)
                
                # Color and size based on confidence
                if conf > 0.5:
                    color = (0, 255, 0)  # Green for high confidence
                    radius = 8
                elif conf > 0.3:
                    color = (0, 255, 255)  # Yellow for medium confidence
                    radius = 6
                elif conf > 0.1:
                    color = (0, 165, 255)  # Orange for low-medium confidence
                    radius = 5
                else:
                    color = (0, 0, 255)  # Red for low confidence
                    radius = 4
                
                # Draw keypoint with confidence-based styling
                cv2.circle(frame, (px, py), radius, color, -1)
                cv2.circle(frame, (px, py), radius + 2, (255, 255, 255), 1)  # White border
                
                # Add keypoint number
                cv2.putText(frame, f"{i}", (px+radius+2, py+2), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
                
                # Add keypoint name for critical joints
                if i in [0, 5, 6, 11, 12, 13, 14, 15, 16]:  # Key joints for deadlift
                    name = pose_detector.keypoint_names[i].replace('_', ' ')
                    if len(name) > 8:
                        name = name[:8] + "."
                    cv2.putText(frame, name, (px+radius+15, py), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.3, color, 1)
        
        # Draw skeleton connections
        for connection, color_code in pose_detector.skeleton.items():
            point1_idx, point2_idx = connection
            y1, x1, conf1 = squeezed[point1_idx]
            y2, x2, conf2 = squeezed[point2_idx]
            
            if conf1 > 0.2 and conf2 > 0.2:  # Both points need decent confidence
                px1, py1 = int(x1 * width), int(y1 * height)
                px2, py2 = int(x2 * width), int(y2 * height)
                cv2.line(frame, (px1, py1), (px2, py2), pose_detector.color_map[color_code], 2)
        
        # Add comprehensive frame info
        high_conf = sum(1 for conf in squeezed[:, 2] if conf > 0.5)
        medium_conf = sum(1 for conf in squeezed[:, 2] if conf > 0.3)
        low_conf = sum(1 for conf in squeezed[:, 2] if conf > 0.1)
        max_conf = np.max(squeezed[:, 2])
        
        # Create info overlay
        cv2.rectangle(frame, (5, 5), (width-5, 120), (0, 0, 0), -1)  # Black background
        cv2.rectangle(frame, (5, 5), (width-5, 120), (255, 255, 255), 2)  # White border
        
        cv2.putText(frame, f"Frame: {frame_idx+1}/{frames_to_process}", 
                   (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(frame, f"High Conf (>0.5): {high_conf}/17", 
                   (15, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(frame, f"Med Conf (>0.3): {medium_conf}/17", 
                   (15, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        cv2.putText(frame, f"Low Conf (>0.1): {low_conf}/17 | Max: {max_conf:.3f}", 
                   (15, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
        
        out.write(frame)
    
    cap.release()
    out.release()
    
    print(f"✅ Test video created: {output_path}")
    
    # Summary
    print(f"\n📋 SUMMARY:")
    print("=" * 50)
    avg_high_conf = np.mean([r['high_conf'] for r in frame_results])
    avg_medium_conf = np.mean([r['medium_conf'] for r in frame_results])
    overall_max_conf = max([r['max_conf'] for r in frame_results])
    
    print(f"Average high confidence keypoints (>0.3): {avg_high_conf:.1f}/17")
    print(f"Average medium confidence keypoints (>0.1): {avg_medium_conf:.1f}/17")
    print(f"Overall maximum confidence: {overall_max_conf:.3f}")
    
    if overall_max_conf > 0.7:
        print("✅ Model is working well!")
    elif overall_max_conf > 0.5:
        print("🟡 Model is working but could be better")
    else:
        print("🔴 Model performance is poor - may need different preprocessing")
    
    # Keypoint analysis
    critical_keypoints = [5, 6, 11, 12, 13, 14, 15, 16]  # shoulders, hips, knees, ankles
    critical_names = [pose_detector.keypoint_names[i] for i in critical_keypoints]
    
    print(f"\n🎯 Critical keypoints for deadlift analysis:")
    for i, name in zip(critical_keypoints, critical_names):
        avg_conf = np.mean([r['keypoints'][i, 2] for r in frame_results])
        status = "✅" if avg_conf > 0.3 else "⚠️" if avg_conf > 0.1 else "❌"
        print(f"{status} {name}: avg confidence {avg_conf:.3f}")

if __name__ == "__main__":
    test_deadlift_video()
