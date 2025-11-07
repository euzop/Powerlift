"""
Simple Classification Metrics Evaluation Based on Feedback Data
Calculates accuracy, precision, recall, F1-score, and confusion matrices
"""

import json
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
from collections import Counter

class FeedbackBasedMetricsEvaluator:
    def __init__(self):
        self.exercises = ['deadlift', 'squat', 'bench']
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
    
    def extract_predictions_and_labels(self, feedback_data, exercise_type):
        """Extract predictions and true labels from feedback data"""
        exercise_data = [entry for entry in feedback_data if entry['exercise_type'] == exercise_type]
        
        if not exercise_data:
            return [], []
        
        y_pred = [entry['predicted_form'] for entry in exercise_data]
        y_true = [entry['correct_form'] for entry in exercise_data]
        
        return y_pred, y_true
    
    def calculate_metrics(self, y_true, y_pred, exercise_type):
        """Calculate all classification metrics"""
        print(f"\n🔍 Calculating metrics for {exercise_type}...")
        
        try:
            # Basic metrics
            accuracy = accuracy_score(y_true, y_pred)
            
            # Get unique labels
            unique_labels = sorted(list(set(y_true + y_pred)))
            
            # Handle multi-class metrics with zero_division
            precision_weighted = precision_score(y_true, y_pred, average='weighted', zero_division=0)
            recall_weighted = recall_score(y_true, y_pred, average='weighted', zero_division=0)
            f1_weighted = f1_score(y_true, y_pred, average='weighted', zero_division=0)
            
            # Per-class metrics
            precision_per_class = precision_score(y_true, y_pred, average=None, zero_division=0, labels=unique_labels)
            recall_per_class = recall_score(y_true, y_pred, average=None, zero_division=0, labels=unique_labels)
            f1_per_class = f1_score(y_true, y_pred, average=None, zero_division=0, labels=unique_labels)
            
            # Convert arrays to lists for dict creation
            precision_dict = {label: float(prec) for label, prec in zip(unique_labels, precision_per_class)}
            recall_dict = {label: float(rec) for label, rec in zip(unique_labels, recall_per_class)}
            f1_dict = {label: float(f1) for label, f1 in zip(unique_labels, f1_per_class)}
            
            # Confusion matrix
            cm = confusion_matrix(y_true, y_pred, labels=unique_labels)
            
            # Classification report
            class_report = classification_report(y_true, y_pred, labels=unique_labels, 
                                               output_dict=True, zero_division=0)
            
            # Calculate additional statistics
            total_samples = len(y_true)
            correct_predictions = sum(1 for i in range(len(y_true)) if y_true[i] == y_pred[i])
            
            # Form distribution
            true_distribution = Counter(y_true)
            pred_distribution = Counter(y_pred)
            
            results = {
                'exercise': exercise_type,
                'total_samples': total_samples,
                'correct_predictions': correct_predictions,
                'accuracy': accuracy,
                'precision_weighted': precision_weighted,
                'recall_weighted': recall_weighted,
                'f1_weighted': f1_weighted,
                'precision_per_class': precision_dict,
                'recall_per_class': recall_dict,
                'f1_per_class': f1_dict,
                'confusion_matrix': cm.tolist(),
                'confusion_matrix_labels': unique_labels,
                'classification_report': class_report,
                'true_distribution': dict(true_distribution),
                'pred_distribution': dict(pred_distribution),
                'predictions': y_pred,
                'true_labels': y_true
            }
            
            # Print summary
            print(f"📈 Results for {exercise_type}:")
            print(f"   Total samples: {total_samples}")
            print(f"   Correct predictions: {correct_predictions}")
            print(f"   Accuracy: {accuracy:.3f} ({accuracy*100:.1f}%)")
            print(f"   Precision (weighted): {precision_weighted:.3f}")
            print(f"   Recall (weighted): {recall_weighted:.3f}")
            print(f"   F1-Score (weighted): {f1_weighted:.3f}")
            
            return results
            
        except Exception as e:
            print(f"❌ Error calculating metrics for {exercise_type}: {e}")
            return None
    
    def create_confusion_matrix_plot(self, cm, labels, exercise_type):
        """Create confusion matrix visualization"""
        plt.figure(figsize=(10, 8))
        
        # Create heatmap with better formatting
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                   xticklabels=labels, yticklabels=labels,
                   cbar_kws={'label': 'Count'},
                   linewidths=0.5)
        
        plt.title(f'Confusion Matrix - {exercise_type.title()} Form Classification', 
                 fontsize=14, fontweight='bold')
        plt.xlabel('Predicted Form', fontsize=12)
        plt.ylabel('Actual Form', fontsize=12)
        
        # Rotate labels if needed
        plt.xticks(rotation=45, ha='right')
        plt.yticks(rotation=0)
        
        plt.tight_layout()
        
        # Save plot
        plot_path = f"confusion_matrix_{exercise_type}.png"
        plt.savefig(plot_path, dpi=300, bbox_inches='tight')
        print(f"💾 Saved confusion matrix plot: {plot_path}")
        plt.close()
    
    def create_metrics_comparison_plot(self):
        """Create comparison plot of metrics across exercises"""
        if not self.results:
            return
            
        exercises = list(self.results.keys())
        metrics = ['accuracy', 'precision_weighted', 'recall_weighted', 'f1_weighted']
        metric_names = ['Accuracy', 'Precision', 'Recall', 'F1-Score']
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle('Classification Metrics Comparison Across Exercises', fontsize=16, fontweight='bold')
        
        colors = ['#1f77b4', '#ff7f0e', '#2ca02c']  # Blue, Orange, Green
        
        for i, (metric, name) in enumerate(zip(metrics, metric_names)):
            ax = axes[i//2, i%2]
            values = [self.results[ex][metric] for ex in exercises]
            
            bars = ax.bar(exercises, values, color=colors[:len(exercises)], alpha=0.8, edgecolor='black')
            ax.set_title(f'{name} by Exercise', fontweight='bold')
            ax.set_ylim(0, 1.1)
            ax.set_ylabel(name)
            
            # Add value labels on bars
            for bar, value in zip(bars, values):
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height + 0.02,
                       f'{value:.3f}', ha='center', va='bottom', fontweight='bold')
            
            # Add grid
            ax.grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        plt.savefig("classification_metrics_comparison.png", dpi=300, bbox_inches='tight')
        print("💾 Saved metrics comparison plot: classification_metrics_comparison.png")
        plt.close()
    
    def create_form_distribution_plot(self):
        """Create form distribution comparison plot"""
        if not self.results:
            return
            
        fig, axes = plt.subplots(len(self.results), 2, figsize=(15, 5*len(self.results)))
        if len(self.results) == 1:
            axes = axes.reshape(1, -1)
        
        fig.suptitle('Form Distribution: Actual vs Predicted', fontsize=16, fontweight='bold')
        
        for i, (exercise, result) in enumerate(self.results.items()):
            # Actual distribution
            ax1 = axes[i, 0]
            true_dist = result['true_distribution']
            forms = list(true_dist.keys())
            counts = list(true_dist.values())
            
            bars1 = ax1.bar(forms, counts, color='skyblue', alpha=0.8, edgecolor='black')
            ax1.set_title(f'{exercise.title()} - Actual Form Distribution')
            ax1.set_ylabel('Count')
            
            for bar, count in zip(bars1, counts):
                height = bar.get_height()
                ax1.text(bar.get_x() + bar.get_width()/2., height + 0.5,
                        str(count), ha='center', va='bottom', fontweight='bold')
            
            # Predicted distribution
            ax2 = axes[i, 1]
            pred_dist = result['pred_distribution']
            pred_counts = [pred_dist.get(form, 0) for form in forms]
            
            bars2 = ax2.bar(forms, pred_counts, color='lightcoral', alpha=0.8, edgecolor='black')
            ax2.set_title(f'{exercise.title()} - Predicted Form Distribution')
            ax2.set_ylabel('Count')
            
            for bar, count in zip(bars2, pred_counts):
                height = bar.get_height()
                ax2.text(bar.get_x() + bar.get_width()/2., height + 0.5,
                        str(count), ha='center', va='bottom', fontweight='bold')
            
            # Rotate x-axis labels
            ax1.tick_params(axis='x', rotation=45)
            ax2.tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        plt.savefig("form_distribution_comparison.png", dpi=300, bbox_inches='tight')
        print("💾 Saved form distribution plot: form_distribution_comparison.png")
        plt.close()
    
    def print_detailed_report(self):
        """Print comprehensive classification report"""
        print("\n" + "="*100)
        print("📊 COMPREHENSIVE CLASSIFICATION METRICS REPORT")
        print("="*100)
        
        for exercise in self.exercises:
            if exercise not in self.results:
                continue
                
            result = self.results[exercise]
            print(f"\n🏋️ {exercise.upper()} FORM CLASSIFICATION ANALYSIS:")
            print("-" * 80)
            
            # Basic statistics
            print(f"📊 Dataset Statistics:")
            print(f"   Total samples: {result['total_samples']}")
            print(f"   Correct predictions: {result['correct_predictions']}")
            print(f"   Accuracy: {result['accuracy']:.4f} ({result['accuracy']*100:.2f}%)")
            
            # Overall metrics
            print(f"\n📈 Overall Performance Metrics:")
            print(f"   Precision (weighted): {result['precision_weighted']:.4f}")
            print(f"   Recall (weighted): {result['recall_weighted']:.4f}")
            print(f"   F1-Score (weighted): {result['f1_weighted']:.4f}")
            
            # Per-class metrics
            print(f"\n📋 Per-Class Performance:")
            labels = result['confusion_matrix_labels']
            for class_name in labels:
                if class_name in result['precision_per_class']:
                    prec = result['precision_per_class'][class_name]
                    rec = result['recall_per_class'][class_name]
                    f1 = result['f1_per_class'][class_name]
                    print(f"   {class_name:18} - Precision: {prec:.3f}, Recall: {rec:.3f}, F1: {f1:.3f}")
            
            # Form distributions
            print(f"\n📊 Form Distribution Analysis:")
            print("   Actual distribution:")
            for form, count in result['true_distribution'].items():
                percentage = (count / result['total_samples']) * 100
                print(f"     {form:18} - {count:3d} samples ({percentage:5.1f}%)")
            
            print("   Predicted distribution:")
            for form, count in result['pred_distribution'].items():
                percentage = (count / result['total_samples']) * 100
                print(f"     {form:18} - {count:3d} samples ({percentage:5.1f}%)")
            
            # Confusion matrix
            print(f"\n🔢 Confusion Matrix:")
            cm = np.array(result['confusion_matrix'])
            labels = result['confusion_matrix_labels']
            
            # Print header
            print("         " + "".join([f"{label:>15}" for label in labels]))
            for i, label in enumerate(labels):
                row = "".join([f"{cm[i][j]:>15}" for j in range(len(labels))])
                print(f"{label:>8} {row}")
            
            # Analysis
            print(f"\n💡 Key Insights:")
            best_class = max(result['f1_per_class'].items(), key=lambda x: x[1])
            worst_class = min(result['f1_per_class'].items(), key=lambda x: x[1])
            print(f"   Best performing class: {best_class[0]} (F1: {best_class[1]:.3f})")
            print(f"   Worst performing class: {worst_class[0]} (F1: {worst_class[1]:.3f})")
    
    def save_results(self):
        """Save detailed results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"classification_metrics_detailed_{timestamp}.json"
        
        # Prepare serializable results
        serializable_results = {}
        for exercise, result in self.results.items():
            serializable_results[exercise] = {
                **result,
                'confusion_matrix': [[int(x) for x in row] for row in result['confusion_matrix']]
            }
        
        # Add summary statistics
        if self.results:
            avg_accuracy = np.mean([r['accuracy'] for r in self.results.values()])
            avg_precision = np.mean([r['precision_weighted'] for r in self.results.values()])
            avg_recall = np.mean([r['recall_weighted'] for r in self.results.values()])
            avg_f1 = np.mean([r['f1_weighted'] for r in self.results.values()])
            
            serializable_results['summary'] = {
                'evaluation_timestamp': timestamp,
                'total_exercises_evaluated': len(self.results),
                'average_accuracy': avg_accuracy,
                'average_precision': avg_precision,
                'average_recall': avg_recall,
                'average_f1': avg_f1
            }
        
        with open(filename, 'w') as f:
            json.dump(serializable_results, f, indent=2)
        
        print(f"\n💾 Detailed results saved to: {filename}")
        return filename
    
    def run_evaluation(self):
        """Run complete evaluation pipeline"""
        print("🚀 Starting Classification Metrics Evaluation")
        print("="*70)
        
        # Load feedback data
        feedback_data = self.load_feedback_data()
        if not feedback_data:
            print("❌ No feedback data available for evaluation")
            return
        
        # Evaluate each exercise
        for exercise in self.exercises:
            print(f"\n🏋️ Processing {exercise}...")
            
            # Extract predictions and labels
            y_pred, y_true = self.extract_predictions_and_labels(feedback_data, exercise)
            
            if not y_pred or not y_true:
                print(f"⚠️ No data available for {exercise}")
                continue
            
            # Calculate metrics
            result = self.calculate_metrics(y_true, y_pred, exercise)
            if result:
                self.results[exercise] = result
                
                # Create confusion matrix plot
                cm = np.array(result['confusion_matrix'])
                labels = result['confusion_matrix_labels']
                self.create_confusion_matrix_plot(cm, labels, exercise)
        
        if not self.results:
            print("❌ No data could be evaluated")
            return
        
        # Create visualizations
        self.create_metrics_comparison_plot()
        self.create_form_distribution_plot()
        
        # Print detailed report
        self.print_detailed_report()
        
        # Save results
        results_file = self.save_results()
        
        print(f"\n✅ Evaluation Complete!")
        print(f"📊 Evaluated {len(self.results)} exercises")
        print(f"📁 Results saved to: {results_file}")
        print(f"📈 Visualizations created:")
        for exercise in self.results:
            print(f"   - confusion_matrix_{exercise}.png")
        print(f"   - classification_metrics_comparison.png")
        print(f"   - form_distribution_comparison.png")

def main():
    """Run classification metrics evaluation"""
    evaluator = FeedbackBasedMetricsEvaluator()
    evaluator.run_evaluation()

if __name__ == "__main__":
    main()
