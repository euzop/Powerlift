"""
REST API for PowerLift.
Provides endpoints for video upload, real-time analysis, and user authentication.
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import uuid
import time
import base64
import tempfile
import threading
import cv2
import numpy as np
from werkzeug.utils import secure_filename
from flask_socketio import SocketIO, emit
import queue
from datetime import datetime
import json

from .video_processor import process_video_with_powerlifting
from .analyzers.form_analyzer import FormAnalyzer
from .frame_analyzer import FrameAnalyzer
from .auth import auth_bp

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, 
                   cors_allowed_origins="*", 
                   async_mode='eventlet',  # Changed from 'threading' to 'eventlet'
                   engineio_logger=True,   # Enable engine logging
                   logger=True,            # Enable socketio logging
                   ping_timeout=60,        # Increase ping timeout
                   ping_interval=25)       # Increase ping interval

# Register authentication blueprint
app.register_blueprint(auth_bp, url_prefix='/api/auth')

# Configuration
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Output')
ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv'}
POSE_MODEL_PATH = os.environ.get('POSE_MODEL_PATH', 'singlepose-thunder-tflite-float16.tflite')
BARBELL_MODEL_PATH = os.environ.get('BARBELL_MODEL_PATH', 'Barbell_best.pt')

# Create necessary folders
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Store ongoing analyses
analyses = {}

# Initialize frame analyzer for real-time analysis
frame_analyzer = None

# Track active WebSocket sessions
websocket_sessions = {}

# Create a queue for each session to control frame processing rate
frame_queues = {}

def allowed_file(filename):
    """Check if file has an allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_frame_analyzer():
    """Get or initialize the frame analyzer for real-time analysis"""
    global frame_analyzer
    
    if frame_analyzer is None:
        print("Initializing frame analyzer...")
        try:
            frame_analyzer = FrameAnalyzer(POSE_MODEL_PATH, BARBELL_MODEL_PATH)
            print("Frame analyzer initialized successfully")
        except Exception as e:
            print(f"Error initializing frame analyzer: {str(e)}")
            raise
    
    return frame_analyzer

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "PowerLift API"})

# Print registered routes for debugging
def print_registered_routes():
    """Print all registered routes"""
    print("\nRegistered Routes:")
    for rule in app.url_map.iter_rules():
        print(f"{rule} - Methods: {', '.join(rule.methods)}")
    print("\n")

@app.route('/api/analyze/video', methods=['POST'])
def analyze_video():
    """
    Endpoint to upload and analyze a video
    
    Request should contain a multipart/form-data with a 'video' file
    """
    # Check if video part exists in request
    if 'video' not in request.files:
        return jsonify({"error": "No video file provided"}), 400
    
    file = request.files['video']
    
    # Check if file is empty
    if file.filename == '':
        return jsonify({"error": "Empty file provided"}), 400
    
    # Check if file extension is allowed
    if not allowed_file(file.filename):
        return jsonify({"error": f"File type not allowed. Supported formats: {', '.join(ALLOWED_EXTENSIONS)}"}), 400
    
    # Generate unique ID for this analysis
    analysis_id = str(uuid.uuid4())
    
    # Save the file
    filename = secure_filename(file.filename)
    input_path = os.path.join(UPLOAD_FOLDER, f"{analysis_id}_{filename}")
    file.save(input_path)
    
    # Set status
    analyses[analysis_id] = {
        "status": "processing",
        "progress": 0,
        "start_time": time.time(),
        "input_file": input_path,
        "filename": filename
    }
    
    # Start processing in a background thread
    threading.Thread(target=process_video_background, args=(analysis_id, input_path)).start()
    
    return jsonify({
        "analysis_id": analysis_id,
        "status": "processing",
        "message": "Video uploaded and processing started"
    })

def process_video_background(analysis_id, input_path):
    """Process video in background thread"""
    try:
        # Get original filename and create output path
        filename = analyses[analysis_id]["filename"]
        base_name, _ = os.path.splitext(filename)  # Remove original extension
        output_filename = f"{analysis_id}_analyzed_{uuid.uuid4()}"
        output_path = os.path.join(OUTPUT_FOLDER, f"{output_filename}.mp4")  # Explicitly use .mp4 extension
        radar_path = os.path.join(OUTPUT_FOLDER, f"{analysis_id}_radar.png")
        
        # Process the video
        analyses[analysis_id]["status"] = "processing"
        
        # Get exercise parameters from request if available
        exercise_type = analyses[analysis_id].get("exercise_type", "unknown")
        
        # Process the video and get results
        results = process_video_with_powerlifting(
            input_path=input_path,
            output_path=output_path,
            pose_model_path=POSE_MODEL_PATH,
            barbell_model_path=BARBELL_MODEL_PATH,
            confidence_threshold=0.3,  # Increased from 0.2 due to improved keypoint accuracy
            barbell_confidence=0.25,
            resize_factor=1.0,
            analyze_form=True,
            target_fps=6.0
        )
        
        # Extract scores and feedback if available
        if results and isinstance(results, dict):
            if 'scores' in results:
                analyses[analysis_id]['scores'] = results['scores']
            if 'feedback' in results:
                analyses[analysis_id]['feedback'] = results['feedback']
            # Add MCSVM analysis data if present
            if 'mcsvm_analysis' in results:
                analyses[analysis_id]['mcsvm_analysis'] = results['mcsvm_analysis']
            # Add no_barbell_detected flag if present
            if 'no_barbell_detected' in results:
                analyses[analysis_id]['no_barbell_detected'] = results['no_barbell_detected']
        
        # Check if radar chart exists (it should be generated by the processing)
        base_name = os.path.splitext(output_path)[0]
        possible_radar = f"{base_name}_radar.png"
        
        if os.path.exists(possible_radar):
            radar_path = possible_radar
        
        # Update analysis status
        analyses[analysis_id].update({
            "status": "completed",
            "output_file": output_path,
            "radar_chart": radar_path if os.path.exists(radar_path) else None,
            "end_time": time.time(),
            "processing_time": time.time() - analyses[analysis_id]["start_time"]
        })
        
    except Exception as e:
        analyses[analysis_id].update({
            "status": "failed",
            "error": str(e)
        })

@app.route('/api/analysis/<analysis_id>', methods=['GET'])
def get_analysis_status(analysis_id):
    """Get the status of a video analysis job"""
    if analysis_id not in analyses:
        return jsonify({"error": "Analysis ID not found"}), 404
    
    analysis = analyses[analysis_id]
    
    # Prepare response based on status
    response = {
        "analysis_id": analysis_id,
        "status": analysis["status"],
        "filename": analysis["filename"]
    }
    
    if analysis["status"] == "completed":
        # Get score data if available
        response["processing_time"] = analysis["processing_time"]
        
        # Add scores if they exist in the analysis data
        if "scores" in analysis:
            response["scores"] = analysis["scores"]
            
        # Add feedback if available
        if "feedback" in analysis:
            response["feedback"] = analysis["feedback"]
        
        # Add MCSVM analysis data if available
        if "mcsvm_analysis" in analysis:
            response["mcsvm_analysis"] = analysis["mcsvm_analysis"]
        
        # Add URLs for output video and radar chart
        response["output_video_url"] = f"/api/analysis/{analysis_id}/video"
        
        if analysis.get("radar_chart"):
            response["radar_chart_url"] = f"/api/analysis/{analysis_id}/radar"
            
        # Add barbell detection flag
        if "no_barbell_detected" in analysis:
            response["no_barbell_detected"] = analysis["no_barbell_detected"]
            
        # Add rep count if available
        if "rep_count" in analysis:
            response["rep_count"] = analysis["rep_count"]
    
    elif analysis["status"] == "failed":
        response["error"] = analysis.get("error", "Unknown error")
    
    return jsonify(response)

@app.route('/api/analysis/<analysis_id>/video', methods=['GET'])
def get_analysis_video(analysis_id):
    """Get the analyzed video file"""
    if analysis_id not in analyses:
        return jsonify({"error": "Analysis ID not found"}), 404
    
    # Check if analysis is completed
    if analyses[analysis_id]["status"] != "completed":
        return jsonify({"error": "Analysis not completed yet"}), 404
    
    # Check if this is a real-time analysis (no output file)
    if "output_file" not in analyses[analysis_id]:
        # For real-time analyses, we don't have a video file
        return jsonify({
            "error": "Video not available for real-time analysis",
            "message": "Real-time analyses don't generate video files"
        }), 404
    
    # Get the output file path
    output_file = analyses[analysis_id]["output_file"]
    
    # Always try to use .mp4 extension first
    base_path, ext = os.path.splitext(output_file)
    if ext.lower() != '.mp4':
        mp4_path = f"{base_path}.mp4"
        if os.path.exists(mp4_path):
            # Update the path for future requests
            analyses[analysis_id]["output_file"] = mp4_path
            output_file = mp4_path
    
    # Check if the file exists
    if not os.path.exists(output_file):
        return jsonify({"error": f"Video file not found at {output_file}"}), 404
    
    return send_file(output_file)

@app.route('/api/analysis/<analysis_id>/radar', methods=['GET'])
def get_radar_chart(analysis_id):
    """Get the radar chart for an analysis"""
    if analysis_id not in analyses or "radar_chart" not in analyses[analysis_id]:
        return jsonify({"error": "Radar chart not available"}), 404
    
    return send_file(analyses[analysis_id]["radar_chart"])

@app.route('/api/analyze/frame', methods=['POST'])
def analyze_single_frame():
    """
    Analyze a single frame for real-time analysis
    
    Request should contain:
    - image: Base64 encoded image
    """
    start_time = time.time()
    
    if 'image' not in request.json:
        print("Error: No image data provided in request")
        return jsonify({"error": "No image data provided"}), 400
    
    try:
        # Decode base64 image
        image_data = base64.b64decode(request.json['image'])
        print(f"Received frame data, size: {len(image_data)} bytes")
        
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            print("Error: Invalid image data, could not decode")
            return jsonify({"error": "Invalid image data"}), 400
        
        print(f"Frame decoded successfully, shape: {frame.shape}")
        
        # Get frame analyzer
        analyzer = get_frame_analyzer()
        
        # Process the frame - this now adds to a queue and returns the latest result
        result = analyzer.analyze_frame(frame)
        
        # Calculate processing time
        process_time = time.time() - start_time
        print(f"Frame handled in {process_time:.2f} seconds")
        
        # Return analysis result with improved response time
        return jsonify({
            "status": "success",
            "frame_count": result["frame_count"],
            "scores": result["scores"],
            "errors": result["errors"],
            "process_time_ms": result["process_time_ms"],
            "visualization": result["visualization"],
            "fps": result.get("fps", 0)
        })
    
    except Exception as e:
        print(f"Error in analyze_frame: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

@app.route('/api/realtime/reset', methods=['POST'])
def reset_real_time_analysis():
    """Reset the real-time analysis session"""
    try:
        # Initialize the frame analyzer if not already done
        analyzer = get_frame_analyzer()
        
        # Reset the analyzer
        analyzer.reset()
        
        return jsonify({
            "status": "success",
            "message": "Real-time analysis session reset"
        })
    except Exception as e:
        print(f"Error resetting real-time analysis: {str(e)}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    session_id = request.sid
    print(f"Client connected: {session_id}")
    websocket_sessions[session_id] = {
        'connected': True,
        'last_frame_time': time.time(),
        'frame_count': 0
    }
    # Create a queue for this session
    frame_queues[session_id] = queue.Queue(maxsize=5)  # Limit queue size to prevent memory issues
    emit('connection_response', {'status': 'connected', 'session_id': session_id})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    session_id = request.sid
    print(f"Client disconnected: {session_id}")
    if session_id in websocket_sessions:
        del websocket_sessions[session_id]
    if session_id in frame_queues:
        del frame_queues[session_id]

@socketio.on('start_analysis')
def handle_start_analysis(data):
    """Start real-time analysis session"""
    session_id = request.sid
    print(f"Starting analysis for session {session_id}")
    
    # Get exercise parameters
    exercise_type = data.get('exercise_type', 'deadlift')
    body_weight = data.get('body_weight', '')
    weight_used = data.get('weight_used', '')
    
    # Initialize the frame analyzer
    try:
        analyzer = get_frame_analyzer()
        analyzer.reset()
        
        # Store session info
        websocket_sessions[session_id].update({
            'analyzing': True,
            'exercise_type': exercise_type,
            'body_weight': body_weight,
            'weight_used': weight_used,
            'start_time': time.time()
        })
        
        emit('analysis_started', {
            'status': 'success',
            'message': 'Real-time analysis started'
        })
    except Exception as e:
        print(f"Error starting analysis: {str(e)}")
        emit('analysis_error', {
            'status': 'error',
            'message': str(e)
        })

@socketio.on('analysis_result')
def handle_analysis_result(data):
    """Process a frame from the client"""
    session_id = request.sid
    print(f"Received frame from session {session_id}")
    print(f"Data keys: {list(data.keys() if data else [])}")
    
    if session_id not in websocket_sessions or not websocket_sessions[session_id].get('analyzing', False):
        print(f"Error: No active analysis session for {session_id}")
        emit('analysis_error', {
            'status': 'error',
            'message': 'No active analysis session'
        })
        return
    
    # Rate limit frames to 10 FPS
    current_time = time.time()
    time_since_last = current_time - websocket_sessions[session_id]['last_frame_time']
    if time_since_last < 0.1:  # 10 FPS = 0.1 seconds between frames
        print(f"Frame rate limiting applied, skipping frame. Time since last: {time_since_last:.3f}s")
        return
    
    # Update last frame time
    websocket_sessions[session_id]['last_frame_time'] = current_time
    websocket_sessions[session_id]['frame_count'] += 1
    frame_count = websocket_sessions[session_id]['frame_count']
    print(f"Processing frame #{frame_count} for session {session_id}")
    
    try:
        # Get the frame data
        image_data = data.get('frame')
        print(f"Frame data type: {type(image_data)}")
        print(f"Frame data starts with: {image_data[:30] if image_data else 'None'}")
        
        if not image_data or not isinstance(image_data, str) or not image_data.startswith('data:image'):
            print(f"Error: Invalid image data format: {type(image_data)}")
            raise ValueError("Invalid image data")
        
        # Extract base64 data
        try:
            image_data = image_data.split(',')[1]
            print(f"Extracted base64 data, length: {len(image_data)}")
        except Exception as e:
            print(f"Error extracting base64 data: {str(e)}")
            raise ValueError(f"Error extracting base64 data: {str(e)}")
        
        # Decode the image
        try:
            image_bytes = base64.b64decode(image_data)
            print(f"Decoded base64 to bytes, length: {len(image_bytes)}")
            
            np_arr = np.frombuffer(image_bytes, np.uint8)
            print(f"Converted to numpy array, shape: {np_arr.shape}")
            
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            print(f"Decoded image, shape: {frame.shape if frame is not None else 'None'}")
            
            if frame is None:
                print("Error: Failed to decode image")
                raise ValueError("Failed to decode image")
        except Exception as e:
            print(f"Error decoding image: {str(e)}")
            raise ValueError(f"Error decoding image: {str(e)}")
        
        print(f"Successfully decoded image, shape: {frame.shape}")
        
        # Get frame analyzer
        analyzer = get_frame_analyzer()
        
        # DIRECT APPROACH: Add frame directly to the frame analyzer's queue
        # This bypasses the session queue and ensures frames are processed
        if not analyzer.processing_queue.full():
            print(f"Adding frame directly to analyzer queue for session {session_id}")
            analyzer.processing_queue.put_nowait(frame)
            print("Frame added to analyzer queue successfully")
            
            # Process the frame and get the latest result
            result = analyzer.analyze_frame(frame)
            
            # Emit results to the client
            print(f"Emitting analysis result to client {session_id}")
            emit('analysis_result', {
                'status': 'success',
                'frame_count': result['frame_count'],
                'scores': result['scores'],
                'errors': result['errors'],
                'visualization': result['visualization'],
                'radar_chart': result['radar_chart'],
                'barbell_detected': result.get('barbell_detected', False),
                'phase': result.get('phase', 'unknown'),
                'rep_count': result.get('rep_count', 0)
            })
            print(f"Result emitted to client {session_id}")
        else:
            print(f"Analyzer queue full for session {session_id}, skipping frame")
    
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
        import traceback
        traceback.print_exc()
        emit('analysis_error', {
            'status': 'error',
            'message': str(e)
        })

@socketio.on('stop_analysis')
def handle_stop_analysis(data):
    """Stop real-time analysis and finalize results"""
    session_id = request.sid
    if session_id not in websocket_sessions:
        emit('analysis_error', {
            'status': 'error',
            'message': 'No active session'
        })
        return
    
    session_data = websocket_sessions[session_id]
    if not session_data.get('analyzing', False):
        emit('analysis_error', {
            'status': 'error',
            'message': 'No active analysis session'
        })
        return
    
    try:
        # Get exercise parameters
        exercise_type = session_data.get('exercise_type', 'deadlift')
        body_weight = session_data.get('body_weight', '')
        weight_used = session_data.get('weight_used', '')
        
        # Finalize the analysis
        analyzer = get_frame_analyzer()
        final_result = analyzer.finalize_analysis(exercise_type)
        
        # Check if barbell was detected sufficiently during the session
        # Use the barbell detection rate from the analyzer if available
        barbell_detection_rate = getattr(analyzer, 'barbell_detection_rate', 0)
        no_barbell_detected = barbell_detection_rate < 0.1  # Less than 10% of frames have barbell
        
        # Get rep count
        rep_count = final_result.get('rep_count', 0)
        
        # Generate a unique analysis ID
        analysis_id = str(uuid.uuid4())
        
        # Store the analysis results
        analyses[analysis_id] = {
            "status": "completed",
            "filename": f"realtime_{exercise_type}_{analysis_id}.mp4",
            "scores": final_result['scores'],
            "feedback": final_result['feedback'],
            "start_time": session_data.get('start_time', time.time() - 60),
            "end_time": time.time(),
            "processing_time": time.time() - session_data.get('start_time', time.time() - 60),
            "exercise_type": exercise_type,
            "body_weight": body_weight,
            "weight_used": weight_used,
            "radar_chart": os.path.join(OUTPUT_FOLDER, f"{analysis_id}_radar.png"),
            "no_barbell_detected": no_barbell_detected,
            "rep_count": rep_count
        }
        
        # Generate and save radar chart
        radar_chart_data = final_result.get('radar_chart_data', '')
        if radar_chart_data:
            try:
                # Save the radar chart
                radar_path = os.path.join(OUTPUT_FOLDER, f"{analysis_id}_radar.png")
                with open(radar_path, 'wb') as f:
                    f.write(base64.b64decode(radar_chart_data))
        
                analyses[analysis_id]["radar_chart"] = radar_path
                
                # Get the latest visualization image if available
                visualization_data = final_result.get('visualization', '')
                
                # Store visualization in the analysis data
                if visualization_data:
                    # Ensure the visualization data is properly formatted with data:image prefix
                    if not visualization_data.startswith('data:image'):
                        visualization_data = f"data:image/jpeg;base64,{visualization_data}"
                    analyses[analysis_id]['visualization'] = visualization_data
            except Exception as e:
                print(f"Error saving radar chart: {str(e)}")
        
        # Clear session data
        session_data['analyzing'] = False
        
        # Format visualization data if available
        visualization_to_send = None
        if 'visualization_data' in locals() and visualization_data:
            # Ensure the visualization data is properly formatted with data:image prefix
            if not visualization_data.startswith('data:image'):
                visualization_to_send = f"data:image/jpeg;base64,{visualization_data}"
                print(f"Formatted visualization data, length: {len(visualization_to_send)}")
            else:
                visualization_to_send = visualization_data
                print(f"Using already formatted visualization data, length: {len(visualization_to_send)}")
        else:
            # Check if visualization is directly in final_result
            if 'visualization' in final_result and final_result['visualization']:
                vis_data = final_result['visualization']
                if not vis_data.startswith('data:image'):
                    visualization_to_send = f"data:image/jpeg;base64,{vis_data}"
                else:
                    visualization_to_send = vis_data
                print(f"Using visualization from final_result, length: {len(visualization_to_send)}")
        
        # Send final results to client
        emit('analysis_complete', {
            'status': 'success',
            'analysis_id': analysis_id,
            'scores': final_result['scores'],
            'feedback': final_result['feedback'],
            'radar_chart_url': f"/api/analysis/{analysis_id}/radar",
            'no_barbell_detected': no_barbell_detected,
            'rep_count': rep_count,
            'visualization': visualization_to_send
        })
        
    except Exception as e:
        print(f"Error stopping analysis: {str(e)}")
        emit('analysis_error', {
            'status': 'error',
            'message': str(e)
        })

@app.route('/api/progress', methods=['GET'])
def get_user_progress():
    """Get user's exercise progress history"""
    # Get token from header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Missing or invalid token'}), 401
    
    token = auth_header.split(' ')[1]
    
    # Verify token
    from .auth import verify_token
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'error': 'Invalid or expired token'}), 401
    
    # Get exercise type filter from query params
    exercise_type = request.args.get('exercise_type')
    
    # Get user's progress from database
    from .models.user import User
    user = User.find_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get progress data
    progress_data = user.get_progress_data()
    
    # Filter by exercise type if specified
    if exercise_type and progress_data:
        progress_data = [p for p in progress_data if p.get('exercise_type') == exercise_type]
    
    return jsonify({
        'progress': progress_data or []
    })

@app.route('/api/progress', methods=['POST'])
def add_progress_entry():
    """Add a new progress entry"""
    # Get token from header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Missing or invalid token'}), 401
    
    token = auth_header.split(' ')[1]
    
    # Verify token
    from .auth import verify_token
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'error': 'Invalid or expired token'}), 401
    
    data = request.get_json()
    
    # Validate required fields
    if not all(key in data for key in ['exercise_type', 'date', 'score']):
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Get user
    from .models.user import User
    user = User.find_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Add progress entry
    entry = {
        'exercise_type': data['exercise_type'],
        'date': data['date'],
        'score': data['score'],
        'weight_used': data.get('weight_used'),
        'body_weight': data.get('body_weight'),
        'notes': data.get('notes')
    }
    
    user.add_progress_entry(entry)
    
    return jsonify({
        'message': 'Progress entry added successfully',
        'entry': entry
    }), 201

@app.route('/api/feedback/form-classification', methods=['POST'])
def submit_form_feedback():
    """Submit feedback for MCSVM form classification to improve model accuracy"""
    try:
        # Get token from header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid token'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token
        from .auth import verify_token
        user_id = verify_token(token)
        if not user_id:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['exercise_type', 'predicted_form', 'is_correct', 'frame_features']
        if not all(key in data for key in required_fields):
            return jsonify({'error': 'Missing required fields: ' + ', '.join(required_fields)}), 400
        
        # Create feedback entry
        feedback_entry = {
            'user_id': user_id,
            'timestamp': datetime.now().isoformat(),
            'exercise_type': data['exercise_type'],
            'predicted_form': data['predicted_form'],
            'is_correct': data['is_correct'],
            'correct_form': data.get('correct_form') if not data['is_correct'] else data['predicted_form'],
            'frame_features': data['frame_features'],  # The 50+ features used for prediction
            'confidence_score': data.get('confidence_score', 0.0),
            'analysis_id': data.get('analysis_id')
        }
        
        # Save feedback to JSON file for model retraining
        feedback_file = os.path.join(os.path.dirname(__file__), '..', 'user_feedback.json')
        
        # Load existing feedback
        try:
            with open(feedback_file, 'r') as f:
                feedback_data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            feedback_data = []
        
        # Add new feedback
        feedback_data.append(feedback_entry)
        
        # Save updated feedback
        with open(feedback_file, 'w') as f:
            json.dump(feedback_data, f, indent=2)
        
        # Log feedback for monitoring
        print(f"User feedback received: {data['exercise_type']} - {data['predicted_form']} - {'Correct' if data['is_correct'] else 'Incorrect'}")
        
        return jsonify({
            'message': 'Feedback submitted successfully',
            'feedback_id': len(feedback_data)
        }), 201
        
    except Exception as e:
        print(f"Error submitting feedback: {str(e)}")
        return jsonify({'error': 'Failed to submit feedback'}), 500

@app.route('/api/feedback/statistics', methods=['GET'])
def get_feedback_statistics():
    """Get feedback statistics for MCSVM form classification performance monitoring"""
    try:
        # Get token from header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid token'}), 401
        
        token = auth_header.split(' ')[1]
        
        # Verify token (admin access could be added here)
        from .auth import verify_token
        user_id = verify_token(token)
        if not user_id:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Load feedback data
        feedback_file = os.path.join(os.path.dirname(__file__), '..', 'user_feedback.json')
        
        try:
            with open(feedback_file, 'r') as f:
                feedback_data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            feedback_data = []
        
        if not feedback_data:
            return jsonify({
                'total_feedback': 0,
                'accuracy_rate': 0,
                'exercise_breakdown': {},
                'form_accuracy': {}
            }), 200
        
        # Calculate statistics
        total_feedback = len(feedback_data)
        correct_predictions = sum(1 for entry in feedback_data if entry['is_correct'])
        accuracy_rate = (correct_predictions / total_feedback) * 100 if total_feedback > 0 else 0
        
        # Exercise type breakdown
        exercise_breakdown = {}
        for entry in feedback_data:
            exercise = entry['exercise_type']
            if exercise not in exercise_breakdown:
                exercise_breakdown[exercise] = {'total': 0, 'correct': 0}
            exercise_breakdown[exercise]['total'] += 1
            if entry['is_correct']:
                exercise_breakdown[exercise]['correct'] += 1
        
        # Add accuracy percentages
        for exercise in exercise_breakdown:
            total = exercise_breakdown[exercise]['total']
            correct = exercise_breakdown[exercise]['correct']
            exercise_breakdown[exercise]['accuracy'] = (correct / total) * 100 if total > 0 else 0
        
        # Form classification accuracy
        form_accuracy = {}
        for entry in feedback_data:
            form = entry['predicted_form']
            if form not in form_accuracy:
                form_accuracy[form] = {'total': 0, 'correct': 0}
            form_accuracy[form]['total'] += 1
            if entry['is_correct']:
                form_accuracy[form]['correct'] += 1
        
        # Add accuracy percentages
        for form in form_accuracy:
            total = form_accuracy[form]['total']
            correct = form_accuracy[form]['correct']
            form_accuracy[form]['accuracy'] = (correct / total) * 100 if total > 0 else 0
        
        return jsonify({
            'total_feedback': total_feedback,
            'accuracy_rate': round(accuracy_rate, 2),
            'exercise_breakdown': exercise_breakdown,
            'form_accuracy': form_accuracy,
            'last_updated': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        print(f"Error getting feedback statistics: {str(e)}")
        return jsonify({'error': 'Failed to retrieve statistics'}), 500

def run_api(host='0.0.0.0', port=5000):
    """Run the API server"""
    try:
        # Print registered routes for debugging
        print_registered_routes()
        
        # Initialize frame analyzer to catch any errors early
        try:
            analyzer = get_frame_analyzer()
            print("Frame analyzer pre-initialized successfully")
            
            # Make sure the processing thread is started
            if not hasattr(analyzer, 'processing_thread') or not analyzer.processing_thread or not analyzer.processing_thread.is_alive():
                print("Starting frame analyzer processing thread")
                analyzer._start_processing_thread()
                print("Frame analyzer processing thread started")
            else:
                print("Frame analyzer processing thread already running")
                
            # Test the processing queue
            print(f"Processing queue size: {analyzer.processing_queue.qsize()}")
            print(f"Processing queue maxsize: {analyzer.processing_queue.maxsize}")
            print(f"Is processing: {analyzer.is_processing}")
        except Exception as e:
            print(f"WARNING: Failed to pre-initialize frame analyzer: {str(e)}")
            print("Will attempt initialization on first request")
        
        # Print server information
        print(f"Starting PowerLift API server on http://{host}:{port}")
        print(f"CORS enabled for all origins")
        
        # Run Flask app
        socketio.run(app, host=host, port=port)
    except Exception as e:
        print(f"ERROR starting API server: {str(e)}")
        raise

if __name__ == '__main__':
    run_api()