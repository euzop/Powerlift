"""
MCSVM Model Evaluation Script for PowerLift System
Calculates MAE and MAPE metrics using enhanced feedback data
"""

import os
import sys
import json
import numpy as np
from sklearn.metrics import mean_absolute_error, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
import joblib
from datetime import datetime

# Add backend path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, 'backend')
sys.path.append(backend_dir)

try:
    from backend.analyzers.mcsvm_form_classifier import PowerliftFormClassifier
except ImportError as e:
    print(f"Warning: Could not import PowerliftFormClassifier: {e}")
    print("Using basic evaluation without classifier features")

class MCSVMEvaluator:
    def __init__(self):
        self.feedback_file = "user_feedback_enhanced.json"
        self.models_dir = "models"
        self.results_dir = "evaluation_results"
        os.makedirs(self.results_dir, exist_ok=True)
        
        # Label mappings for evaluation
        self.label_mappings = {
            "deadlift": ["excellent_form", "rounded_back", "knee_valgus", "forward_lean", "uneven_hips", "bar_drift", "poor_lockout"],
            "squat": ["excellent_form", "knee_valgus", "forward_lean", "butt_wink", "uneven_depth", "heel_lift", "weight_shift"],
            "bench": ["excellent_form", "elbow_flare", "arch_excessive", "uneven_press", "shoulder_impingement", "bar_path_error", "partial_range"]
        }
        
        # Simplified mapping for feedback data
        self.feedback_mappings = {
            "Good": "excellent_form",
            "Needs Improvement": "needs_improvement",
            "Poor": "poor_form"
        }
        
    def load_feedback_data(self, exercise_type):
        """Load and prepare feedback data for evaluation"""
        try:
            if not os.path.exists(self.feedback_file):
                print(f"❌ Feedback file not found: {self.feedback_file}")
                return None, None
                
            with open(self.feedback_file, 'r') as f:
                feedback_data = json.load(f)
            
            # Filter for exercise type
            exercise_feedback = [entry for entry in feedback_data 
                               if entry.get('exercise_type') == exercise_type]
            
            if len(exercise_feedback) < 10:
                print(f"❌ Insufficient feedback data for {exercise_type}: {len(exercise_feedback)} entries")
                return None, None
            
            # Extract features and labels
            X = []
            y_true = []
            y_pred = []
            
            for entry in exercise_feedback:
                features = entry.get('frame_features', [])
                predicted = entry.get('predicted_form', '')
                correct = entry.get('correct_form', '')
                
                if features and len(features) > 0 and predicted and correct:
                    X.append(features)
                    y_pred.append(predicted)
                    y_true.append(correct)
            
            print(f"📊 Loaded {len(X)} valid feedback samples for {exercise_type}")
            print(f"📊 Unique predicted labels: {set(y_pred)}")
            print(f"📊 Unique true labels: {set(y_true)}")
            
            return np.array(X), np.array(y_true), np.array(y_pred)
            
        except Exception as e:
            print(f"❌ Error loading feedback data: {e}")
            return None, None, None
    
    def load_model_with_encoder(self, exercise_type):
        """Load complete model with label encoder"""
        try:
            model_path = os.path.join(self.models_dir, f"{exercise_type}_form_classifier.pkl")
            if not os.path.exists(model_path):
                return None
            return joblib.load(model_path)
        except Exception as e:
            print(f"Warning: Could not load full model data: {e}")
            return None
    
    def load_model(self, exercise_type):
        """Load trained MCSVM model"""
        try:
            model_path = os.path.join(self.models_dir, f"{exercise_type}_form_classifier.pkl")
            if not os.path.exists(model_path):
                print(f"❌ Model not found: {model_path}")
                return None
                
            model_data = joblib.load(model_path)
                
            # Extract the classifier and scaler
            if isinstance(model_data, dict):
                classifier = model_data.get('classifier')
                scaler = model_data.get('scaler')
                feature_names = model_data.get('feature_names', [])
            else:
                # Assume it's just the classifier
                classifier = model_data
                scaler = None
                feature_names = []
            
            print(f"✅ Loaded model for {exercise_type}")
            print(f"📊 Model type: {type(classifier)}")
            if scaler:
                print(f"📊 Scaler available: {type(scaler)}")
            
            return {
                'classifier': classifier,
                'scaler': scaler,
                'feature_names': feature_names
            }
            
        except Exception as e:
            print(f"❌ Error loading model for {exercise_type}: {e}")
            return None
    
    def evaluate_model_predictions(self, exercise_type):
        """Evaluate model using cross-validation on feedback data"""
        print(f"\n🔍 Evaluating {exercise_type} model...")
        
        # Load feedback data
        result = self.load_feedback_data(exercise_type)
        if result[0] is None:
            return None
            
        X, y_true, y_pred_original = result
        
        # Load trained model
        model_data = self.load_model(exercise_type)
        if not model_data:
            return None
            
        classifier = model_data['classifier']
        scaler = model_data['scaler']
        
        # Make predictions with loaded model
        try:
            X_scaled = scaler.transform(X) if scaler else X
            y_pred_encoded = classifier.predict(X_scaled)
            
            # Need to decode the predictions to string labels
            model_data_full = self.load_model_with_encoder(exercise_type)
            if model_data_full and 'label_encoder' in model_data_full:
                label_encoder = model_data_full['label_encoder']
                y_pred_model = label_encoder.inverse_transform(y_pred_encoded)
            else:
                # Fallback: assume encoded predictions correspond to sorted unique labels
                unique_labels = sorted(list(set(y_true)))
                label_mapping = {i: label for i, label in enumerate(unique_labels)}
                y_pred_model = [label_mapping.get(pred, 'unknown') for pred in y_pred_encoded]
            
            # Get prediction probabilities if available
            if hasattr(classifier, 'predict_proba'):
                y_proba = classifier.predict_proba(X_scaled)
                confidence_scores = np.max(y_proba, axis=1)
            else:
                confidence_scores = np.ones(len(y_pred_model))  # Default confidence
            
        except Exception as e:
            print(f"❌ Error making predictions: {e}")
            return None
        
        # Calculate metrics
        results = {}
        
        # Accuracy between model predictions and true labels
        model_accuracy = np.mean(y_pred_model == y_true)
        results['model_accuracy'] = model_accuracy
        
        # Original prediction accuracy (from feedback data)
        original_accuracy = np.mean(y_pred_original == y_true)
        results['original_accuracy'] = original_accuracy
        
        # Improvement
        results['accuracy_improvement'] = model_accuracy - original_accuracy
        
        # Classification report
        unique_labels = list(set(y_true) | set(y_pred_model))
        results['classification_report'] = classification_report(
            y_true, y_pred_model, labels=unique_labels, output_dict=True, zero_division=0
        )
        
        # Confusion matrix
        results['confusion_matrix'] = confusion_matrix(
            y_true, y_pred_model, labels=unique_labels
        ).tolist()
        results['confusion_matrix_labels'] = unique_labels
        
        # Mean confidence score
        results['mean_confidence'] = float(np.mean(confidence_scores))
        
        # Sample distribution
        results['sample_counts'] = {
            'total_samples': len(X),
            'true_label_distribution': {label: int(np.sum(y_true == label)) for label in unique_labels},
            'predicted_label_distribution': {label: int(np.sum(y_pred_model == label)) for label in unique_labels}
        }
        
        return results
    
    def calculate_performance_metrics(self, y_true, y_pred, y_proba=None):
        """Calculate detailed performance metrics"""
        metrics = {}
        
        # Basic accuracy
        metrics['accuracy'] = np.mean(y_true == y_pred)
        
        # For numeric conversion of labels (if possible)
        try:
            # Convert labels to numeric for MAE calculation
            unique_labels = sorted(list(set(y_true) | set(y_pred)))
            label_to_num = {label: i for i, label in enumerate(unique_labels)}
            
            y_true_numeric = np.array([label_to_num[label] for label in y_true])
            y_pred_numeric = np.array([label_to_num[label] for label in y_pred])
            
            # MAE and MAPE
            mae = mean_absolute_error(y_true_numeric, y_pred_numeric)
            mape = np.mean(np.abs((y_true_numeric - y_pred_numeric) / (y_true_numeric + 1e-10))) * 100
            
            metrics['mae'] = mae
            metrics['mape'] = mape
            metrics['label_mapping'] = label_to_num
            
        except Exception as e:
            print(f"Warning: Could not calculate MAE/MAPE: {e}")
            metrics['mae'] = None
            metrics['mape'] = None
        
        return metrics
    
    def run_comprehensive_evaluation(self):
        """Run evaluation for all exercises"""
        print("🚀 PowerLift MCSVM Model Evaluation")
        print("=" * 60)
        
        exercises = ['deadlift', 'squat', 'bench']
        all_results = {}
        
        for exercise in exercises:
            print(f"\n📋 Evaluating {exercise.upper()} Model")
            print("-" * 40)
            
            results = self.evaluate_model_predictions(exercise)
            if results:
                all_results[exercise] = results
                
                # Print summary
                print(f"✅ Model Accuracy: {results['model_accuracy']:.3f}")
                print(f"📊 Original Accuracy: {results['original_accuracy']:.3f}")
                print(f"📈 Improvement: {results['accuracy_improvement']:.3f}")
                print(f"🎯 Mean Confidence: {results['mean_confidence']:.3f}")
                print(f"📊 Total Samples: {results['sample_counts']['total_samples']}")
                
                # Calculate performance metrics
                # We need to extract y_true and y_pred from the feedback data again
                feedback_result = self.load_feedback_data(exercise)
                if feedback_result[0] is not None:
                    _, y_true, y_pred_original = feedback_result
                    
                    # Load model and make predictions
                    model_data = self.load_model(exercise)
                    if model_data:
                        classifier = model_data['classifier']
                        scaler = model_data['scaler']
                        X = feedback_result[0]
                        
                        try:
                            X_scaled = scaler.transform(X) if scaler else X
                            y_pred_model = classifier.predict(X_scaled)
                            
                            # Calculate MAE/MAPE
                            perf_metrics = self.calculate_performance_metrics(y_true, y_pred_model)
                            results.update(perf_metrics)
                            
                            if perf_metrics.get('mae') is not None:
                                print(f"📊 MAE: {perf_metrics['mae']:.3f}")
                                print(f"📊 MAPE: {perf_metrics['mape']:.2f}%")
                                
                        except Exception as e:
                            print(f"Warning: Could not calculate MAE/MAPE for {exercise}: {e}")
            else:
                print(f"❌ Evaluation failed for {exercise}")
        
        # Save comprehensive results
        results_file = os.path.join(self.results_dir, f"evaluation_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        with open(results_file, 'w') as f:
            json.dump(all_results, f, indent=2, default=str)
        
        print(f"\n💾 Results saved to: {results_file}")
        
        # Print summary
        print(f"\n📊 EVALUATION SUMMARY")
        print("=" * 50)
        for exercise, results in all_results.items():
            if results:
                print(f"{exercise.upper():>10}: Accuracy={results['model_accuracy']:.3f}, "
                      f"Samples={results['sample_counts']['total_samples']}")
        
        return all_results

def main():
    """Main evaluation function"""
    evaluator = MCSVMEvaluator()
    evaluator.run_comprehensive_evaluation()

if __name__ == "__main__":
    main()
