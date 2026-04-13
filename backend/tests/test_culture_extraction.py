"""
Integration tests: Culture Indicator Extraction 

Verifies that arbitrary culture words/indicators are correctly mapped to
CliftonStrengths themes by the LLM extraction pipeline. Each test case
provides a culture text with deliberate signals and words that
the returned strengths overlap with the expected matches.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Load environment variables from project root .env before importing any service code
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

import pytest
from src.services.document_processing.culture_document_parser import suggest_clifton_strengths

# Minimum overlap required between expected and returned strengths to pass
MIN_OVERLAP = 3

CULTURE_CASES = [
    (
        "analytical_competitive",
        """
        Our organization thrives on analytical thinking and data-driven decision making.
        We rely on evidence, research, and rigorous analysis before acting.
        We are intensely competitive — we measure success by outperforming benchmarks
        and winning in the market. Strategic long-term planning guides every initiative.
        We invest in developing our people and believe every individual has unique strengths.
        """,
        {"Analytical", "Competition", "Strategic", "Developer", "Individualization", "Input"},
    ),
    (
        "empathetic_harmonious",
        """
        We lead with empathy and believe that understanding others is the foundation
        of great leadership. Harmony across teams is a core value — we avoid conflict
        and seek consensus. We deeply connect with our community and care about the
        wellbeing of every person we work with. Relationships are built on trust and belief.
        """,
        {"Empathy", "Harmony", "Connectedness", "Relator", "Belief", "Positivity"},
    ),
    (
        "achievement_focused",
        """
        We are a high-performance culture driven by results. Achievers thrive here —
        those who set ambitious goals and relentlessly pursue them. Responsibility and
        discipline are expected at every level. We focus on execution and hold ourselves
        accountable. Significance and making a real impact motivate everything we do.
        """,
        {"Achiever", "Responsibility", "Discipline", "Focus", "Significance", "Self-Assurance"},
    ),
    (
        "innovative_futuristic",
        """
        We are a visionary company that lives in the future. Big ideas and ideation
        are celebrated — we constantly ask "what if?" and reimagine what is possible.
        Learners thrive here; curiosity and continuous improvement are in our DNA.
        We activate change quickly and adapt to new realities with agility.
        """,
        {"Futuristic", "Ideation", "Learner", "Activator", "Adaptability", "Input"},
    ),
]


@pytest.fixture(scope="session", params=CULTURE_CASES, ids=[c[0] for c in CULTURE_CASES])
def culture_case(request):
    label, text, expected = request.param
    print(f"\n  Running extraction for culture profile: '{label}'")
    suggestions = suggest_clifton_strengths(text.strip())
    assert suggestions, "LLM returned no suggestions — check API credentials and connectivity."
    return {"label": label, "text": text, "expected": expected, "suggestions": suggestions}


class TestCultureExtraction:

    def test_suggestions_within_range(self, culture_case):
        print(f"\n  PURPOSE: The LLM must return between 5 and 10 CliftonStrengths.")
        print( "           Fewer suggests extraction failed; more exceeds the prompt spec.")
        count = len(culture_case["suggestions"])
        print(f"\n  Culture profile : {culture_case['label']}")
        print(f"  Strengths returned: {count}  (acceptable range: 5–10)")
        assert 5 <= count <= 10, f"Expected 5–10 suggestions, got {count}."

    def test_strengths_are_valid_clifton_names(self, culture_case):
        print(f"\n  PURPOSE: Every extracted strength must be an exact match to one of")
        print( "           the 34 official CliftonStrengths themes — no hallucinated names.")
        from src.services.document_processing.culture_document_parser import VALID_CLIFTON_STRENGTHS
        returned = {s["strength"] for s in culture_case["suggestions"]}
        invalid = returned - VALID_CLIFTON_STRENGTHS
        print(f"\n  Culture profile : {culture_case['label']}")
        print(f"  Returned names  : {sorted(returned)}")
        print(f"  Invalid names   : {sorted(invalid) if invalid else 'None'}")
        assert not invalid, f"Unrecognized CliftonStrength names: {invalid}"

    def test_culture_words_align_with_clifton_strengths(self, culture_case):
        print(f"\n  PURPOSE: Culture signals in the text must map to semantically aligned")
        print( "           CliftonStrengths — proving the extraction understands culture language.")
        returned  = {s["strength"] for s in culture_case["suggestions"]}
        expected  = culture_case["expected"]
        overlap   = returned & expected
        print(f"\n  Culture profile  : {culture_case['label']}")
        print(f"  Culture signals  : {sorted(expected)}")
        print(f"  Returned strengths: {sorted(returned)}")
        print(f"  Overlap          : {sorted(overlap)}  ({len(overlap)}/{len(expected)} expected matched)")
        assert len(overlap) >= MIN_OVERLAP, (
            f"Only {len(overlap)} of {len(expected)} expected strengths matched "
            f"(minimum required: {MIN_OVERLAP}). Overlap: {overlap}"
        )

    def test_each_suggestion_has_rationale(self, culture_case):
        print(f"\n  PURPOSE: Each strength must include a non-empty rationale explaining")
        print( "           why it fits the culture — empty rationales indicate extraction failure.")
        missing = [s["strength"] for s in culture_case["suggestions"] if not s.get("rationale", "").strip()]
        print(f"\n  Culture profile : {culture_case['label']}")
        for s in culture_case["suggestions"]:
            status = "OK" if s.get("rationale", "").strip() else "MISSING"
            print(f"    [{status}] {s['strength']}: {s.get('rationale','')[:90]}")
        assert not missing, f"Missing rationale for: {missing}"

    def test_no_duplicate_strengths(self, culture_case):
        print(f"\n  PURPOSE: The LLM must not return the same CliftonStrength twice —")
        print( "           duplicates indicate a data integrity issue in the extraction.")
        names = [s["strength"] for s in culture_case["suggestions"]]
        duplicates = {n for n in names if names.count(n) > 1}
        print(f"\n  Culture profile : {culture_case['label']}")
        print(f"  All strengths   : {names}")
        print(f"  Duplicates      : {sorted(duplicates) if duplicates else 'None'}")
        assert not duplicates, f"Duplicate strengths found: {duplicates}"
