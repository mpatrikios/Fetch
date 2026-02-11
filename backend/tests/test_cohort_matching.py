"""
Test script to demonstrate the cohort matching functionality.
This script shows the difference between ranked matching and cohort matching.
"""
import requests
import json

# Configuration
API_BASE_URL = "http://localhost:8000/api"
COMPANY_NAME = "MLG"
JOB_TITLE = "Head of Technology"

def test_ranked_matching():
    """Test traditional ranked matching (use_cohort=False)"""
    print("=" * 80)
    print("TESTING: Traditional Ranked Matching (use_cohort=False)")
    print("=" * 80)

    payload = {
        "company_name": COMPANY_NAME,
        "job_title": JOB_TITLE,
        "top_k": 30,
        "percentile_threshold": 0.75,
        "use_cohort": False
    }

    try:
        response = requests.post(f"{API_BASE_URL}/matches/find", json=payload)
        response.raise_for_status()
        data = response.json()

        print(f"\nTotal matches: {data['total_matches']}")
        print(f"Is cohort mode: {data['is_cohort']}")
        print("\nTop 30 candidates (RANKED):")

        for i, match in enumerate(data['matches'][:30]):
            print(f"\n{i+1}. Rank: {match['rank']}")
            print(f"   Name: {match['full_name']}")
            print(f"   Scores: {match['scores']}")
            print(f"   Distance: {match.get('distance_km', 'N/A')} km")

        return data

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

def test_cohort_matching():
    """Test cohort matching with randomization (use_cohort=True)"""
    print("\n" + "=" * 80)
    print("TESTING: Cohort Matching with Randomization (use_cohort=True)")
    print("=" * 80)

    payload = {
        "company_name": COMPANY_NAME,
        "job_title": JOB_TITLE,
        "top_k": 30,
        "percentile_threshold": 0.75,
        "use_cohort": True
    }

    try:
        response = requests.post(f"{API_BASE_URL}/matches/find", json=payload)
        response.raise_for_status()
        data = response.json()

        print(f"\nTotal matches: {data['total_matches']}")
        print(f"Is cohort mode: {data['is_cohort']}")
        print("\nTop 30 candidates (RANDOMIZED COHORT - scores hidden):")

        for i, match in enumerate(data['matches'][:30]):
            print(f"\n{i+1}. Rank: {match['rank']}")  # Should be None
            print(f"   Name: {match['full_name']}")
            print(f"   Scores: {match['scores']}")  # Should be None
            print(f"   Distance: {match.get('distance_km', 'N/A')} km")

        return data

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

def compare_runs():
    """Run cohort matching twice to show different orderings"""
    print("\n" + "=" * 80)
    print("COMPARING: Two Cohort Runs (should have different order)")
    print("=" * 80)

    payload = {
        "company_name": COMPANY_NAME,
        "job_title": JOB_TITLE,
        "top_k": 30,
        "use_cohort": True
    }

    try:
        # First run
        response1 = requests.post(f"{API_BASE_URL}/matches/find", json=payload)
        response1.raise_for_status()
        data1 = response1.json()

        # Second run
        response2 = requests.post(f"{API_BASE_URL}/matches/find", json=payload)
        response2.raise_for_status()
        data2 = response2.json()

        print("\nFirst run - Top 30 candidate names:")
        for i, match in enumerate(data1['matches'][:30]):
            print(f"  {i+1}. {match['full_name']}")

        print("\nSecond run - Top 30 candidate names:")
        for i, match in enumerate(data2['matches'][:30]):
            print(f"  {i+1}. {match['full_name']}")
        # Check if order is different
        names1 = [m['full_name'] for m in data1['matches'][:30]]
        names2 = [m['full_name'] for m in data2['matches'][:30]]

        if names1 != names2:
            print("\n✓ SUCCESS: Orders are different (randomization working!)")
        else:
            print("\n⚠ WARNING: Orders are the same (may be coincidence or issue)")

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("\n🔍 Cohort Matching Test Suite")
    print("=" * 80)
    print("\nBefore running this test:")
    print("1. Ensure the backend server is running: cd backend && uvicorn src.api.main:app --reload")
    print("2. Update COMPANY_NAME and JOB_TITLE variables with actual values from your database")
    print("3. Ensure you have job and candidate data with embeddings")
    print()

    input("Press Enter to continue with the tests...")

    # Run tests
    test_ranked_matching()
    test_cohort_matching()
    compare_runs()

    print("\n" + "=" * 80)
    print("✓ Test suite completed!")
    print("=" * 80)
