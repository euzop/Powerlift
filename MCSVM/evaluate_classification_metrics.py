"""
Comprehensive Classification Metrics Evaluation for MCSVM Models
Evaluates accuracy, precision, recall, F1-score, and confusion matrices
"""

import json
import pickle
import numpy as np
from sklearn.metrics import (
    accuracy_score, 
    precision_score, 
    recall_score, 
    f1_score, 
    confusion_matrix, 
    classification_report
)
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import os
import sys

# Add backend path for imports
sys.path.append('../Powerlift-Backend')
from backend.analyzers.mcsvm_form_classifier import PowerliftFormClassifier

class ClassificationMetricsEvaluator:
    def __init__(self):
        self.exercises = ['deadlift', 'squat', 'bench']
        self.models_path = "../Powerlift-Backend/models"
        self.feedback_path = "../Powerlift-Backend/user_feedback_enhanced.json"
        self.results = {}
        
    def load_feedback_data(self):
        """Load user feedback data for evaluation"""
        print("📊 Loading user feedback data...")
        try:
            with open(self.feedback_path, 'r') as f:
                feedback_data = json.load(f)
            print(f"✅ Loaded {len(feedback_data)} feedback entries")
            return feedback_data
        except Exception as e:
            print(f"❌ Error loading feedback data: {e}")
            return []
    
    def load_model(self, exercise_type):
        """Load MCSVM model for specific exercise"""
        model_path = os.path.join(self.models_path, f"{exercise_type}_form_classifier.pkl")
        try:
            classifier = PowerliftFormClassifier(exercise_type)
            with open(model_path, 'rb') as f:
                model_data = pickle.load(f)
                classifier.classifier = model_data['classifier']
                classifier.scaler = model_data['scaler'] 
                classifier.label_encoder = model_data['label_encoder']
                classifier.feature_names = model_data.get('feature_names', [])
                classifier.is_trained = True
            print(f"✅ Loaded {exercise_type} model")
            return classifier
        except Exception as e:
            print(f"❌ Error loading {exercise_type} model: {e}")
            return None
    
    def prepare_test_data(self, feedback_data, exercise_type):
        """Prepare test data for specific exercise"""
        exercise_data = [entry for entry in feedback_data if entry['exercise_type'] == exercise_type]
        
        if not exercise_data:
            return [], []
        
        features = []
        true_labels = []
        
        for entry in exercise_data:
            features.append(entry['frame_features'])
            true_labels.append(entry['correct_form'])
        
        return np.array(features), true_labels
    
    def evaluate_model(self, exercise_type, classifier, X_test, y_true):
        """Evaluate model and calculate all classification metrics"""
        print(f"\n🔍 Evaluating {exercise_type} model...")
        
        try:
            # Make predictions
            y_pred = classifier.predict(X_test)
            y_pred_proba = classifier.predict_proba(X_test)
            
            # Calculate metrics
            accuracy = accuracy_score(y_true, y_pred)
            
            # Handle multi-class metrics
            precision = precision_score(y_true, y_pred, average='weighted', zero_division=0)
            recall = recall_score(y_true, y_pred, average='weighted', zero_division=0)
            f1 = f1_score(y_true, y_pred, average='weighted', zero_division=0)
            
            # Per-class metrics
            precision_per_class = precision_score(y_true, y_pred, average=None, zero_division=0)
            recall_per_class = recall_score(y_true, y_pred, average=None, zero_division=0)
            f1_per_class = f1_score(y_true, y_pred, average=None, zero_division=0)
            
            # Confusion matrix
            cm = confusion_matrix(y_true, y_pred)
            
            # Classification report
            class_report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)
            
            # Get unique labels for proper indexing
            unique_labels = sorted(list(set(y_true + y_pred)))
            
            results = {
                'exercise': exercise_type,
                'test_samples': len(y_true),
                'accuracy': accuracy,
                'precision_weighted': precision,
                'recall_weighted': recall,
                'f1_weighted': f1,
                'precision_per_class': dict(zip(unique_labels, precision_per_class)),
                'recall_per_class': dict(zip(unique_labels, recall_per_class)),
                'f1_per_class': dict(zip(unique_labels, f1_per_class)),
                'confusion_matrix': cm.tolist(),
                'confusion_matrix_labels': unique_labels,
                'classification_report': class_report,
                'predictions': y_pred,
                'true_labels': y_true,
                'prediction_probabilities': y_pred_proba.tolist() if y_pred_proba is not None else None
            }
            
            # Print summary
            print(f"📈 Results for {exercise_type}:")
            print(f"   Test samples: {len(y_true)}")
            print(f"   Accuracy: {accuracy:.3f} ({accuracy*100:.1f}%)")
            print(f"   Precision (weighted): {precision:.3f}")
            print(f"   Recall (weighted): {recall:.3f}")
            print(f"   F1-Score (weighted): {f1:.3f}")
            
            return results
            
        except Exception as e:
            print(f"❌ Error evaluating {exercise_type}: {e}")
            return None
    
    def create_confusion_matrix_plot(self, cm, labels, exercise_type):
        """Create confusion matrix visualization"""
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                   xticklabels=labels, yticklabels=labels)
        plt.title(f'Confusion Matrix - {exercise_type.title()}')
        plt.xlabel('Predicted')
        plt.ylabel('Actual')
        plt.tight_layout()
        
        # Save plot
        plot_path = f"confusion_matrix_{exercise_type}.png"
        plt.savefig(plot_path, dpi=300, bbox_inches='tight')
        print(f"💾 Saved confusion matrix plot: {plot_path}")
        plt.close()
    
    def create_metrics_summary_plot(self):
        """Create summary plot of all metrics"""
        exercises = list(self.results.keys())
        metrics = ['accuracy', 'precision_weighted', 'recall_weighted', 'f1_weighted']
        
        fig, axes = plt.subplots(2, 2, figsize=(12, 10))
        fig.suptitle('Classification Metrics Summary', fontsize=16)
        
        for i, metric in enumerate(metrics):
            ax = axes[i//2, i%2]
            values = [self.results[ex][metric] for ex in exercises]
            bars = ax.bar(exercises, values, color=['#2E86AB', '#A23B72', '#F18F01'])
            ax.set_title(metric.replace('_', ' ').title())
            ax.set_ylim(0, 1)
            
            # Add value labels on bars
            for bar, value in zip(bars, values):
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height + 0.01,
                       f'{value:.3f}', ha='center', va='bottom')
        
        plt.tight_layout()
        plt.savefig("classification_metrics_summary.png", dpi=300, bbox_inches='tight')
        print("💾 Saved metrics summary plot: classification_metrics_summary.png")
        plt.close()
    
    def print_detailed_report(self):
        """Print detailed classification report"""
        print("\n" + "="*80)
        print("📊 DETAILED CLASSIFICATION METRICS REPORT")
        print("="*80)
        
        for exercise in self.exercises:
            if exercise not in self.results:
                continue
                
            result = self.results[exercise]
            print(f"\n🏋️ {exercise.upper()} CLASSIFICATION METRICS:")
            print("-" * 50)
            print(f"Test Samples: {result['test_samples']}")
            print(f"Accuracy: {result['accuracy']:.4f} ({result['accuracy']*100:.2f}%)")
            print(f"Precision (weighted): {result['precision_weighted']:.4f}")
            print(f"Recall (weighted): {result['recall_weighted']:.4f}")
            print(f"F1-Score (weighted): {result['f1_weighted']:.4f}")
            
            print(f"\n📋 Per-Class Metrics:")
            for class_name in result['confusion_matrix_labels']:
                if class_name in result['precision_per_class']:
                    prec = result['precision_per_class'][class_name]
                    rec = result['recall_per_class'][class_name]
                    f1 = result['f1_per_class'][class_name]
                    print(f"  {class_name:18} - Precision: {prec:.3f}, Recall: {rec:.3f}, F1: {f1:.3f}")
            
            print(f"\n🔢 Confusion Matrix:")
            cm = np.array(result['confusion_matrix'])
            labels = result['confusion_matrix_labels']
            
            # Print header
            print("     " + "".join([f"{label:>12}" for label in labels]))
            for i, label in enumerate(labels):
                row = "".join([f"{cm[i][j]:>12}" for j in range(len(labels))])
                print(f"{label:>4} {row}")
    
    def save_results(self):
        """Save detailed results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"classification_metrics_{timestamp}.json"
        
        # Convert numpy arrays to lists for JSON serialization
        serializable_results = {}
        for exercise, result in self.results.items():
            serializable_results[exercise] = {
                **result,
                'confusion_matrix': [[int(x) for x in row] for row in result['confusion_matrix']]
            }
        
        with open(filename, 'w') as f:
            json.dump(serializable_results, f, indent=2)
        
        print(f"\n💾 Detailed results saved to: {filename}")
        return filename
    
    def run_full_evaluation(self):
        """Run complete evaluation pipeline"""
        print("🚀 Starting Comprehensive Classification Metrics Evaluation")
        print("="*70)
        
        # Load feedback data
        feedback_data = self.load_feedback_data()
        if not feedback_data:
            print("❌ No feedback data available for evaluation")
            return
        
        # Evaluate each exercise
        for exercise in self.exercises:
            print(f"\n🏋️ Processing {exercise}...")
            
            # Load model
            classifier = self.load_model(exercise)
            if not classifier:
                print(f"⚠️ Skipping {exercise} - model not available")
                continue
            
            # Prepare test data
            X_test, y_true = self.prepare_test_data(feedback_data, exercise)
            if len(X_test) == 0:
                print(f"⚠️ No test data available for {exercise}")
                continue
            
            # Evaluate model
            result = self.evaluate_model(exercise, classifier, X_test, y_true)
            if result:
                self.results[exercise] = result
                
                # Create confusion matrix plot
                cm = np.array(result['confusion_matrix'])
                labels = result['confusion_matrix_labels']
                self.create_confusion_matrix_plot(cm, labels, exercise)
        
        if not self.results:
            print("❌ No models could be evaluated")
            return
        
        # Create summary visualizations
        self.create_metrics_summary_plot()
        
        # Print detailed report
        self.print_detailed_report()
        
        # Save results
        results_file = self.save_results()
        
        print(f"\n✅ Evaluation Complete!")
        print(f"📊 Evaluated {len(self.results)} models")
        print(f"📁 Results saved to: {results_file}")
        print(f"📈 Visualizations created:")
        for exercise in self.results:
            print(f"   - confusion_matrix_{exercise}.png")
        print(f"   - classification_metrics_summary.png")

def main():
    """Run classification metrics evaluation"""
    evaluator = ClassificationMetricsEvaluator()
    evaluator.run_full_evaluation()

if __name__ == "__main__":
    main()
