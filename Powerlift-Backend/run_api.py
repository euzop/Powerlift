"""
Run the PowerLift API server.
"""

import os
import sys
import subprocess

def install_requirements():
    """Install required packages."""
    try:
        print("Installing required packages...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "eventlet", "flask-socketio>=5.3.0"])
        print("Packages installed successfully.")
    except Exception as e:
        print(f"Warning: Failed to install packages: {e}")

if __name__ == "__main__":
    # Install required packages
    #install_requirements()
    
    # Import after installing packages
    from backend.api import run_api
    
    # Run batch retraining if needed
    print("🔍 Checking for MCSVM model updates...")
    try:
        from retrain_mcsvm import BatchRetrainer
        retrainer = BatchRetrainer()
        retrainer.run_batch_retraining()
    except Exception as e:
        print(f"⚠️  Batch retraining check failed: {e}")
        print("📊 Continuing with existing models...")
    
    # Set model paths from environment variables or use defaults
    pose_model = os.environ.get('POSE_MODEL_PATH', r'C:\Users\euzop\Downloads\Powerlift System Updated\Powerlift-Backend\singlepose-thunder-tflite-float16.tflite')
    barbell_model = os.environ.get('BARBELL_MODEL_PATH', r'C:\Users\euzop\Downloads\Powerlift System Updated\Powerlift-Backend\Barbell_best.pt')
    
    # Set environment variables for the API
    os.environ['POSE_MODEL_PATH'] = pose_model
    os.environ['BARBELL_MODEL_PATH'] = barbell_model
    
    # Print server info
    print(f"Starting PowerLift API server...")
    print(f"Using pose model: {pose_model}")
    print(f"Using barbell model: {barbell_model}")
    
    # Run the API server
    port = int(os.environ.get('PORT', 5000))
    run_api(host='0.0.0.0', port=port) 