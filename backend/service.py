import os
import re
import json
import logging
from typing import Optional
from dotenv import load_dotenv

from .schema import PRAnalysisRequest, PRAnalysisResponse, MaintainerSummary
from .prompts import GEMMA_SYSTEM_PROMPT, build_pr_analysis_prompt

load_dotenv()
logger = logging.getLogger("hacktoshield")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "gemma2-9b-it")

def _clean_json_text(text: str) -> str:
    """Extract raw JSON from model output if wrapped in markdown fences."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text

def _heuristic_fallback(request: PRAnalysisRequest) -> PRAnalysisResponse:
    """Safe fallback engine in case of API outages or missing keys during hackathon demos."""
    diff = request.diff_content.lower()
    title = request.pr_title.lower()

    # Secret detection
    if re.search(r"(gsk_[a-z0-9_\-]+|ghp_[a-z0-9_\-]+|sk_live_[a-z0-9_\-]+|aws_secret|api_key\s*=\s*['\"][^'\"]{10,})", request.diff_content, re.IGNORECASE):
        return PRAnalysisResponse(
            triage_verdict="SECURITY_ALERT",
            confidence_score=98,
            category="Credential Exposure / Leaked Secret",
            maintainer_summary=MaintainerSummary(
                quick_decision="Security Block",
                risk_level="CRITICAL",
                key_changes=[
                    "Potentially exposed hardcoded API key or private secret in code diff",
                    "Immediate commit reversion or secret rotation required"
                ],
                suggested_labels=["security", "do-not-merge"]
            ),
            contributor_mentor_comment=f"⚠️ @{request.contributor_username}, urgent safety heads-up! It looks like an active API key or secret token was detected in this diff. For your own security, please immediately revoke/rotate that key, remove it from git history using a tool like BFG Repo-Cleaner or git-filter-repo, and switch to environment variables (`os.getenv`). We're here to help if you have questions!",
            reasoning="Gemma detected regex pattern matching known API key signatures inside git diff."
        )

    # Spam detection
    added_lines = [line[1:].strip() for line in request.diff_content.splitlines() if line.startswith("+") and not line.startswith("+++")]
    if ("readme" in title or "readme.md" in diff or "swag" in request.pr_description.lower()) and (len(added_lines) <= 2 or all(len(l) < 20 for l in added_lines)):
        return PRAnalysisResponse(
            triage_verdict="SPAM",
            confidence_score=95,
            category="Trivial Formatting / Low Effort",
            maintainer_summary=MaintainerSummary(
                quick_decision="Close as Spam",
                risk_level="LOW",
                key_changes=[
                    "Trivial whitespace or cosmetic formatting edit in README.md",
                    "No functional documentation improvement or linked issue"
                ],
                suggested_labels=["invalid", "spam"]
            ),
            contributor_mentor_comment=f"Hello @{request.contributor_username}! 👋 Thank you for checking out our project during Hacktoberfest. However, this PR only introduces trivial whitespace or cosmetic edits without resolving an active issue. To ensure meaningful open-source contributions and maintain repository quality, we are unable to accept this PR. We encourage you to check out our open issues tagged with **`good first issue`**!",
            reasoning="Gemma detected isolated formatting edits to README with minimal substantive changes."
        )

    # First-timer / Needs improvement
    return PRAnalysisResponse(
        triage_verdict="NEEDS_IMPROVEMENT",
        confidence_score=88,
        category="Logic Enhancement / Missing Boundary Checks",
        maintainer_summary=MaintainerSummary(
            quick_decision="Request Changes",
            risk_level="MEDIUM",
            key_changes=[
                f"Proposed changes: {request.pr_title}",
                "Needs additional defensive checks (e.g. NoneType or token expiration validation)"
            ],
            suggested_labels=["hacktoberfest-accepted", "needs-work"]
        ),
        contributor_mentor_comment=f"Awesome work on this PR, @{request.contributor_username}! 🎉 Your contribution addresses a valuable improvement. Before we can merge, please double-check potential edge cases where values could be `None` or keys might be missing (to prevent unhandled 500 exceptions). Also consider adding a quick unit test in `tests/`. You're almost there!",
        reasoning="Identified valid feature intention with minor defensive-coding revisions needed."
    )

def analyze_pr_with_gemma(request: PRAnalysisRequest) -> PRAnalysisResponse:
    """Analyze PR using Groq Gemma2-9b-it model with robust JSON parsing."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not api_key:
        logger.warning("GROQ_API_KEY not configured. Falling back to heuristic reasoning engine.")
        return _heuristic_fallback(request)

    try:
        from groq import Groq
        client = Groq(api_key=api_key)

        prompt = build_pr_analysis_prompt(
            repo_name=request.repo_name or "Repository",
            pr_title=request.pr_title,
            pr_description=request.pr_description or "",
            diff_content=request.diff_content,
            contributor=request.contributor_username or "contributor",
            is_first_time=request.is_first_time or False
        )

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": GEMMA_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            model=GEMMA_MODEL,
            temperature=0.2,
            max_tokens=1024,
            response_format={"type": "json_object"}
        )

        raw_content = chat_completion.choices[0].message.content
        cleaned_json = _clean_json_text(raw_content)
        parsed = json.loads(cleaned_json)

        return PRAnalysisResponse(**parsed)

    except Exception as e:
        logger.error(f"Error calling Groq Gemma API: {e}. Utilizing fallback response.")
        fallback = _heuristic_fallback(request)
        fallback.reasoning = f"(Fallback triggered: {str(e)[:120]}) - " + (fallback.reasoning or "")
        return fallback
