"""
Integration tests: Cohort Randomization 

Demonstrates that use_cohort=False returns a deterministic ranked list
and use_cohort=True returns a randomized list with no rank assigned.

Requirements:
  - Backend running at http://localhost:8000
  - Valid MLG recruiter credentials in environment variables:
      TEST_EMAIL, TEST_PASSWORD
  - A real job in the database (set TEST_COMPANY, TEST_JOB_TITLE, TEST_JOB_ID)

"""

import os
import pytest
import requests

API_BASE_URL = "http://localhost:8000/api"
TOP_K = 5  # Keep small to limit LLM explanation calls

COMPANY  = os.environ.get("TEST_COMPANY",   "")
TITLE    = os.environ.get("TEST_JOB_TITLE", "")
JOB_ID   = os.environ.get("TEST_JOB_ID",   "")
EMAIL    = os.environ.get("TEST_EMAIL",     "")
PASSWORD = os.environ.get("TEST_PASSWORD",  "")


@pytest.fixture(scope="session")
def auth_token():
    assert EMAIL and PASSWORD, (
        "Set TEST_EMAIL and TEST_PASSWORD environment variables before running."
    )
    resp = requests.post(f"{API_BASE_URL}/auth/login", json={
        "email": EMAIL,
        "password": PASSWORD,
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json().get("token")
    assert token, "No token returned from login."
    return token


def _call_match(token: str, use_cohort: bool) -> dict:
    assert JOB_ID, "Set TEST_JOB_ID environment variable before running."
    resp = requests.post(
        f"{API_BASE_URL}/matches/find",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "company_name": COMPANY,
            "job_title":    TITLE,
            "job_id":       JOB_ID,
            "top_k":        TOP_K,
            "use_cohort":   use_cohort,
        },
    )
    assert resp.status_code == 200, f"Match request failed: {resp.text}"
    data = resp.json()
    assert data.get("success"), f"Unexpected response: {data}"
    return data


@pytest.fixture(scope="session")
def ranked_result(auth_token):
    return _call_match(auth_token, use_cohort=False)


@pytest.fixture(scope="session")
def cohort_result(auth_token):
    return _call_match(auth_token, use_cohort=True)


@pytest.fixture(scope="session")
def ranked_result_2(auth_token):
    return _call_match(auth_token, use_cohort=False)


@pytest.fixture(scope="session")
def cohort_result_2(auth_token):
    return _call_match(auth_token, use_cohort=True)


def _print_candidates(matches, label):
    print(f"\n  {label}")
    print(f"  {'Pos':<5} {'Rank':<8} {'Name':<30} {'Score':>7}")
    print(f"  {'-'*5} {'-'*8} {'-'*30} {'-'*7}")
    for i, m in enumerate(matches, 1):
        rank  = str(m["rank"]) if m["rank"] is not None else "—"
        name  = (m.get("full_name") or "Unknown")[:29]
        score = m["scores"]["combined"] if m.get("scores") else "—"
        print(f"  {i:<5} {rank:<8} {name:<30} {str(score):>7}")


class TestRankedMatching:
    """use_cohort=False: deterministic, score-sorted, rank assigned."""

    def test_ranked_mode_flag(self, ranked_result):
        print("\n  PURPOSE: Confirms the API response correctly reports is_cohort=False")
        print("           when use_cohort=False is passed, indicating ranked mode is active.")
        print(f"\n  is_cohort = {ranked_result['is_cohort']}  (expected: False)")
        assert ranked_result["is_cohort"] is False

    def test_scores_are_visible(self, ranked_result):
        print("\n  PURPOSE: In ranked mode, combined similarity scores must be present")
        print("           for every candidate so recruiters can see how strong each match is.")
        _print_candidates(ranked_result["matches"], "Ranked candidates with scores:")
        for m in ranked_result["matches"]:
            assert m["scores"] is not None
            assert m["scores"]["combined"] is not None

    def test_ranks_are_assigned(self, ranked_result):
        print("\n  PURPOSE: In ranked mode, each candidate must receive an explicit rank number.")
        print("           A null rank would indicate the result was treated as a cohort.")
        ranks = [m["rank"] for m in ranked_result["matches"]]
        print(f"\n  Ranks assigned: {ranks}")
        for m in ranked_result["matches"]:
            assert m["rank"] is not None

    def test_scores_descending(self, ranked_result):
        print("\n  PURPOSE: Verifies candidates are returned in strict descending score order,")
        print("           confirming the ranked list reflects true best-match ordering.")
        scores = [m["scores"]["combined"] for m in ranked_result["matches"]]
        print(f"\n  Scores in order: {scores}")
        assert scores == sorted(scores, reverse=True), (
            "Ranked results are not in descending score order."
        )

    def test_two_ranked_runs_identical_order(self, ranked_result, ranked_result_2):
        print("\n  PURPOSE: Ranked mode must be deterministic — two calls with the same")
        print("           inputs should always return candidates in the same order.")
        names1 = [m["full_name"] for m in ranked_result["matches"]]
        names2 = [m["full_name"] for m in ranked_result_2["matches"]]
        print(f"\n  Run 1: {names1}")
        print(f"  Run 2: {names2}")
        print(f"  Match: {names1 == names2}")
        assert names1 == names2, (
            "Two ranked runs returned different orderings — should be deterministic."
        )


class TestCohortMatching:
    """use_cohort=True: randomized order, rank hidden."""

    def test_cohort_mode_flag(self, cohort_result):
        print("\n  PURPOSE: Confirms the API response correctly reports is_cohort=True")
        print("           when use_cohort=True is passed, indicating cohort mode is active.")
        print(f"\n  is_cohort = {cohort_result['is_cohort']}  (expected: True)")
        assert cohort_result["is_cohort"] is True

    def test_ranks_are_null(self, cohort_result):
        print("\n  PURPOSE: In cohort mode, rank must be null for every candidate.")
        print("           This prevents recruiters from seeing or acting on score-based ordering.")
        ranks = [m["rank"] for m in cohort_result["matches"]]
        print(f"\n  Ranks returned: {ranks}  (all should be None)")
        for m in cohort_result["matches"]:
            assert m["rank"] is None

    def test_same_candidates_as_ranked(self, ranked_result, cohort_result):
        print("\n  PURPOSE: Cohort mode shuffles order but must not change which candidates")
        print("           are selected — the same pool is returned, just in a different order.")
        ranked_names = [m["full_name"] for m in ranked_result["matches"]]
        cohort_names = [m["full_name"] for m in cohort_result["matches"]]
        print(f"\n  Ranked candidates : {ranked_names}")
        print(f"  Cohort candidates : {cohort_names}")
        print(f"  Same set          : {set(ranked_names) == set(cohort_names)}")
        ranked_ids = {m["candidate_id"] for m in ranked_result["matches"]}
        cohort_ids = {m["candidate_id"] for m in cohort_result["matches"]}
        assert ranked_ids == cohort_ids

    def test_randomization_across_runs(self, cohort_result, cohort_result_2):
        print("\n  PURPOSE: Two cohort calls with identical inputs should return candidates")
        print("           in a different order, proving the shuffle is applied each time.")
        names1 = [m["full_name"] for m in cohort_result["matches"]]
        names2 = [m["full_name"] for m in cohort_result_2["matches"]]
        print(f"\n  Cohort run 1: {names1}")
        print(f"  Cohort run 2: {names2}")
        print(f"  Order differs: {names1 != names2}")
        assert names1 != names2, (
            "Two cohort runs returned identical order — randomization may not be working."
        )
