"""
Parse company culture documents and suggest CliftonStrengths themes via LLM.
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

VALID_CLIFTON_STRENGTHS: set[str] = {
    "Achiever", "Activator", "Adaptability", "Analytical", "Arranger",
    "Belief", "Command", "Communication", "Competition", "Connectedness",
    "Consistency", "Context", "Deliberative", "Developer", "Discipline",
    "Empathy", "Focus", "Futuristic", "Harmony", "Ideation", "Includer",
    "Individualization", "Input", "Intellection", "Learner", "Maximizer",
    "Positivity", "Relator", "Responsibility", "Restorative", "Self-Assurance",
    "Significance", "Strategic", "Woo"
}

_SYSTEM_PROMPT = (
    "You are an expert in organizational psychology and the CliftonStrengths assessment.\n"
    "You will be given a company culture document. Your task is to identify the core culture\n"
    "from the document and translate them to clifton strengths. Another way to think about it is\n"
    "which of the 34 CliftonStrengths themes would most likely thrive in this company's culture based\n"
    "on its stated values, behaviors, and environment. Finding clifton strengths that \n\n"
    "The 34 CliftonStrengths themes are:\n"
    "Achiever, Activator, Adaptability, Analytical, Arranger, Belief, Command,\n"
    "Communication, Competition, Connectedness, Consistency, Context, Deliberative,\n"
    "Developer, Discipline, Empathy, Focus, Futuristic, Harmony, Ideation, Includer,\n"
    "Individualization, Input, Intellection, Learner, Maximizer, Positivity, Relator,\n"
    "Responsibility, Restorative, Self-Assurance, Significance, Strategic, Woo\n\n"
    "Return ONLY a JSON object in this exact format, no preamble or explanation:\n"
    "{\n"
    '  "suggested_clifton_strengths": [\n'
    '    {"strength": "StrengthName", "rationale": "One sentence explanation."},\n'
    "    ...\n"
    "  ]\n"
    "}\n\n"
    "Return between 5 and 10 strengths aligned with the culture.\n"
    "Only use strength names from the list above exactly as written."
)


def extract_text_from_culture_doc(file_path: str) -> str:
    """Extract text from a culture document (PDF, DOCX, or DOC)."""
    try:
        ext = os.path.splitext(file_path.lower())[1]
        if ext == ".pdf":
            import pdfplumber
            parts = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        parts.append(text)
            full_text = "\n".join(parts)
        elif ext == ".docx":
            import docx
            doc = docx.Document(file_path)
            full_text = "\n".join(p.text for p in doc.paragraphs)
        elif ext == ".doc":
            import mammoth
            with open(file_path, "rb") as f:
                result = mammoth.extract_raw_text(f)
            full_text = result.value
        else:
            raise ValueError(f"Unsupported file type: {ext}")
        return full_text[:12000]
    except ValueError:
        raise
    except Exception as e:
        raise RuntimeError(f"Failed to extract text from culture document: {e}") from e


def suggest_clifton_strengths(text: str) -> list[dict]:
    """Use LLM to suggest CliftonStrengths that fit the given culture document text."""
    try:
        from openai import OpenAI
        api_key = os.environ.get("AZURE_OPENAI_API_KEY")
        base_url = os.environ.get("AZURE_OPENAI_EXPLANATION_BASE_URL")
        model = os.environ.get("AZURE_OPENAI_MATCH_EXPLAIN_MODEL", "Explanation-LLM")

        if not api_key or not base_url:
            logger.warning("OpenAI credentials not configured — skipping Clifton suggestions")
            return []

        client = OpenAI(api_key=api_key, base_url=base_url)

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            temperature=0.3,
        )

        try:
            parsed = json.loads(response.choices[0].message.content)
            raw = parsed.get("suggested_clifton_strengths", [])
        except (json.JSONDecodeError, KeyError, AttributeError) as e:
            logger.warning(f"Failed to parse LLM response: {e}")
            return []

        validated = []
        for item in raw:
            name = item.get("strength", "")
            if name not in VALID_CLIFTON_STRENGTHS:
                logger.warning(f"Dropping unrecognized Clifton Strength: '{name}'")
                continue
            validated.append({"strength": name, "rationale": item.get("rationale", "")})
        return validated

    except Exception as e:
        logger.error(f"suggest_clifton_strengths failed: {e}")
        return []
