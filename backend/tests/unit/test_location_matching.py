"""
Unit tests for location_matching.py 
"""
import pytest
from src.services.matching.location_matching import (
    calculate_haversine_distance,
    is_commutable,
    is_candidate_commutable,
)

# London and Paris coordinates
LONDON = {"lat": 51.5074, "lon": -0.1278}
PARIS = {"lat": 48.8566, "lon": 2.3522}
LONDON_PARIS_KM_APPROX = 340  # roughly 340 km


# ── calculate_haversine_distance ──────────────────────────────────────────────

class TestCalculateHaversineDistance:
    def test_known_city_pair(self):
        """
        London to Paris is approximately 340 km. Verifies the haversine
        formula produces a physically correct result within ±20 km tolerance.
        """
        dist = calculate_haversine_distance(LONDON, PARIS)
        assert dist is not None
        assert abs(dist - LONDON_PARIS_KM_APPROX) < 20

    def test_same_point_returns_zero(self):
        """
        The distance from a point to itself should be 0 km.
        Confirms no floating-point drift causes a non-zero result.
        """
        dist = calculate_haversine_distance(LONDON, LONDON)
        assert dist is not None
        assert dist == pytest.approx(0.0, abs=0.001)

    def test_missing_lat_returns_none(self):
        """
        A coordinate dict without a 'lat' key is invalid.
        The function should return None rather than raise an exception.
        """
        coord_no_lat = {"lon": -0.1278}
        dist = calculate_haversine_distance(LONDON, coord_no_lat)
        assert dist is None

    def test_missing_lon_returns_none(self):
        """
        A coordinate dict without a 'lon' key is invalid.
        The function should return None rather than raise an exception.
        """
        coord_no_lon = {"lat": 51.5074}
        dist = calculate_haversine_distance(coord_no_lon, PARIS)
        assert dist is None

    def test_empty_dict_returns_none(self):
        """
        An empty dict has neither 'lat' nor 'lon', so the function
        should return None without raising an exception.
        """
        assert calculate_haversine_distance({}, LONDON) is None


# ── is_commutable ─────────────────────────────────────────────────────────────

class TestIsCommutable:
    def test_within_range(self):
        """
        A distance of 50 km is well within the default 80 km commute
        threshold, so the function should return True.
        """
        assert is_commutable(50.0) is True

    def test_exactly_at_limit(self):
        """
        The boundary value of exactly 80 km should be considered commutable
        (inclusive comparison), returning True.
        """
        assert is_commutable(80.0) is True

    def test_beyond_range(self):
        """
        A distance of 81 km exceeds the default 80 km threshold,
        so the function should return False.
        """
        assert is_commutable(81.0) is False

    def test_custom_max_distance(self):
        """
        When a custom threshold is provided, the comparison should use that
        value instead of the default 80 km. 100 km is within 120 km (True),
        and 130 km exceeds it (False).
        """
        assert is_commutable(100.0, max_distance_km=120) is True
        assert is_commutable(130.0, max_distance_km=120) is False


# ── is_candidate_commutable ───────────────────────────────────────────────────

class TestIsCandidateCommutable:
    def test_no_job_coords_returns_none(self):
        """
        If the job document has no location_coordinates, proximity cannot
        be determined. The function should return None, not raise or assume
        the candidate is commutable.
        """
        job = {}
        candidate = {"location_coordinates": PARIS}
        assert is_candidate_commutable(job, candidate) is None

    def test_no_candidate_coords_returns_none(self):
        """
        If the candidate document has no location_coordinates, proximity
        cannot be determined. The function should return None, not raise or
        assume the candidate is commutable.
        """
        job = {"location_coordinates": LONDON}
        candidate = {}
        assert is_candidate_commutable(job, candidate) is None

    def test_within_range_returns_true(self):
        """
        A candidate located just outside central London (very close coords)
        is well within the 80 km threshold and should return True.
        """
        nearby = {"lat": 51.5, "lon": -0.1}  # very close to London
        job = {"location_coordinates": LONDON}
        candidate = {"location_coordinates": nearby}
        assert is_candidate_commutable(job, candidate) is True

    def test_outside_range_returns_false(self):
        """
        London to Paris is ~340 km, far exceeding the 80 km commute threshold.
        A candidate in Paris should be excluded from a London job, returning False.
        """
        job = {"location_coordinates": LONDON}
        candidate = {"location_coordinates": PARIS}
        assert is_candidate_commutable(job, candidate) is False
