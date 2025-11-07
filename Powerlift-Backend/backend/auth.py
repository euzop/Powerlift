"""
Authentication module for PowerLift.
Provides endpoints for user registration, login, and token verification.
"""

import os
import jwt
import uuid
import datetime
from flask import Blueprint, request, jsonify, current_app, url_for
from .models.user import User
from .email_service import send_verification_email

# Create blueprint
auth_bp = Blueprint('auth', __name__)

# Secret key for JWT
JWT_SECRET = os.environ.get('JWT_SECRET', 'powerlift-dev-secret-key')
JWT_EXPIRATION = 86400  # 24 hours in seconds

def generate_token(user_id):
    """Generate JWT token for authentication"""
    payload = {
        'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=JWT_EXPIRATION),
        'iat': datetime.datetime.utcnow(),
        'sub': user_id
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(token):
    """Verify JWT token and return user_id if valid"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['sub']
    except jwt.ExpiredSignatureError:
        return None  # Token expired
    except jwt.InvalidTokenError:
        return None  # Invalid token

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['username', 'email', 'password', 'first_name', 'last_name']
    if not all(key in data for key in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400
    
    username = data['username']
    email = data['email']
    password = data['password']
    first_name = data['first_name']
    last_name = data['last_name']
    
    # Optional fields with defaults
    person_weight = data.get('person_weight')
    barbell_weight = data.get('barbell_weight')
    deadlift_weight = data.get('deadlift_weight')
    squat_weight = data.get('squat_weight')
    bench_weight = data.get('bench_weight')
    
    # Validate input
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    if not first_name:
        return jsonify({'error': 'First name is required'}), 400
        
    if not last_name:
        return jsonify({'error': 'Last name is required'}), 400
    
    # Check if user already exists
    if User.find_by_email(email) or User.find_by_username(username):
        return jsonify({'error': 'Username or email already exists'}), 409
    
    # Create new user (not verified)
    user = User.create_user(
        username=username, 
        email=email, 
        password=password, 
        verified=False,
        first_name=first_name,
        last_name=last_name,
        person_weight=person_weight,
        barbell_weight=barbell_weight,
        deadlift_weight=deadlift_weight,
        squat_weight=squat_weight,
        bench_weight=bench_weight
    )
    
    # Get verification URL
    verification_url = f"{request.host_url.rstrip('/')}/api/auth/verify-email/{user.verification_token}"
    
    # Send verification email
    try:
        send_verification_email(user.email, user.username, verification_url)
    except Exception as e:
        print(f"Error sending verification email: {str(e)}")
        # Continue with registration even if email fails
    
    return jsonify({
        'message': 'User registered successfully. Please check your email to verify your account.',
        'email': user.email,
        'verification_required': True
    }), 201

@auth_bp.route('/verify-email/<token>', methods=['GET'])
def verify_email(token):
    """Verify user email with token"""
    user = User.find_by_verification_token(token)
    
    if not user:
        return jsonify({'error': 'Invalid verification token'}), 400
    
    if not user.is_token_valid():
        return jsonify({'error': 'Verification token has expired'}), 400
    
    # Mark user as verified
    user.verify_email()
    
    # Return success with redirect to login page
    return jsonify({
        'message': 'Email verified successfully. You can now log in.',
        'email': user.email
    }), 200

@auth_bp.route('/resend-verification', methods=['POST'])
def resend_verification():
    """Resend verification email"""
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data['email']
    user = User.find_by_email(email)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user.is_verified:
        return jsonify({'message': 'Email is already verified'}), 200
    
    # Generate new verification token
    user.generate_verification_token()
    User.update_user(user)
    
    # Get verification URL
    verification_url = f"{request.host_url.rstrip('/')}/api/auth/verify-email/{user.verification_token}"
    
    # Send verification email
    try:
        send_verification_email(user.email, user.username, verification_url)
    except Exception as e:
        print(f"Error sending verification email: {str(e)}")
        return jsonify({'error': 'Failed to send verification email'}), 500
    
    return jsonify({
        'message': 'Verification email has been sent',
        'email': user.email
    }), 200

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user and return token"""
    data = request.get_json()
    
    # Validate required fields
    if not all(key in data for key in ['email', 'password']):
        return jsonify({'error': 'Missing email or password'}), 400
    
    email = data['email']
    password = data['password']
    
    # Find user by email
    user = User.find_by_email(email)
    
    # Check if user exists and password is correct
    if not user or not user.verify_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Check if email is verified
    if not user.is_verified:
        return jsonify({
            'error': 'Email not verified',
            'verification_required': True,
            'email': user.email
        }), 403
    
    # Generate token
    token = generate_token(user.user_id)
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': {
            'user_id': user.user_id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'person_weight': user.person_weight,
            'barbell_weight': user.barbell_weight,
            'deadlift_weight': user.deadlift_weight,
            'squat_weight': user.squat_weight,
            'bench_weight': user.bench_weight
        }
    }), 200

@auth_bp.route('/verify', methods=['GET'])
def verify():
    """Verify token and return user info"""
    # Get token from header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Missing or invalid token'}), 401
    
    token = auth_header.split(' ')[1]
    
    # Verify token
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'error': 'Invalid or expired token'}), 401
    
    # Get user data
    users = User.get_all_users()
    user_data = next((u for u in users if u['user_id'] == user_id), None)
    
    if not user_data:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'user': {
            'user_id': user_data['user_id'],
            'username': user_data['username'],
            'email': user_data['email']
        }
    }), 200

@auth_bp.route('/update-profile', methods=['PUT'])
def update_profile():
    """Update user profile"""
    # Get token from header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Missing or invalid token'}), 401
    
    token = auth_header.split(' ')[1]
    
    # Verify token
    user_id = verify_token(token)
    if not user_id:
        return jsonify({'error': 'Invalid or expired token'}), 401
    
    data = request.get_json()
    
    # Get user data
    user = User.find_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if this is a weight-only update (no password required)
    weight_fields = ['person_weight', 'deadlift_weight', 'squat_weight', 'bench_weight']
    profile_fields = ['username', 'email', 'first_name', 'last_name', 'new_password']
    
    is_weight_only_update = (
        any(field in data for field in weight_fields) and
        not any(field in data for field in profile_fields)
    )
    
    # Verify old password only for non-weight updates
    if not is_weight_only_update:
        if 'old_password' not in data:
            return jsonify({'error': 'Old password is required for profile changes'}), 400
        
        if not user.verify_password(data['old_password']):
            return jsonify({'error': 'Current password is incorrect'}), 401
    
    # Update user data
    updated = False
    
    if 'username' in data and data['username'] != user.username:
        # Check if username is already taken
        existing_user = User.find_by_username(data['username'])
        if existing_user and existing_user.user_id != user_id:
            return jsonify({'error': 'Username already taken'}), 409
        
        user.username = data['username']
        updated = True
    
    if 'email' in data and data['email'] != user.email:
        # Check if email is already taken
        existing_user = User.find_by_email(data['email'])
        if existing_user and existing_user.user_id != user_id:
            return jsonify({'error': 'Email already taken'}), 409
        
        # Set new email but mark as unverified
        user.email = data['email']
        user.is_verified = False
        user.generate_verification_token()
        updated = True
        
        # Send verification email for new email
        verification_url = f"{request.host_url.rstrip('/')}/api/auth/verify-email/{user.verification_token}"
        try:
            send_verification_email(user.email, user.username, verification_url)
        except Exception as e:
            print(f"Error sending verification email: {str(e)}")
            # Continue with update even if email fails
    
    if 'first_name' in data:
        user.first_name = data['first_name']
        updated = True
    
    if 'last_name' in data:
        user.last_name = data['last_name']
        updated = True
    
    if 'person_weight' in data:
        user.person_weight = data['person_weight']
        updated = True
    
    if 'barbell_weight' in data:
        user.barbell_weight = data['barbell_weight']
        updated = True
    
    if 'deadlift_weight' in data:
        user.deadlift_weight = data['deadlift_weight']
        updated = True
    
    if 'squat_weight' in data:
        user.squat_weight = data['squat_weight']
        updated = True
    
    if 'bench_weight' in data:
        user.bench_weight = data['bench_weight']
        updated = True
    
    if 'new_password' in data and data['new_password']:
        # Update password
        user.set_password(data['new_password'])
        updated = True
    
    if updated:
        # Save user data
        User.update_user(user)
    
    # Generate new token
    token = generate_token(user.user_id)
    
    return jsonify({
        'message': 'Profile updated successfully',
        'token': token,
        'user': {
            'user_id': user.user_id,
            'username': user.username,
            'email': user.email,
            'is_verified': user.is_verified,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'person_weight': user.person_weight,
            'barbell_weight': user.barbell_weight,
            'deadlift_weight': user.deadlift_weight,
            'squat_weight': user.squat_weight,
            'bench_weight': user.bench_weight
        }
    }), 200 