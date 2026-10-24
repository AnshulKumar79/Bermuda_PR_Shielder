from typing import List, Optional
from pydantic import BaseModel, Field

class FetchPRRequest(BaseModel):
    pr_url: str = Field(..., description="GitHub Pull Request URL (e.g. https://github.com/owner/repo/pull/123)")

class PRAnalysisRequest(BaseModel):
    repo_name: Optional[str] = Field("Bermuda_PR_Shielder", description="Target repository name")
    pr_title: str = Field(..., description="Title of the pull request")
    pr_description: Optional[str] = Field("", description="Description / motivation provided by contributor")
    diff_content: str = Field(..., description="The git diff or code changes")
    contributor_username: Optional[str] = Field("contributor", description="GitHub username of the contributor")
    is_first_time: Optional[bool] = Field(False, description="Flag indicating if this is their first contribution")

class MaintainerSummary(BaseModel):
    quick_decision: str = Field(..., description="Executive verdict (e.g., 'Close as Spam', 'Request Changes', 'Ready to Merge', 'Security Block')")
    risk_level: str = Field(..., description="Risk assessment: LOW, MEDIUM, HIGH, CRITICAL")
    key_changes: List[str] = Field(..., description="1-3 concise bullet points explaining what actually changed")
    suggested_labels: List[str] = Field(..., description="Recommended GitHub labels (e.g. ['hacktoberfest-accepted', 'needs-tests'])")

class PRAnalysisResponse(BaseModel):
    triage_verdict: str = Field(..., description="Categorical verdict: SPAM | NEEDS_IMPROVEMENT | READY_TO_MERGE | SECURITY_ALERT")
    confidence_score: int = Field(..., description="Confidence score between 0 and 100")
    category: str = Field(..., description="High-level category of contribution (e.g., 'Trivial Documentation', 'Security Vulnerability', 'Feature')")
    maintainer_summary: MaintainerSummary
    contributor_mentor_comment: str = Field(..., description="Empathetic, constructive GitHub comment directly mentoring the contributor")
    reasoning: Optional[str] = Field("", description="Gemma's brief explanation behind this triage decision")
