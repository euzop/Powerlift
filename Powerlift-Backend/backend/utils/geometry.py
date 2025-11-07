"""
Geometry utility functions for PowerLift.
"""

import cv2
import numpy as np

def get_square_frame(frame):
    """
    Crops a frame to 1:1 aspect ratio without stretching
    
    Args:
        frame: Input frame of any dimension
        
    Returns:
        Square frame with center of original frame preserved
    """
    height, width = frame.shape[0], frame.shape[1]
    
    if width > height:
        # Landscape orientation: crop the sides
        diff = width - height
        left_crop = diff // 2
        right_crop = diff - left_crop
        frame = frame[:, left_crop:width-right_crop]
    elif height > width:
        # Portrait orientation: crop top and bottom
        diff = height - width
        top_crop = diff // 2
        bottom_crop = diff - top_crop
        frame = frame[top_crop:height-bottom_crop, :]
    
    # Already square, no cropping needed if width == height
    return frame 