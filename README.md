# Powerlift

Real-time, feedback-driven exercise form assessment for strength training.

PowerLift analyzes short workout videos to provide per-rep form feedback for deadlift, squat and bench press. The system uses a lightweight pose-estimation model to extract joint keypoints and exercise-specific Multi-Class SVM (MCSVM) classifiers to label repetitions as **Good**, **Needs Improvement** or **Poor**. User corrections are stored and used to retrain and improve the models.

---

**Techstack (high-level)**
- Frontend: Expo / React Native (TypeScript)
- Backend: Python (Flask / FastAPI compatible)
- Pose estimation: TensorFlow Lite / MediaPipe
- Classifiers: scikit-learn SVM (.pkl model artifacts)
- Data: JSON feedback files, video uploads
- Analysis/visualization: numpy, pandas, matplotlib / seaborn

---

**Quick start (backend, PowerShell)**
1. Create & activate virtual env:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r Powerlift-Backend/requirements.txt
```

3. Run API server (example):

```powershell
cd Powerlift-Backend
python run_api.py
```

**Frontend (quick)**

```powershell
cd Powerlift-Frontend
npm install
npx expo start
```

---

**Repository layout (important files)**
- `Powerlift-Backend/` – backend server, ML scripts, models and evaluation tools
	- `models/` – serialized classifiers (e.g. `deadlift_form_classifier.pkl`)
	- `user_feedback.json`, `user_feedback_enhanced.json` – feedback dataset used for retraining
	- evaluation scripts and visualization outputs (confusion matrices, comparison plots)
	- `run_api.py` – entry to start the backend API
- `Powerlift-Frontend/` – mobile app (Expo) with UI, upload flow and feedback UI
- `Output/` – processed/annotated videos and radar charts
- `MCSVM/` – scripts for feedback generation, evaluation and visualization

---

**How it works (short)**
1. Mobile app records/uploads short workout videos.  
2. Backend extracts pose keypoints (TFLite model) and computes biomechanical features.  
3. Exercise-specific MCSVM models classify each rep into the 3 categories.  
4. Users can confirm or correct labels; corrections are saved and fed into the retraining pipeline.

---

**Evaluation & metrics**
The repo includes scripts that compute accuracy, precision, recall, F1-score and confusion matrices for each exercise. Example outputs live under `Powerlift-Backend/MCSVM/` (e.g. `classification_metrics_detailed_*.json`, `confusion_matrix_*.png`, `classification_metrics_comparison.png`).

---

**Usage notes & deployment guidance**
- Models are small and CPU-friendly; suitable for mobile-backend hybrid deployment.  
- Use per-exercise confidence thresholds to decide when to auto-accept predictions vs request user confirmation.  
- Collect user corrections to grow the training dataset and periodically retrain models.

---

**Contributing**
- Add new exercises by providing annotated training data and adding a new exercise-specific model.  
- Use `Powerlift-Backend/MCSVM/` scripts to generate feedback batches and compute evaluation metrics.


