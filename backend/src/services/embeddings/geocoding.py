"""
Geocoding module for converting location strings to coordinates
"""

from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import time
from typing import Optional, Dict

# Initialize geocoder with a user agent
geocoder = Nominatim(user_agent="fetch-recruitment-app")

def geocode_location(location_string: str, retry_count: int = 3) -> Optional[Dict[str, float]]:
    """
    Convert a location string to coordinates using Nominatim/OpenStreetMap.
    
    Args:
        location_string: Location as text (e.g., "San Francisco, CA", "New York, NY")
        retry_count: Number of retries on timeout
        
    Returns:
        Dict with 'lat' and 'lon' keys, or None if geocoding fails
    """
    if not location_string or location_string.strip() == "":
        return None
    
    for attempt in range(retry_count):
        try:
            # Add a small delay to respect Nominatim rate limits (1 request per second)
            time.sleep(1)
            
            location = geocoder.geocode(location_string, timeout=10)
            
            if location:
                return {
                    'lat': location.latitude,
                    'lon': location.longitude
                }
            else:
                print(f"Could not geocode location: {location_string}")
                return None
                
        except GeocoderTimedOut:
            print(f"Geocoding timeout for {location_string}, attempt {attempt + 1}/{retry_count}")
            continue
        except GeocoderServiceError as e:
            print(f"Geocoder service error for {location_string}: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error geocoding {location_string}: {e}")
            return None
    
    print(f"Failed to geocode {location_string} after {retry_count} attempts")
    return None