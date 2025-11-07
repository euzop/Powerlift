# PowerLift Form Analysis: Technical Implementation

This document provides technical details on how the PowerLift backend implements form analysis for weightlifting exercises.

## System Architecture

The form analysis system consists of several interconnected components:

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│ Video Input │────▶│ Frame Buffer │────▶│ Pose Detector │────▶│ Landmarks   │
└─────────────┘     └──────────────┘     └───────────────┘     └──────┬──────┘
                                                                      │
                                                                      ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│ Score       │◀────│ Form Analyzer│◀────│ Rep Detector  │◀────│ Barbell     │
│ Generator   │     └──────────────┘     └───────────────┘     │ Detector    │
└──────┬──────┘                                                └─────────────┘
       │
       ▼
┌─────────────┐
│ Feedback    │
│ Generator   │
└─────────────┘
```

## Core Technologies

- **Pose Estimation**: MediaPipe Pose model (33 landmarks)
- **Object Detection**: YOLOv5 for barbell detection
- **Movement Analysis**: Custom algorithms for biomechanical analysis
- **Backend Framework**: Python with Flask and Socket.IO for real-time communication

## Implementation Details

### 1. Pose Estimation

The system uses MediaPipe Pose to detect 33 key body landmarks:

```python
import mediapipe as mp

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=2,  # 0, 1, or 2 (highest accuracy)
    smooth_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Process frame
results = pose.process(frame)
landmarks = results.pose_landmarks
```

Key landmarks used for analysis:

- **Shoulders**: landmarks[11], landmarks[12]
- **Elbows**: landmarks[13], landmarks[14]
- **Wrists**: landmarks[15], landmarks[16]
- **Hips**: landmarks[23], landmarks[24]
- **Knees**: landmarks[25], landmarks[26]
- **Ankles**: landmarks[27], landmarks[28]

### 2. Barbell Detection

The system uses YOLOv5 for barbell detection:

```python
import torch

# Load YOLOv5 model
model = torch.hub.load('ultralytics/yolov5', 'custom', path='weights/barbell_detector.pt')

# Detect barbell
results = model(frame)
barbell_boxes = results.xyxy[0].numpy()  # x1, y1, x2, y2, confidence, class
```

### 3. Angle Calculation

Joint angles are calculated using vector mathematics:

```python
def calculate_angle(a, b, c):
    """
    Calculate the angle between three points
    a: first point [x, y]
    b: mid point (vertex) [x, y]
    c: end point [x, y]
    Returns: angle in degrees
    """
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    
    # Create vectors
    ba = a - b
    bc = c - b
    
    # Calculate cosine of angle
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    angle = np.arccos(cosine_angle)
    
    # Convert to degrees
    angle = np.degrees(angle)
    
    return angle
```

### 4. Repetition Detection

Repetitions are detected by tracking the vertical movement of the barbell:

```python
def detect_repetitions(barbell_positions, threshold=0.1):
    """
    Detect repetitions based on barbell vertical movement
    barbell_positions: list of barbell y-coordinates
    threshold: minimum movement to count as significant
    Returns: list of rep start/end indices
    """
    # Smooth the signal
    smoothed = savgol_filter(barbell_positions, window_length=11, polyorder=2)
    
    # Find peaks and valleys
    peaks, _ = find_peaks(smoothed, prominence=threshold)
    valleys, _ = find_peaks(-smoothed, prominence=threshold)
    
    # Pair peaks and valleys to identify reps
    reps = []
    for i in range(len(valleys) - 1):
        # Find peaks between consecutive valleys
        peaks_between = [p for p in peaks if valleys[i] < p < valleys[i+1]]
        if peaks_between:
            rep_peak = max(peaks_between, key=lambda p: smoothed[p])
            reps.append((valleys[i], rep_peak, valleys[i+1]))
    
    return reps
```

### 5. Knee Alignment Calculation

Example of how knee alignment is calculated for squats:

```python
def calculate_knee_alignment_score(landmarks, frame_width):
    """
    Calculate knee alignment score for squat
    landmarks: pose landmarks
    frame_width: width of the video frame
    Returns: knee alignment score (0-100)
    """
    # Extract relevant landmarks
    left_hip = np.array([landmarks[23].x * frame_width, landmarks[23].y * frame_height])
    right_hip = np.array([landmarks[24].x * frame_width, landmarks[24].y * frame_height])
    left_knee = np.array([landmarks[25].x * frame_width, landmarks[25].y * frame_height])
    right_knee = np.array([landmarks[26].x * frame_width, landmarks[26].y * frame_height])
    left_ankle = np.array([landmarks[27].x * frame_width, landmarks[27].y * frame_height])
    right_ankle = np.array([landmarks[28].x * frame_width, landmarks[28].y * frame_height])
    
    # Calculate knee angles
    left_knee_angle = calculate_angle(left_hip, left_knee, left_ankle)
    right_knee_angle = calculate_angle(right_hip, right_knee, right_ankle)
    
    # Calculate knee tracking (knees should track over toes)
    left_knee_deviation = abs(left_knee[0] - left_ankle[0]) / frame_width
    right_knee_deviation = abs(right_knee[0] - right_ankle[0]) / frame_width
    
    # Calculate score
    base_score = 100
    
    # Deduct for knee angles outside optimal range (90-110 degrees for squat)
    if left_knee_angle < 90:
        base_score -= 5 + (90 - left_knee_angle) * 0.5  # More deduction for more extreme angles
    elif left_knee_angle > 110:
        base_score -= 5 + (left_knee_angle - 110) * 0.5
        
    if right_knee_angle < 90:
        base_score -= 5 + (90 - right_knee_angle) * 0.5
    elif right_knee_angle > 110:
        base_score -= 5 + (right_knee_angle - 110) * 0.5
    
    # Deduct for excessive knee deviation (knees not tracking over toes)
    if left_knee_deviation > 0.05:  # 5% of frame width
        base_score -= min(25, left_knee_deviation * 200)  # Max 25 point deduction
        
    if right_knee_deviation > 0.05:
        base_score -= min(25, right_knee_deviation * 200)
    
    # Deduct for asymmetry
    knee_angle_asymmetry = abs(left_knee_angle - right_knee_angle)
    if knee_angle_asymmetry > 10:
        base_score -= min(15, (knee_angle_asymmetry - 10) * 1.5)
    
    return max(0, min(100, base_score))  # Clamp score between 0-100
```

### 6. Spine Alignment Calculation

Example of spine alignment calculation for deadlift:

```python
def calculate_spine_alignment_score(landmarks, frame_height):
    """
    Calculate spine alignment score for deadlift
    landmarks: pose landmarks
    frame_height: height of the video frame
    Returns: spine alignment score (0-100)
    """
    # Extract spine landmarks
    shoulders = np.array([
        (landmarks[11].x + landmarks[12].x) / 2,
        (landmarks[11].y + landmarks[12].y) / 2
    ])
    
    mid_spine = np.array([
        (landmarks[11].x + landmarks[12].x + landmarks[23].x + landmarks[24].x) / 4,
        (landmarks[11].y + landmarks[12].y + landmarks[23].y + landmarks[24].y) / 4
    ])
    
    hips = np.array([
        (landmarks[23].x + landmarks[24].x) / 2,
        (landmarks[23].y + landmarks[24].y) / 2
    ])
    
    # Calculate spine angle (should be relatively straight)
    spine_angle = calculate_angle(shoulders, mid_spine, hips)
    
    # Calculate lateral flexion (side bending)
    left_shoulder = np.array([landmarks[11].x, landmarks[11].y])
    right_shoulder = np.array([landmarks[12].x, landmarks[12].y])
    left_hip = np.array([landmarks[23].x, landmarks[23].y])
    right_hip = np.array([landmarks[24].x, landmarks[24].y])
    
    shoulder_line = right_shoulder - left_shoulder
    hip_line = right_hip - left_hip
    
    shoulder_angle = np.degrees(np.arctan2(shoulder_line[1], shoulder_line[0]))
    hip_angle = np.degrees(np.arctan2(hip_line[1], hip_line[0]))
    lateral_flexion = abs(shoulder_angle - hip_angle)
    
    # Calculate score
    base_score = 100
    
    # Deduct for excessive spine flexion (rounding)
    # In deadlift, spine should be relatively straight (160-180 degrees)
    if spine_angle < 160:
        base_score -= 10 + (160 - spine_angle) * 0.5  # More deduction for more extreme angles
    
    # Deduct for lateral flexion (side bending)
    if lateral_flexion > 5:
        base_score -= min(15, (lateral_flexion - 5) * 1.5)
    
    return max(0, min(100, base_score))  # Clamp score between 0-100
```

### 7. Hip Stability Calculation

Example of hip stability calculation for squat:

```python
def calculate_hip_stability_score(landmarks_sequence, frame_width, frame_height):
    """
    Calculate hip stability score for squat across a sequence of frames
    landmarks_sequence: list of pose landmarks across frames
    frame_width: width of the video frame
    frame_height: height of the video frame
    Returns: hip stability score (0-100)
    """
    # Track hip positions across frames
    left_hip_positions = []
    right_hip_positions = []
    
    for landmarks in landmarks_sequence:
        left_hip = np.array([landmarks[23].x * frame_width, landmarks[23].y * frame_height])
        right_hip = np.array([landmarks[24].x * frame_width, landmarks[24].y * frame_height])
        left_hip_positions.append(left_hip)
        right_hip_positions.append(right_hip)
    
    # Calculate hip rotation (change in distance between hips)
    hip_distances = [np.linalg.norm(right - left) for right, left in zip(right_hip_positions, left_hip_positions)]
    hip_rotation = np.std(hip_distances) / np.mean(hip_distances)
    
    # Calculate hip shift (lateral movement)
    hip_centers = [(left + right) / 2 for left, right in zip(left_hip_positions, right_hip_positions)]
    hip_lateral_movement = np.std([center[0] for center in hip_centers]) / frame_width
    
    # Calculate score
    base_score = 100
    
    # Deduct for excessive hip rotation
    if hip_rotation > 0.05:  # 5% variation
        base_score -= min(15, hip_rotation * 150)
    
    # Deduct for hip shift
    if hip_lateral_movement > 0.02:  # 2% of frame width
        base_score -= min(20, hip_lateral_movement * 500)
    
    return max(0, min(100, base_score))  # Clamp score between 0-100
```

### 8. Bar Path Efficiency Calculation

Example of bar path efficiency calculation:

```python
def calculate_bar_path_efficiency(barbell_positions):
    """
    Calculate bar path efficiency
    barbell_positions: list of barbell positions [(x,y)] across frames
    Returns: bar path efficiency score (0-100)
    """
    # Ideal bar path is straight vertical
    # Calculate horizontal deviation
    x_positions = [pos[0] for pos in barbell_positions]
    x_deviation = np.std(x_positions)
    
    # Calculate smoothness of path
    path_smoothness = 0
    for i in range(2, len(barbell_positions)):
        prev_vector = np.array(barbell_positions[i-1]) - np.array(barbell_positions[i-2])
        curr_vector = np.array(barbell_positions[i]) - np.array(barbell_positions[i-1])
        
        # Normalize vectors
        prev_vector = prev_vector / np.linalg.norm(prev_vector) if np.linalg.norm(prev_vector) > 0 else prev_vector
        curr_vector = curr_vector / np.linalg.norm(curr_vector) if np.linalg.norm(curr_vector) > 0 else curr_vector
        
        # Calculate angle between consecutive movement vectors
        dot_product = np.clip(np.dot(prev_vector, curr_vector), -1.0, 1.0)
        angle = np.arccos(dot_product)
        path_smoothness += angle
    
    path_smoothness = path_smoothness / (len(barbell_positions) - 2) if len(barbell_positions) > 2 else 0
    
    # Calculate score
    base_score = 100
    
    # Deduct for horizontal deviation
    # Normalize by frame width (assuming frame_width = 1.0 for simplicity)
    if x_deviation > 0.01:  # 1% of frame width
        base_score -= min(25, x_deviation * 1000)
    
    # Deduct for path smoothness issues
    # Convert radians to degrees for more intuitive scaling
    path_smoothness_degrees = np.degrees(path_smoothness)
    if path_smoothness_degrees > 5:
        base_score -= min(15, (path_smoothness_degrees - 5) * 1.5)
    
    return max(0, min(100, base_score))  # Clamp score between 0-100
```

### 9. Overall Score Calculation

The overall score is calculated by combining individual component scores with exercise-specific weights:

```python
def calculate_overall_score(knee_score, spine_score, hip_score, bar_path_score, exercise_type):
    """
    Calculate overall score based on component scores and exercise type
    Returns: overall score (0-100)
    """
    if exercise_type == 'deadlift':
        weights = {
            'knee': 0.2,
            'spine': 0.35,
            'hip': 0.25,
            'bar_path': 0.2
        }
    elif exercise_type == 'squat':
        weights = {
            'knee': 0.3,
            'spine': 0.25,
            'hip': 0.25,
            'bar_path': 0.2
        }
    elif exercise_type == 'bench':
        weights = {
            'knee': 0.1,
            'spine': 0.2,
            'hip': 0.2,
            'bar_path': 0.5
        }
    else:
        # Default weights
        weights = {
            'knee': 0.25,
            'spine': 0.25,
            'hip': 0.25,
            'bar_path': 0.25
        }
    
    overall_score = (
        knee_score * weights['knee'] +
        spine_score * weights['spine'] +
        hip_score * weights['hip'] +
        bar_path_score * weights['bar_path']
    )
    
    return max(0, min(100, overall_score))  # Clamp score between 0-100
```

## Real-time Analysis Implementation

The real-time analysis system uses Socket.IO to handle frame streaming and result delivery:

```python
@socketio.on('analyze_frame')
def handle_frame(data):
    """Handle incoming frames for real-time analysis"""
    session_id = request.sid
    
    # Get frame data
    frame_data = data.get('frame', '')
    
    if not frame_data or not frame_data.startswith('data:image'):
        socketio.emit('analysis_error', {'status': 'error', 'message': 'Invalid frame data'}, room=session_id)
        return
    
    try:
        # Process the frame
        image_data = frame_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        
        # Convert to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Add to analysis queue
        analysis_queue.put((session_id, frame))
        
        # If this is the first frame, start worker if not already running
        if not worker_thread.is_alive():
            worker_thread = threading.Thread(target=analysis_worker)
            worker_thread.daemon = True
            worker_thread.start()
            
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
        socketio.emit('analysis_error', {'status': 'error', 'message': str(e)}, room=session_id)
```

The analysis worker processes frames in a separate thread:

```python
def analysis_worker():
    """Worker thread to process frames"""
    while True:
        print(f"Waiting for frame in worker thread (queue size: {analysis_queue.qsize()})...")
        
        try:
            # Get next frame from queue with timeout
            session_id, frame = analysis_queue.get(timeout=1.0)
            
            # Process frame
            results = process_frame(frame, session_id)
            
            # Send results back to client
            socketio.emit('analysis_result', results, room=session_id)
            
            # Mark task as done
            analysis_queue.task_done()
            
        except queue.Empty:
            # No frames in queue, continue waiting
            continue
        except Exception as e:
            print(f"Error in analysis worker: {str(e)}")
            traceback.print_exc()
```

## Performance Optimizations

Several optimizations are implemented to ensure real-time performance:

1. **Frame downsampling**: Reducing resolution before processing
2. **Processing throttling**: Limiting analysis to 10 FPS
3. **Asynchronous processing**: Using a worker thread for analysis
4. **Result caching**: Avoiding redundant calculations for similar frames
5. **Model optimization**: Using optimized versions of ML models

## Visualization Generation

The system generates visualizations to help users understand their form:

```python
def generate_visualization(frame, landmarks, barbell_box, scores):
    """
    Generate visualization with landmarks, barbell, and scores
    Returns: base64 encoded image
    """
    # Create a copy of the frame
    viz_frame = frame.copy()
    
    # Draw pose landmarks
    if landmarks:
        for landmark in landmarks:
            x, y = int(landmark.x * frame.shape[1]), int(landmark.y * frame.shape[0])
            cv2.circle(viz_frame, (x, y), 5, (0, 255, 0), -1)
        
        # Draw connections between landmarks
        connections = mp_pose.POSE_CONNECTIONS
        for connection in connections:
            start_idx, end_idx = connection
            start_point = (int(landmarks[start_idx].x * frame.shape[1]), 
                          int(landmarks[start_idx].y * frame.shape[0]))
            end_point = (int(landmarks[end_idx].x * frame.shape[1]), 
                        int(landmarks[end_idx].y * frame.shape[0]))
            cv2.line(viz_frame, start_point, end_point, (0, 255, 0), 2)
    
    # Draw barbell
    if barbell_box is not None:
        x1, y1, x2, y2 = barbell_box[:4].astype(int)
        cv2.rectangle(viz_frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
        cv2.putText(viz_frame, "Barbell", (x1, y1 - 10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
    
    # Draw scores
    y_pos = 30
    for name, score in scores.items():
        cv2.putText(viz_frame, f"{name}: {score:.1f}", (10, y_pos), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        y_pos += 30
    
    # Convert to base64
    _, buffer = cv2.imencode('.jpg', viz_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
    
    return jpg_as_text
```

## Radar Chart Generation

The system generates radar charts to visualize scores across different metrics:

```python
def generate_radar_chart(scores):
    """
    Generate radar chart for form scores
    scores: dict of component scores
    Returns: base64 encoded image
    """
    # Create radar chart
    categories = list(scores.keys())
    values = list(scores.values())
    
    # Create figure
    fig = plt.figure(figsize=(6, 6))
    ax = fig.add_subplot(111, polar=True)
    
    # Set chart properties
    angles = np.linspace(0, 2*np.pi, len(categories), endpoint=False).tolist()
    values.append(values[0])
    angles.append(angles[0])
    categories.append(categories[0])
    
    # Plot data
    ax.plot(angles, values, 'o-', linewidth=2)
    ax.fill(angles, values, alpha=0.25)
    
    # Set category labels
    ax.set_thetagrids(np.degrees(angles[:-1]), categories[:-1])
    
    # Set radial limits
    ax.set_ylim(0, 100)
    
    # Add title
    plt.title('Form Analysis Scores', size=14)
    
    # Save to buffer
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png')
    buffer.seek(0)
    
    # Convert to base64
    chart_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    plt.close()
    
    return chart_base64
```

## Error Handling

The system implements robust error handling to manage various failure scenarios:

```python
def safe_process_frame(frame, session_id):
    """Process frame with error handling"""
    try:
        return process_frame(frame, session_id)
    except Exception as e:
        print(f"Error processing frame for session {session_id}: {str(e)}")
        traceback.print_exc()
        
        # Return fallback response
        return {
            'status': 'error',
            'message': f'Error processing frame: {str(e)}',
            'scores': {
                'knee_alignment': 0,
                'spine_alignment': 0,
                'hip_stability': 0,
                'bar_path_efficiency': 0,
                'overall': 0
            }
        }
```

## Conclusion

This technical document outlines the implementation details of the PowerLift form analysis system. The system combines computer vision, machine learning, and biomechanical analysis to provide real-time feedback on weightlifting form. 