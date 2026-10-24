import os
import re
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .schema import PRAnalysisRequest, PRAnalysisResponse, FetchPRRequest
from .presets import PRESETS
from .service import analyze_pr_with_gemma, GROQ_API_KEY, GEMMA_MODEL

app = FastAPI(
    title="HacktoShield API",
    description="AI-powered Pull Request Sentinel & Contributor Mentor using Gemma 2 on Groq",
    version="1.0.0"
)

# Enable CORS for local dev / cross-origin frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    has_key = bool(os.getenv("GROQ_API_KEY", "").strip())
    return {
        "status": "online",
        "service": "HacktoShield",
        "model": GEMMA_MODEL,
        "groq_configured": has_key,
        "mode": "live_groq_gemma" if has_key else "resilient_heuristic_demo"
    }

@app.get("/api/presets")
def get_presets():
    """List available sample PR presets for 1-click testing."""
    return list(PRESETS.values())

@app.get("/api/presets/{preset_id}")
def get_preset_detail(preset_id: str):
    if preset_id not in PRESETS:
        raise HTTPException(status_code=404, detail="Preset not found")
    return PRESETS[preset_id]

@app.post("/api/analyze-pr", response_model=PRAnalysisResponse)
def analyze_pr(request: PRAnalysisRequest):
    """Analyze a Pull Request and return structured triage & mentorship feedback."""
    if not request.diff_content.strip():
        raise HTTPException(status_code=400, detail="Git diff content cannot be empty.")
    
    result = analyze_pr_with_gemma(request)
    return result

@app.post("/api/fetch-pr")
def fetch_github_pr(request: FetchPRRequest):
    """
    Fetch PR metadata (title, body, author, diff) from GitHub given a PR URL.
    Supports formats like:
      - https://github.com/owner/repo/pull/123
      - github.com/owner/repo/pull/123
      - owner/repo/pull/123
    """
    url = request.pr_url.strip()
    match = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", url) or re.search(r"^([^/]+)/([^/]+)/pull/(\d+)", url)
    if not match:
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123"
        )
    
    owner, repo, pull_number = match.group(1), match.group(2), match.group(3)
    
    headers = {
        "User-Agent": "HacktoShield-PR-Sentinel",
        "Accept": "application/vnd.github.v3+json"
    }
    github_token = os.getenv("GITHUB_TOKEN", "").strip()
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
    
    # 1. Fetch PR details from GitHub API
    api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}"
    try:
        resp = requests.get(api_url, headers=headers, timeout=12)
        if resp.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail=f"Pull request #{pull_number} not found in {owner}/{repo}. Please check the URL or ensure the repository is public."
            )
        if resp.status_code != 200:
            err_msg = resp.json().get("message", resp.text) if resp.headers.get("content-type", "").startswith("application/json") else resp.text
            raise HTTPException(status_code=resp.status_code, detail=f"GitHub API: {err_msg}")
        data = resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to connect to GitHub: {str(e)}")

    # 2. Fetch raw unified diff (.diff)
    diff_url = f"https://github.com/{owner}/{repo}/pull/{pull_number}.diff"
    diff_headers = {"User-Agent": "HacktoShield-PR-Sentinel"}
    if github_token:
        diff_headers["Authorization"] = f"Bearer {github_token}"
    try:
        diff_resp = requests.get(diff_url, headers=diff_headers, timeout=12)
        diff_content = diff_resp.text if diff_resp.status_code == 200 else ""
    except Exception:
        diff_content = ""

    author_association = data.get("author_association", "")
    is_first_time = author_association in ["FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "NONE"]
    
    user_data = data.get("user") or {}
    author_login = user_data.get("login", "contributor")

    return {
        "repo_name": f"{owner}/{repo}",
        "pull_number": int(pull_number),
        "pr_title": data.get("title", ""),
        "pr_description": data.get("body", "") or "",
        "contributor_username": author_login,
        "is_first_time": is_first_time,
        "diff_content": diff_content,
        "html_url": data.get("html_url", url),
        "state": data.get("state", "open")
    }

# Serve static frontend dashboard if frontend/dist or frontend static exists
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/")
    def serve_index():
        index_file = os.path.join(frontend_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "HacktoShield API is running. Visit /docs for API interactive documentation."}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
