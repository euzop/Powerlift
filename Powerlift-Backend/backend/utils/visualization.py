"""
Visualization utility functions for PowerLift.
"""

import cv2
import numpy as np

def draw_pose_with_feedback(frame, keypoints_with_scores, confidence_threshold, form_feedback, pose_detector):
    """
    Draw the pose with color-coded feedback based on form analysis
    
    Args:
        frame: The input frame to draw on
        keypoints_with_scores: Detected pose keypoints with confidence scores
        confidence_threshold: Minimum confidence score to display keypoints
        form_feedback: Form analysis feedback including errors and color-coded joints
        pose_detector: Instance of PoseDetector for skeleton connections
        
    Returns:
        Frame with pose visualization and color-coded feedback
    """
    height, width, _ = frame.shape
    
    # Create a slightly darker copy of the frame for better visibility
    frame = cv2.convertScaleAbs(frame, alpha=0.7, beta=0)  # Darker background for better contrast
    
    # Use smoothed keypoints if available
    if pose_detector.last_smoothed_keypoints is not None:
        shaped = pose_detector.last_smoothed_keypoints
    else:
        shaped = np.squeeze(keypoints_with_scores)
    
    # Get color-coded joints if form feedback is available
    color_coded_joints = {}
    if form_feedback and 'color_coded_joints' in form_feedback:
        color_coded_joints = form_feedback['color_coded_joints']
    
    # Draw connections first (so they appear behind the keypoints)
    for connection, color_code in pose_detector.skeleton.items():
        point1_idx, point2_idx = connection
        y1, x1, conf1 = shaped[point1_idx]
        y2, x2, conf2 = shaped[point2_idx]
        
        if conf1 > confidence_threshold and conf2 > confidence_threshold:
            # Convert from normalized coordinates to pixel values
            x1_px, y1_px = int(x1 * width), int(y1 * height)
            x2_px, y2_px = int(x2 * width), int(y2 * height)
            
            # Check if either point is color-coded for errors
            if point1_idx in color_coded_joints or point2_idx in color_coded_joints:
                # Use red color for connections with errors
                conn_color = (0, 0, 255)
                thickness = 4  # Thicker for error connections
            else:
                # Use the regular color map
                conn_color = pose_detector.color_map[color_code]
                thickness = 3  # Standard thickness
                
            # Draw the line with increased thickness
            cv2.line(frame, (x1_px, y1_px), (x2_px, y2_px), conn_color, thickness)
            
            # Add glow effect for better visibility
            cv2.line(frame, (x1_px, y1_px), (x2_px, y2_px), (255, 255, 255), 1, cv2.LINE_AA)
    
    # Draw each keypoint
    for i, (y, x, conf) in enumerate(shaped):
        if conf > confidence_threshold:
            # Convert from normalized coordinates to pixel values
            x_px, y_px = int(x * width), int(y * height)
            
            # Check if this joint should be color-coded for errors
            if i in color_coded_joints:
                joint_color = color_coded_joints[i]
                # Add outer circle for error highlights
                cv2.circle(frame, (x_px, y_px), 12, joint_color, 3)  # Larger error highlight
                keypoint_size = 9  # Larger size for error keypoints
            else:
                joint_color = (0, 255, 0)  # Default green
                keypoint_size = 8  # Standard size
            
            # Draw a circle at the keypoint position with glow effect
            cv2.circle(frame, (x_px, y_px), keypoint_size + 2, (255, 255, 255), -1)  # White inner glow
            cv2.circle(frame, (x_px, y_px), keypoint_size, joint_color, -1)  # Colored keypoint
            
            # Optionally, display the keypoint name with better visibility
            if conf > 0.6 and i in [5, 6, 11, 12, 13, 14]:  # Only show labels for important points with high confidence
                cv2.putText(frame, pose_detector.keypoint_names[i], (x_px + 10, y_px), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 3, cv2.LINE_AA)  # Black outline
                cv2.putText(frame, pose_detector.keypoint_names[i], (x_px + 10, y_px), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 1, cv2.LINE_AA)  # White text
    
    # Add form feedback text if available
    if form_feedback and 'errors' in form_feedback and form_feedback['errors']:
        # Add semi-transparent background for text
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (width, 80), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
        
        y_offset = 30
        for error in form_feedback['errors'][:2]:  # Show only the first 2 errors to avoid cluttering
            cv2.putText(frame, error, (10, y_offset), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 4, cv2.LINE_AA)  # Black outline
            cv2.putText(frame, error, (10, y_offset), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA)  # Red text
            y_offset += 35
    
    # Add overall score if available
    if form_feedback and 'scores' in form_feedback and 'overall' in form_feedback['scores']:
        score = form_feedback['scores']['overall']
        score_text = f"Score: {score:.1f}"
        
        # Add score in top-right corner with background
        text_size = cv2.getTextSize(score_text, cv2.FONT_HERSHEY_SIMPLEX, 1.2, 3)[0]
        cv2.rectangle(frame, (width - text_size[0] - 20, 10), (width - 10, 50), (0, 0, 0), -1)
        
        # Draw score text
        cv2.putText(frame, score_text, (width - text_size[0] - 15, 40), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3, cv2.LINE_AA)
    
    return frame 