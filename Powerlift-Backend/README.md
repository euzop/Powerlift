## Form Analysis System

The PowerLift backend implements a computer vision-based form analysis system for weightlifting exercises. This document explains how the system calculates form scores for different exercises.

## Overview

The form analysis system processes video frames to:

1. Detect the human pose using a pose estimation model
2. Detect the barbell position
3. Track key body landmarks over time
4. Calculate biomechanical metrics for each repetition
5. Score the exercise form based on exercise-specific criteria

## Scoring System

Each exercise is scored on four key metrics:

- **Knee Alignment** (0-100)
- **Spine Alignment** (0-100)
- **Hip Stability** (0-100)
- **Bar Path Efficiency** (0-100)

These are combined into an **Overall Score** (0-100) with different weights depending on the exercise type.

## How Scores Are Calculated

### Knee Alignment Score

The knee alignment score evaluates the proper tracking of the knees relative to the feet and hips during the exercise:

- **Deadlift**: Measures knee angle at the bottom position (should be 110-130°) and tracks lateral knee movement (knees should not cave in)
- **Squat**: Evaluates if knees track over toes without excessive inward/outward movement and measures knee angle at the bottom (should be 90-110°)
- **Bench Press**: Less emphasis on knees, but still tracks stability of leg position

Calculation:
```
knee_score = base_score - deductions

Where:
- base_score starts at 100
- deductions are applied for:
  - Knee angle outside optimal range: -5 to -20 points
  - Lateral knee movement (valgus/varus): -5 to -25 points
  - Asymmetry between left and right knees: -5 to -15 points
```

### Spine Alignment Score

The spine alignment score evaluates the maintenance of a neutral spine position:

- **Deadlift**: Measures lumbar curve and tracks excessive rounding or hyperextension
- **Squat**: Evaluates torso angle and spine curvature throughout the movement
- **Bench Press**: Tracks arching of the back and stability of the torso

Calculation:
```
spine_score = base_score - deductions

Where:
- base_score starts at 100
- deductions are applied for:
  - Excessive lumbar flexion (rounding): -10 to -30 points
  - Hyperextension of spine: -5 to -20 points
  - Lateral flexion (side bending): -5 to -15 points
  - Inconsistent spine position between reps: -5 to -10 points
```

### Hip Stability Score

The hip stability score evaluates hip movement and stability during the exercise:

- **Deadlift**: Tracks hip height at starting position, hip hinge pattern, and symmetry
- **Squat**: Measures hip rotation, depth, and symmetry during descent and ascent
- **Bench Press**: Evaluates hip position on bench and stability throughout the press

Calculation:
```
hip_score = base_score - deductions

Where:
- base_score starts at 100
- deductions are applied for:
  - Asymmetrical hip position: -5 to -20 points
  - Excessive hip rotation: -5 to -15 points
  - Improper hip height at start position: -10 to -25 points
  - Hip shift during movement: -5 to -20 points
```

### Bar Path Efficiency Score

The bar path efficiency score evaluates the movement of the barbell:

- **Deadlift**: Tracks vertical bar path with minimal horizontal deviation
- **Squat**: Measures bar path relative to mid-foot and evaluates consistency
- **Bench Press**: Tracks bar path from rack to chest and back, evaluating straightness and consistency

Calculation:
```
bar_path_score = base_score - deductions

Where:
- base_score starts at 100
- deductions are applied for:
  - Horizontal deviation from ideal path: -5 to -25 points (proportional to deviation)
  - Inconsistent bar path between reps: -5 to -15 points
  - Bar path instability (wobbling): -5 to -15 points
  - Improper bar position relative to body landmarks: -5 to -20 points
```

### Overall Score Calculation

The overall score is a weighted average of the four component scores, with weights varying by exercise type:

**Deadlift**:
```
overall_score = (knee_alignment * 0.2) + (spine_alignment * 0.35) + (hip_stability * 0.25) + (bar_path_efficiency * 0.2)
```

**Squat**:
```
overall_score = (knee_alignment * 0.3) + (spine_alignment * 0.25) + (hip_stability * 0.25) + (bar_path_efficiency * 0.2)
```

**Bench Press**:
```
overall_score = (knee_alignment * 0.1) + (spine_alignment * 0.2) + (hip_stability * 0.2) + (bar_path_efficiency * 0.5)
```

## Technical Implementation

### Pose Estimation

The system uses a machine learning model (based on MediaPipe or a similar framework) to detect 33 key body landmarks in each frame, including:

- Shoulders, elbows, wrists
- Hips, knees, ankles
- Spine landmarks (shoulders to hips)
- Facial landmarks (for head position)

### Barbell Detection

A separate object detection model identifies the barbell and tracks its position in each frame. The system calculates:

- Barbell center point
- Barbell orientation
- Movement path across frames

### Analysis Process

1. **Preprocessing**: Frames are normalized and prepared for analysis
2. **Landmark Detection**: Body pose and barbell are detected in each frame
3. **Repetition Segmentation**: The system identifies individual repetitions
4. **Metric Calculation**: Biomechanical metrics are calculated for each repetition
5. **Scoring**: Each component is scored based on the calculated metrics
6. **Feedback Generation**: The system generates specific feedback based on identified issues

## Real-time Analysis

For real-time analysis, the system:

1. Processes each incoming frame independently
2. Maintains a sliding window of recent frames to track movement patterns
3. Updates scores continuously as new frames arrive
4. Generates immediate feedback for major form issues

## Feedback System

The system provides specific feedback based on detected issues:

- **Critical Issues**: Immediate feedback for potentially dangerous form problems
- **Form Improvements**: Suggestions for better technique
- **Positive Reinforcement**: Recognition of good form elements

## Limitations

The current system has some limitations:

- Requires good lighting conditions for accurate pose estimation
- Works best with clear visibility of the full body
- May have reduced accuracy with loose clothing or unusual body proportions
- Barbell detection works best with standard Olympic barbells

## Future Improvements

Planned improvements include:

- Enhanced barbell tracking for non-standard equipment
- Better handling of occlusions and partial visibility
- Personalized scoring based on individual body proportions
- Integration of additional metrics (velocity, power output, etc.)
- Support for more exercise variations 