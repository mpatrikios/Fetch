"""
Location proximity matching functions
"""

from typing import Dict, Optional
from math import radians, sin, cos, sqrt, atan2

def calculate_haversine_distance(coord1: Dict[str, float], coord2: Dict[str, float]) -> float:
    """
    Calculate the distance between two coordinates using the Haversine formula.
    
    Args:
        coord1: First coordinate dict with 'lat' and 'lon'
        coord2: Second coordinate dict with 'lat' and 'lon'
        
    Returns:
        Distance in kilometers
    """
    # Earth's radius in kilometers
    R = 6371.0
    
    lat1 = radians(coord1['lat'])
    lon1 = radians(coord1['lon'])
    lat2 = radians(coord2['lat'])
    lon2 = radians(coord2['lon'])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    
    distance = R * c
    return distance

def is_commutable(distance_km: float, max_distance_km: float = 80) -> bool:
    """
    Check if distance is within reasonable commute range.
    
    Args:
        distance_km: Distance in kilometers
        max_distance_km: Maximum reasonable commute distance (default 80km)
        
    Returns:
        True if within commute distance, False otherwise
    """
    return distance_km <= max_distance_km

def is_candidate_commutable(job_doc: dict, candidate_doc: dict, max_distance_km: float = 80) -> Optional[bool]:
    """
    Check if a candidate is within commutable distance of a job.
    
    Args:
        job_doc: Job document with location_coordinates
        candidate_doc: Candidate document with location_coordinates
        max_distance_km: Maximum reasonable commute distance (default 80km)
        
    Returns:
        True if within commute distance, False if not, None if coordinates not available
    """
    # Get coordinates from documents
    job_coords = job_doc.get("location_coordinates")
    candidate_coords = candidate_doc.get("location_coordinates")
    
    # If either doesn't have coordinates, return None
    if not job_coords or not candidate_coords:
        return None
    
    # Calculate distance and check if commutable
    distance = calculate_haversine_distance(job_coords, candidate_coords)
    return is_commutable(distance, max_distance_km)