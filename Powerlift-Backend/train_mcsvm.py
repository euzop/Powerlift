"""
Script to train MCSVM Form Classifier for PowerLift system
Run this to create the initial training model
"""

import os
import sys

# Add the backend path to sys.path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, 'backend')
sys.path.append(backend_dir)

from backend.analyzers.training_data_generator import train_mcsvm_classifier

def main():
    """Train MCSVM classifier for deadlift form analysis"""
    print("🏋️ PowerLift MCSVM Form Classifier Training")
    print("=" * 50)
    
    # Create models directory if it doesn't exist
    models_dir = "models"
    os.makedirs(models_dir, exist_ok=True)
    
    # Train deadlift classifier
    print("\n📊 Training Deadlift Form Classifier...")
    deadlift_classifier = train_mcsvm_classifier(
        exercise_type="deadlift",
        model_output_path="models/deadlift_form_classifier.pkl",
        annotated_data_file=None  # Add path to real annotated data if available
    )
    
    if deadlift_classifier is not None:
        print("✅ Deadlift classifier training completed!")
        
        # Test the classifier with synthetic data
        print("\n🧪 Testing classifier with synthetic data...")
        test_classifier(deadlift_classifier)
    else:
        print("❌ Deadlift classifier training failed!")
    
    # Train squat classifier (optional)
    print("\n📊 Training Squat Form Classifier...")
    squat_classifier = train_mcsvm_classifier(
        exercise_type="squat", 
        model_output_path="models/squat_form_classifier.pkl"
    )
    
    if squat_classifier is not None:
        print("✅ Squat classifier training completed!")
    else:
        print("❌ Squat classifier training failed!")
    
    # Train bench press classifier
    print("\n📊 Training Bench Press Form Classifier...")
    bench_classifier = train_mcsvm_classifier(
        exercise_type="bench",
        model_output_path="models/bench_form_classifier.pkl"
    )
    
    if bench_classifier is not None:
        print("✅ Bench press classifier training completed!")
        
        # Test the classifier with synthetic data
        print("\n🧪 Testing bench press classifier...")
        test_classifier(bench_classifier)
    else:
        print("❌ Bench press classifier training failed!")
    
    print("\n🎉 Training process completed!")
    print("\nNext steps:")
    print("1. Start your PowerLift API server")
    print("2. The MCSVM classifier will automatically load if models are found")
    print("3. Available exercises: deadlift, squat, bench press")
    print("4. Begin analyzing movements to get AI-powered form feedback!")

def test_classifier(classifier):
    """Test the trained classifier with synthetic data"""
    from backend.analyzers.training_data_generator import TrainingDataGenerator
    import numpy as np
    
    # Generate a test sample
    data_generator = TrainingDataGenerator(classifier.exercise_type)
    test_keypoints = data_generator._generate_synthetic_keypoints("excellent_form", num_frames=20)
    
    # Test prediction
    try:
        result = classifier.predict(test_keypoints)
        print(f"   Test Prediction: {result['prediction']}")
        print(f"   Confidence: {result['confidence']:.2f}")
        print(f"   Top 3 Probabilities:")
        sorted_probs = sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)
        for label, prob in sorted_probs[:3]:
            print(f"     {label}: {prob:.3f}")
    except Exception as e:
        print(f"   Test failed: {e}")

if __name__ == "__main__":
    main()
