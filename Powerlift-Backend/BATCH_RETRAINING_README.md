# PowerLift Automatic MCSVM Retraining System

## Overview
Your PowerLift system now includes **automatic batch retraining** for MCSVM models based on user feedback. This system intelligently updates your machine learning models without manual intervention.

## How It Works

### 🔄 Automatic Retraining Flow
1. **User provides feedback** → Stored in `user_feedback.json`
2. **Backend starts** → Checks for sufficient feedback data
3. **Criteria met** → Automatically retrains models with new data
4. **Models updated** → New `.pkl` files replace old ones
5. **System continues** → Uses improved models for predictions

### 📊 Retraining Criteria
- **Minimum total feedback**: 20 entries across all exercises
- **Minimum per exercise**: 5 feedback entries per exercise type
- **Time interval**: At least 1 day since last retraining
- **Data quality**: Valid features and labels required

## Current Setup

### ✅ What's Automated
- **Feedback collection** via mobile app
- **Data validation** and preprocessing
- **Model backup** before retraining
- **Batch retraining** with combined synthetic + real data
- **Model versioning** and metadata tracking
- **Error handling** with automatic rollback

### 🔧 Configuration
Edit these values in `retrain_mcsvm.py`:
```python
self.min_feedback_total = 20        # Total feedback needed
self.min_feedback_per_exercise = 5  # Per exercise minimum
self.retraining_interval_days = 1   # Days between retraining
```

## Running the System

### Method 1: Automatic (Recommended)
```bash
# Windows PowerShell
.\start_powerlift.ps1

# Linux/Mac
./start_powerlift.sh
```
This starts both backend and frontend with auto-retraining enabled.

### Method 2: Backend Only
```bash
python run_api.py
```
Backend will check for retraining on startup.

### Method 3: Manual Retraining
```bash
python retrain_mcsvm.py
```
Force retraining regardless of criteria.

## File Structure
```
Powerlift-Backend/
├── retrain_mcsvm.py          # Batch retraining logic
├── run_api.py                # Updated with auto-retraining
├── start_powerlift.ps1       # Windows startup script
├── start_powerlift.sh        # Linux/Mac startup script
├── user_feedback.json        # Collected user feedback
├── models/
│   ├── model_metadata.json   # Retraining history
│   ├── *_form_classifier.pkl # Current models
│   └── *_backup.pkl          # Backup models
└── backend/
    └── analyzers/
        └── training_data_generator.py  # Updated for feedback format
```

## Monitoring

### 📈 Retraining Status
Check console output when starting backend:
- `📊 Insufficient feedback` - Not enough data yet
- `⏰ Recent retraining` - Recently retrained, skipping
- `✅ Retraining needed` - Starting retraining process
- `🔄 Retraining [exercise]` - Currently retraining specific exercise

### 📊 Model Versions
Check `models/model_metadata.json` for:
- Last retraining timestamp
- Model version numbers
- Feedback count at retraining
- Successfully retrained exercises

### 🎯 Feedback Statistics
Access via API: `GET /api/feedback/statistics`
- Total feedback count
- Accuracy rates by exercise
- Form classification performance

## Benefits

### 🚀 Performance Improvements
- **Better accuracy** as more real data is collected
- **Personalized models** based on actual user patterns
- **Continuous learning** without manual intervention
- **Quality control** with automatic backup/restore

### 🛡️ Safety Features
- **Backup creation** before each retraining
- **Automatic rollback** if retraining fails
- **Data validation** to prevent bad training data
- **Incremental updates** only when sufficient data available

## Evolution Path

### Current State (12 feedback entries)
- Score-based classification active
- Feedback collection working
- Infrastructure ready for ML transition

### Near Future (20+ feedback entries)
- Automatic retraining begins
- Models start learning from real data
- Gradual transition to ML-based predictions

### Long Term (200+ feedback entries)
- Fully ML-driven system
- High accuracy personalized models
- Continuous improvement cycle

## Troubleshooting

### No Retraining Happening
1. Check feedback count: `python -c "import json; print(len(json.load(open('user_feedback.json'))))"`
2. Verify criteria in `retrain_mcsvm.py`
3. Check last retraining date in `model_metadata.json`

### Retraining Fails
1. Check console error messages
2. Verify backup models were created
3. Models automatically restore from backup
4. Check feedback data format in `user_feedback.json`

### Performance Issues
1. Retraining only runs on startup (not during operation)
2. Adjust `min_feedback_total` to reduce frequency
3. Consider running manual retraining during off-hours

## Next Steps
1. **Keep using the system** - feedback collection is automatic
2. **Monitor progress** - watch for retraining messages on startup
3. **Provide feedback** - help improve model accuracy
4. **Scale up** - as accuracy improves, collect more diverse data

Your system is now ready for intelligent, automatic improvement! 🎉
