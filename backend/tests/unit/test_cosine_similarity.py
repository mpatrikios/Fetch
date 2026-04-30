"""
Unit tests for cosine_similarity.py
"""
import pytest
import numpy as np


@pytest.fixture(scope="module")
def cs_module():
    from src.services.matching.cosine_similarity import (
        cosine_similarity,
        normalize_similarity_score,
        extract_keywords,
        build_match_explanation,
    )
    return {
        "cosine_similarity": cosine_similarity,
        "normalize": normalize_similarity_score,
        "extract_keywords": extract_keywords,
        "build_match_explanation": build_match_explanation,
    }


@pytest.fixture
def make_job():
    return {
        "JobTitle": "Senior Software Engineer",
        "Summary": "Looking for a senior engineer with strong Python skills",
        "Responsibilities": ["architect scalable services", "mentor junior developers"],
        "Qualifications": ["Python", "cloud platforms"],
        "Skills": ["Python", "AWS"],
        "MinYears": 5,
        "companyName": "Acme Corp",
    }


@pytest.fixture
def make_candidate():
    return {
        "full_name": "Jane Doe",
        "Summary": "Experienced software architect with Python and cloud expertise",
        "Experience": [
            {
                "role": "Lead Software Engineer",
                "company": "TechCorp",
                "responsibilities": "Architected scalable cloud services",
            },
            {
                "role": "Software Developer",
                "company": "StartupCo",
                "responsibilities": "Built Python microservices",
            },
        ],
        "Companies": [{"companyName": "TechCorp"}, {"companyName": "StartupCo"}],
        "Skills": ["Python", "AWS", "Kubernetes"],
        "Location": "London",
    }


class TestCosineSimilarity:
    def test_identical_vectors(self, cs_module):
        """
        A vector compared against itself has zero angle between them,
        so cosine_similarity should return exactly 1.0.
        """
        a = np.array([1.0, 2.0, 3.0])
        assert cs_module["cosine_similarity"](a, a) == pytest.approx(1.0)

    def test_orthogonal_vectors(self, cs_module):
        """
        Vectors pointing in perpendicular directions share no common component,
        so cosine_similarity should return 0.0 (no similarity).
        """
        a = np.array([1.0, 0.0])
        b = np.array([0.0, 1.0])
        assert cs_module["cosine_similarity"](a, b) == pytest.approx(0.0)

    def test_zero_vector_returns_zero(self, cs_module):
        """
        A zero vector has no magnitude, making the denominator 0.
        The function should guard against division by zero and return 0.0.
        """
        a = np.array([0.0, 0.0, 0.0])
        b = np.array([1.0, 2.0, 3.0])
        assert cs_module["cosine_similarity"](a, b) == 0.0

    def test_mismatched_shapes_raises(self, cs_module):
        """
        Cosine similarity is only defined for vectors of equal length.
        Passing vectors of different dimensions should raise a ValueError.
        """
        a = np.array([1.0, 2.0])
        b = np.array([1.0, 2.0, 3.0])
        with pytest.raises(ValueError):
            cs_module["cosine_similarity"](a, b)


class TestNormalizeSimilarityScore:
    def test_at_baseline_returns_zero(self, cs_module):
        """
        The baseline score (0.75) represents a neutral match and should
        map to 0.0 on the normalised [-1, 1] scale.
        """
        assert cs_module["normalize"](0.75) == pytest.approx(0.0)

    def test_at_max_returns_one(self, cs_module):
        """
        A raw score of 1.0 (baseline 0.75 + scale 0.25) is a perfect match
        and should map to 1.0 on the normalised scale.
        """
        assert cs_module["normalize"](1.0) == pytest.approx(1.0)

    def test_clamp_below_minus_one(self, cs_module):
        """
        Raw scores far below the baseline should be clamped to -1.0
        rather than producing values outside the [-1, 1] range.
        """
        assert cs_module["normalize"](0.0) == pytest.approx(-1.0)

    def test_clamp_above_one(self, cs_module):
        """
        Raw scores far above 1.0 should be clamped to 1.0
        rather than producing values outside the [-1, 1] range.
        """
        assert cs_module["normalize"](2.0) == pytest.approx(1.0)


class TestExtractKeywords:
    def test_basic_extraction(self, cs_module):
        """
        Words longer than 4 characters that are not stopwords should be
        extracted and returned in lowercase. Expects 'python' and 'developer'.
        """
        keywords = cs_module["extract_keywords"]("Python developer with experience")
        assert "python" in keywords
        assert "developer" in keywords

    def test_stopwords_excluded(self, cs_module):
        """
        Common filler words defined in STOPWORDS (e.g. 'the', 'experience')
        should be excluded from the returned keyword set even if they appear
        in the input text.
        """
        keywords = cs_module["extract_keywords"]("the and with for experience")
        assert "the" not in keywords
        assert "experience" not in keywords  # 'experience' is in STOPWORDS

    def test_short_words_excluded(self, cs_module):
        """
        Words with 4 or fewer characters ('cat', 'data', 'java') are too
        short to be meaningful keywords and should not appear in the result.
        """
        keywords = cs_module["extract_keywords"]("cat data java")
        assert "cat" not in keywords
        assert "data" not in keywords
        assert "java" not in keywords

    def test_returns_set(self, cs_module):
        """
        The return type should always be a set, ensuring duplicate words
        in the input are deduplicated automatically.
        """
        result = cs_module["extract_keywords"]("engineering engineering engineer")
        assert isinstance(result, set)


class TestBuildMatchExplanation:
    def test_returns_expected_keys(self, cs_module, make_job, make_candidate):
        """
        build_match_explanation should return a dict containing all six
        structured fields used downstream for display and LLM prompting:
        keyword_overlap, relevant_roles, relevant_experience,
        candidate_companies, job_min_years, and candidate_num_roles.
        """
        result = cs_module["build_match_explanation"](make_job, make_candidate)
        assert isinstance(result, dict)
        for key in ("keyword_overlap", "relevant_roles", "relevant_experience",
                    "candidate_companies", "job_min_years", "candidate_num_roles"):
            assert key in result, f"Missing key: {key}"

    def test_candidate_num_roles(self, cs_module, make_job, make_candidate):
        """
        candidate_num_roles should equal the number of entries in the
        candidate's Experience list, used as a proxy for seniority.
        The test candidate has 2 experience entries, so expects 2.
        """
        result = cs_module["build_match_explanation"](make_job, make_candidate)
        assert result["candidate_num_roles"] == 2

    def test_candidate_companies(self, cs_module, make_job, make_candidate):
        """
        candidate_companies should list company names extracted from the
        candidate's Companies array. Expects 'TechCorp' to be present.
        """
        result = cs_module["build_match_explanation"](make_job, make_candidate)
        assert "TechCorp" in result["candidate_companies"]
