"""
TensorFlow Lite Model Diagnostic Script
Analyzes the pose detection model to understand input/output specifications
and test keypoint detection accuracy.
"""

import tensorflow as tf
import numpy as np
import cv2
import json

def analyze_tflite_model(model_path):
    """Analyze the TensorFlow Lite model specifications"""
    print(f"=== Analyzing TFLite Model: {model_path} ===\n")
    
    try:
        # Load the TFLite model
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()
        
        # Get input details
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        print("INPUT SPECIFICATIONS:")
        print("-" * 50)
        for i, input_detail in enumerate(input_details):
            print(f"Input {i}:")
            print(f"  Name: {input_detail['name']}")
            print(f"  Shape: {input_detail['shape']}")
            print(f"  Type: {input_detail['dtype']}")
            print(f"  Quantization: {input_detail['quantization']}")
            print()
        
        print("OUTPUT SPECIFICATIONS:")
        print("-" * 50)
        for i, output_detail in enumerate(output_details):
            print(f"Output {i}:")
            print(f"  Name: {output_detail['name']}")
            print(f"  Shape: {output_detail['shape']}")
            print(f"  Type: {output_detail['dtype']}")
            print(f"  Quantization: {output_detail['quantization']}")
            print()
        
        return interpreter, input_details, output_details
        
    except Exception as e:
        print(f"Error loading model: {str(e)}")
        return None, None, None

def test_model_with_dummy_input(interpreter, input_details, output_details):
    """Test the model with a dummy input to understand output format"""
    print("=== Testing Model with Dummy Input ===\n")
    
    try:
        # Create dummy input based on model specifications
        input_shape = input_details[0]['shape']
        input_type = input_details[0]['dtype']
        
        print(f"Creating dummy input with shape: {input_shape}, type: {input_type}")
        
        # Create a dummy image (solid color for testing)
        if input_type == np.float32:
            # MoveNet typically expects normalized input [-1, 1]
            dummy_input = np.ones(input_shape, dtype=np.float32) * 0.5
        else:
            # For uint8 models
            dummy_input = np.ones(input_shape, dtype=input_type) * 128
        
        # Set input tensor
        interpreter.set_tensor(input_details[0]['index'], dummy_input)
        
        # Run inference
        interpreter.invoke()
        
        # Get output
        output = interpreter.get_tensor(output_details[0]['index'])
        
        print(f"Output shape: {output.shape}")
        print(f"Output type: {output.dtype}")
        print(f"Output range: [{np.min(output):.4f}, {np.max(output):.4f}]")
        
        # Analyze output structure for pose detection
        if len(output.shape) >= 3:
            print(f"Detected format: Batch x Keypoints x Values")
            print(f"Number of keypoints: {output.shape[-2] if len(output.shape) >= 2 else 'Unknown'}")
            print(f"Values per keypoint: {output.shape[-1] if len(output.shape) >= 1 else 'Unknown'}")
            
            # Squeeze to remove batch dimension
            squeezed = np.squeeze(output)
            print(f"Squeezed shape: {squeezed.shape}")
            
            if len(squeezed.shape) == 2 and squeezed.shape[1] == 3:
                print("✓ Format appears to be [keypoint_index, [y, x, confidence]]")
                
                # Show sample keypoints
                print("\nSample keypoints (first 5):")
                for i in range(min(5, squeezed.shape[0])):
                    y, x, conf = squeezed[i]
                    print(f"  Keypoint {i}: y={y:.4f}, x={x:.4f}, confidence={conf:.4f}")
                    
            elif len(squeezed.shape) == 1:
                print("✓ Format appears to be flattened keypoints")
                expected_keypoints = squeezed.shape[0] // 3
                print(f"Expected number of keypoints: {expected_keypoints}")
        
        return output
        
    except Exception as e:
        print(f"Error testing model: {str(e)}")
        return None

def compare_with_expected_keypoints():
    """Compare with expected MoveNet keypoint structure"""
    print("=== Expected MoveNet Keypoint Structure ===\n")
    
    expected_keypoints = [
        'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
        'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
        'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
    ]
    
    print(f"Expected keypoints ({len(expected_keypoints)}):")
    for i, name in enumerate(expected_keypoints):
        print(f"  {i:2d}: {name}")
    
    print(f"\nExpected output format: [batch, {len(expected_keypoints)}, 3]")
    print("Where each keypoint has: [y_normalized, x_normalized, confidence]")
    print("Coordinates are normalized to [0, 1] relative to image dimensions")

def diagnose_coordinate_system():
    """Diagnose potential coordinate system issues"""
    print("\n=== Potential Issues & Solutions ===\n")
    
    issues_and_solutions = [
        {
            "issue": "Keypoints appear in wrong positions",
            "causes": [
                "Coordinate system mismatch (y,x vs x,y)",
                "Normalization issues (coordinates not in [0,1] range)",
                "Input preprocessing problems (wrong scaling/normalization)"
            ],
            "solutions": [
                "Check if coordinates need to be swapped (y,x ↔ x,y)",
                "Verify input image preprocessing matches model expectations",
                "Ensure confidence threshold is appropriate (try 0.1-0.3)",
                "Check if model expects specific input format (RGB vs BGR)"
            ]
        },
        {
            "issue": "Low confidence scores",
            "causes": [
                "Wrong input preprocessing",
                "Model expects different input range",
                "Image quality or lighting issues"
            ],
            "solutions": [
                "Verify input normalization: [-1,1] vs [0,1] vs [0,255]",
                "Check input image format and color space",
                "Try different confidence thresholds"
            ]
        },
        {
            "issue": "Keypoints off by consistent offset",
            "causes": [
                "Input image resizing issues",
                "Coordinate denormalization problems"
            ],
            "solutions": [
                "Check image resizing method and aspect ratio preservation",
                "Verify coordinate conversion from normalized to pixel space"
            ]
        }
    ]
    
    for i, item in enumerate(issues_and_solutions, 1):
        print(f"{i}. {item['issue']}")
        print("   Possible causes:")
        for cause in item['causes']:
            print(f"     • {cause}")
        print("   Solutions:")
        for solution in item['solutions']:
            print(f"     ✓ {solution}")
        print()

if __name__ == "__main__":
    model_path = r"c:\Users\euzop\Downloads\Powerlift Final\Powerlift-Backend\singlepose-thunder-tflite-float16.tflite"
    
    # Analyze model specifications
    interpreter, input_details, output_details = analyze_tflite_model(model_path)
    
    if interpreter is not None:
        # Test with dummy input
        output = test_model_with_dummy_input(interpreter, input_details, output_details)
        
        # Show expected keypoint structure
        compare_with_expected_keypoints()
        
        # Diagnose potential issues
        diagnose_coordinate_system()
    
    print("=== Diagnosis Complete ===")
