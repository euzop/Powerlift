"""
Batch retraining script for MCSVM models using user feedback data
Automatically runs on backend startup to update models with new feedback
"""

import os
import sys
import json
from datetime import datetime, timedelta

# Add the backend path to sys.path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, 'backend')
sys.path.append(backend_dir)

from backend.analyzers.training_data_generator import train_mcsvm_classifier

class BatchRetrainer:
    def __init__(self):
        self.feedback_file = "user_feedback_enhanced.json"
        self.models_dir = "models"
        self.metadata_file = os.path.join(self.models_dir, "model_metadata.json")
        self.min_feedback_total = 150  # 50 per exercise × 3 exercises for MAE/MAPE
        self.min_feedback_per_exercise = 50  # Statistical minimum for reliable MAE/MAPE
        self.retraining_interval_days = 1  # Retrain if last training was > 1 day ago
        
    def should_retrain(self):
        """Check if retraining is needed based on feedback and time"""
        try:
            # Check if feedback file exists
            if not os.path.exists(self.feedback_file):
                print("📝 No feedback data found - skipping retraining")
                return False
                
            # Load feedback data
            with open(self.feedback_file, 'r') as f:
                feedback_data = json.load(f)
                
            if len(feedback_data) < self.min_feedback_total:
                print(f"📊 Insufficient feedback ({len(feedback_data)}/{self.min_feedback_total}) - skipping retraining")
                return False
                
            # Check last retraining time
            if os.path.exists(self.metadata_file):
                with open(self.metadata_file, 'r') as f:
                    metadata = json.load(f)
                    last_retrain = datetime.fromisoformat(metadata.get('last_retrain', '2000-01-01'))
                    days_since = (datetime.now() - last_retrain).days
                    
                    if days_since < self.retraining_interval_days:
                        print(f"⏰ Recent retraining ({days_since} days ago) - skipping")
                        return False
            
            # Check feedback per exercise
            exercise_counts = {}
            for entry in feedback_data:
                exercise = entry.get('exercise_type', 'unknown')
                exercise_counts[exercise] = exercise_counts.get(exercise, 0) + 1
                
            retrain_exercises = []
            for exercise, count in exercise_counts.items():
                if count >= self.min_feedback_per_exercise:
                    retrain_exercises.append(exercise)
                    
            if retrain_exercises:
                print(f"✅ Retraining needed for: {retrain_exercises}")
                print(f"📊 Feedback counts: {exercise_counts}")
                return True
            else:
                print(f"📊 Insufficient feedback per exercise: {exercise_counts}")
                return False
                
        except Exception as e:
            print(f"❌ Error checking retraining criteria: {e}")
            return False
    
    def prepare_feedback_data(self, exercise_type):
        """Convert user feedback to training format"""
        try:
            with open(self.feedback_file, 'r') as f:
                feedback_data = json.load(f)
                
            # Filter for specific exercise
            exercise_feedback = [entry for entry in feedback_data 
                               if entry.get('exercise_type') == exercise_type]
            
            if len(exercise_feedback) < self.min_feedback_per_exercise:
                return None
                
            # Convert to training format
            training_data = []
            for entry in exercise_feedback:
                # Use correct form if prediction was wrong, otherwise use predicted form
                label = entry.get('correct_form') if not entry.get('is_correct') else entry.get('predicted_form')
                features = entry.get('frame_features', [])
                
                if label and features and len(features) > 0:
                    training_data.append({
                        'features': features,
                        'label': label
                    })
                    
            print(f"📊 Prepared {len(training_data)} training samples for {exercise_type}")
            return training_data
            
        except Exception as e:
            print(f"❌ Error preparing feedback data for {exercise_type}: {e}")
            return None
    
    def retrain_exercise_model(self, exercise_type):
        """Retrain model for specific exercise using feedback data"""
        try:
            print(f"\n🔄 Retraining {exercise_type} classifier...")
            
            # Prepare feedback data
            feedback_training_data = self.prepare_feedback_data(exercise_type)
            
            if not feedback_training_data:
                print(f"❌ No valid feedback data for {exercise_type}")
                return False
                
            # Create backup of existing model
            model_path = os.path.join(self.models_dir, f"{exercise_type}_form_classifier.pkl")
            backup_path = os.path.join(self.models_dir, f"{exercise_type}_form_classifier_backup.pkl")
            
            if os.path.exists(model_path):
                import shutil
                shutil.copy2(model_path, backup_path)
                print(f"📁 Backed up existing model to {backup_path}")
            
            # Train new model with feedback data
            # Note: This creates a temporary file for feedback data
            temp_feedback_file = f"temp_feedback_{exercise_type}.json"
            with open(temp_feedback_file, 'w') as f:
                json.dump(feedback_training_data, f)
            
            try:
                # Train with combined synthetic + feedback data
                classifier = train_mcsvm_classifier(
                    exercise_type=exercise_type,
                    model_output_path=model_path,
                    annotated_data_file=temp_feedback_file
                )
                
                if classifier is not None:
                    print(f"✅ {exercise_type} model retrained successfully!")
                    return True
                else:
                    print(f"❌ {exercise_type} model retraining failed!")
                    # Restore backup if training failed
                    if os.path.exists(backup_path):
                        import shutil
                        shutil.copy2(backup_path, model_path)
                        print(f"🔄 Restored backup model")
                    return False
                    
            finally:
                # Clean up temp file
                if os.path.exists(temp_feedback_file):
                    os.remove(temp_feedback_file)
                    
        except Exception as e:
            print(f"❌ Error retraining {exercise_type} model: {e}")
            return False
    
    def update_metadata(self, retrained_exercises):
        """Update model metadata with retraining info"""
        try:
            os.makedirs(self.models_dir, exist_ok=True)
            
            metadata = {}
            if os.path.exists(self.metadata_file):
                with open(self.metadata_file, 'r') as f:
                    metadata = json.load(f)
            
            metadata.update({
                'last_retrain': datetime.now().isoformat(),
                'retrained_exercises': retrained_exercises,
                'feedback_count_at_retrain': self.get_feedback_count(),
                'version': metadata.get('version', 0) + 1
            })
            
            with open(self.metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
                
            print(f"📊 Updated model metadata (version {metadata['version']})")
            
        except Exception as e:
            print(f"❌ Error updating metadata: {e}")
    
    def get_feedback_count(self):
        """Get current feedback count"""
        try:
            if os.path.exists(self.feedback_file):
                with open(self.feedback_file, 'r') as f:
                    return len(json.load(f))
            return 0
        except:
            return 0
    
    def run_batch_retraining(self):
        """Main method to run batch retraining"""
        print("\n🤖 PowerLift MCSVM Batch Retraining")
        print("=" * 50)
        
        if not self.should_retrain():
            print("🔄 No retraining needed at this time")
            return False
        
        print("🚀 Starting batch retraining process...")
        
        # Get exercises to retrain
        exercises_to_retrain = ['deadlift', 'squat', 'bench']
        successfully_retrained = []
        
        for exercise in exercises_to_retrain:
            if self.prepare_feedback_data(exercise):
                if self.retrain_exercise_model(exercise):
                    successfully_retrained.append(exercise)
        
        if successfully_retrained:
            self.update_metadata(successfully_retrained)
            print(f"\n✅ Batch retraining completed!")
            print(f"📊 Successfully retrained: {successfully_retrained}")
            return True
        else:
            print("\n❌ No models were successfully retrained")
            return False

def main():
    """Main function for standalone execution"""
    retrainer = BatchRetrainer()
    retrainer.run_batch_retraining()

if __name__ == "__main__":
    main()
