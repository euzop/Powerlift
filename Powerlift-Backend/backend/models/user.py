"""
User model for PowerLift authentication.
"""

import os
import json
import uuid
import secrets
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

# Path to the users data file
USERS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'users.json')

class User:
    """User model for authentication"""
    
    def __init__(self, username, email, password_hash=None, user_id=None, created_at=None, 
                 is_verified=False, verification_token=None, verification_token_expiry=None,
                 first_name=None, last_name=None, person_weight=None, barbell_weight=None,
                 deadlift_weight=None, squat_weight=None, bench_weight=None):
        self.user_id = user_id or str(uuid.uuid4())
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.created_at = created_at or datetime.now().isoformat()
        self.is_verified = is_verified
        self.verification_token = verification_token
        self.verification_token_expiry = verification_token_expiry
        self.first_name = first_name
        self.last_name = last_name
        self.person_weight = person_weight
        self.barbell_weight = barbell_weight
        self.deadlift_weight = deadlift_weight
        self.squat_weight = squat_weight
        self.bench_weight = bench_weight
    
    @staticmethod
    def init_users_file():
        """Initialize the users file if it doesn't exist"""
        if not os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'w') as f:
                json.dump([], f)
    
    @staticmethod
    def get_all_users():
        """Get all users from the data file"""
        User.init_users_file()
        with open(USERS_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    
    @staticmethod
    def save_users(users):
        """Save users to the data file"""
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)
    
    def to_dict(self):
        """Convert user to dictionary"""
        return {
            'user_id': self.user_id,
            'username': self.username,
            'email': self.email,
            'password_hash': self.password_hash,
            'created_at': self.created_at,
            'is_verified': self.is_verified,
            'verification_token': self.verification_token,
            'verification_token_expiry': self.verification_token_expiry,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'person_weight': self.person_weight,
            'barbell_weight': self.barbell_weight,
            'deadlift_weight': self.deadlift_weight,
            'squat_weight': self.squat_weight,
            'bench_weight': self.bench_weight
        }
    
    @classmethod
    def from_dict(cls, data):
        """Create user from dictionary"""
        return cls(
            username=data['username'],
            email=data['email'],
            password_hash=data['password_hash'],
            user_id=data['user_id'],
            created_at=data['created_at'],
            is_verified=data.get('is_verified', False),
            verification_token=data.get('verification_token'),
            verification_token_expiry=data.get('verification_token_expiry'),
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            person_weight=data.get('person_weight'),
            barbell_weight=data.get('barbell_weight'),
            deadlift_weight=data.get('deadlift_weight'),
            squat_weight=data.get('squat_weight'),
            bench_weight=data.get('bench_weight')
        )
    
    @classmethod
    def find_by_email(cls, email):
        """Find user by email"""
        users = cls.get_all_users()
        for user_data in users:
            if user_data['email'].lower() == email.lower():
                return cls.from_dict(user_data)
        return None
    
    @classmethod
    def find_by_username(cls, username):
        """Find user by username"""
        users = cls.get_all_users()
        for user_data in users:
            if user_data['username'].lower() == username.lower():
                return cls.from_dict(user_data)
        return None
    
    @classmethod
    def find_by_id(cls, user_id):
        """Find user by ID"""
        users = cls.get_all_users()
        for user_data in users:
            if user_data['user_id'] == user_id:
                return cls.from_dict(user_data)
        return None
    
    @classmethod
    def find_by_verification_token(cls, token):
        """Find user by verification token"""
        users = cls.get_all_users()
        for user_data in users:
            if user_data.get('verification_token') == token:
                return cls.from_dict(user_data)
        return None
    
    @classmethod
    def create_user(cls, username, email, password, verified=False, first_name=None, 
                   last_name=None, person_weight=None, barbell_weight=None,
                   deadlift_weight=None, squat_weight=None, bench_weight=None):
        """Create a new user"""
        # Check if user already exists
        if cls.find_by_email(email) or cls.find_by_username(username):
            return None
        
        # Create new user
        password_hash = generate_password_hash(password)
        
        # Generate verification token if not verified
        verification_token = None
        verification_token_expiry = None
        
        if not verified:
            verification_token = secrets.token_urlsafe(32)
            # Token expires in 24 hours
            verification_token_expiry = (datetime.now() + timedelta(hours=24)).isoformat()
        
        user = cls(
            username=username, 
            email=email, 
            password_hash=password_hash,
            is_verified=verified,
            verification_token=verification_token,
            verification_token_expiry=verification_token_expiry,
            first_name=first_name,
            last_name=last_name,
            person_weight=person_weight,
            barbell_weight=barbell_weight,
            deadlift_weight=deadlift_weight,
            squat_weight=squat_weight,
            bench_weight=bench_weight
        )
        
        # Save user
        users = cls.get_all_users()
        users.append(user.to_dict())
        cls.save_users(users)
        
        return user
    
    @classmethod
    def update_user(cls, user):
        """Update existing user"""
        users = cls.get_all_users()
        
        # Find and update user
        for i, user_data in enumerate(users):
            if user_data['user_id'] == user.user_id:
                users[i] = user.to_dict()
                cls.save_users(users)
                return True
        
        return False
    
    def set_password(self, password):
        """Set password for user"""
        self.password_hash = generate_password_hash(password)
    
    def verify_password(self, password):
        """Verify password"""
        return check_password_hash(self.password_hash, password)
    
    def generate_verification_token(self):
        """Generate a new verification token"""
        self.verification_token = secrets.token_urlsafe(32)
        # Token expires in 24 hours
        self.verification_token_expiry = (datetime.now() + timedelta(hours=24)).isoformat()
        return self.verification_token
    
    def verify_email(self):
        """Mark user email as verified"""
        self.is_verified = True
        self.verification_token = None
        self.verification_token_expiry = None
        return User.update_user(self)
    
    def is_token_valid(self):
        """Check if verification token is valid and not expired"""
        if not self.verification_token or not self.verification_token_expiry:
            return False
        
        expiry = datetime.fromisoformat(self.verification_token_expiry)
        return datetime.now() < expiry
        
    def get_progress_data(self):
        """Get user's progress data"""
        users = self.get_all_users()
        for user_data in users:
            if user_data['user_id'] == self.user_id:
                return user_data.get('progress', [])
        return []
    
    def add_progress_entry(self, entry):
        """Add a progress entry for the user"""
        users = self.get_all_users()
        
        # Find user data
        for i, user_data in enumerate(users):
            if user_data['user_id'] == self.user_id:
                # Initialize progress array if it doesn't exist
                if 'progress' not in user_data:
                    user_data['progress'] = []
                
                # Add entry with timestamp
                entry['timestamp'] = datetime.now().isoformat()
                user_data['progress'].append(entry)
                
                # Save users data
                self.save_users(users)
                return True
        
        return False 