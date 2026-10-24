import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .schema import PRAnalysisRequest, PRAnalysisResponse
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

@app.get("/api/fetch-github-pr")
def fetch_github_pr(url: str):
    """Fetch public GitHub PR diff and metadata given a PR URL."""
    import re
    import requests

    pattern = r"github\.com/([^/]+)/([^/]+)/pull/(\d+)"
    match = re.search(pattern, url.strip())
    if not match:
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub PR URL. Format must be: https://github.com/owner/repo/pull/123"
        )
    
    owner, repo, pr_number = match.group(1), match.group(2), match.group(3)
    diff_url = f"https://github.com/{owner}/{repo}/pull/{pr_number}.diff"
    api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"

    headers = {"User-Agent": "HacktoShield-PR-Sentinel"}

    # 1. Fetch raw diff
    try:
        diff_res = requests.get(diff_url, headers=headers, timeout=12)
        if diff_res.status_code != 200:
            raise HTTPException(
                status_code=404,
                detail=f"Could not fetch diff from GitHub ({diff_res.status_code}). Please verify the PR exists and is public."
            )
        diff_content = diff_res.text
        if len(diff_content) > 12000:
            diff_content = diff_content[:12000] + "\n\n... [diff truncated for performance] ..."
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch PR diff: {str(e)}")

    # 2. Fetch metadata from GitHub API (fallback gracefully if unauthenticated rate limit)
    pr_title = f"PR #{pr_number} from {owner}/{repo}"
    pr_description = ""
    contributor = "contributor"

    try:
        api_res = requests.get(api_url, headers=headers, timeout=6)
        if api_res.status_code == 200:
            meta = api_res.json()
            pr_title = meta.get("title", pr_title)
            pr_description = meta.get("body", "") or ""
            contributor = meta.get("user", {}).get("login", contributor)
    except Exception:
        pass

    return {
        "repo_name": f"{owner}/{repo}",
        "pr_title": pr_title,
        "pr_description": pr_description,
        "contributor_username": contributor,
        "diff_content": diff_content,
        "pr_number": pr_number
    }

@app.post("/api/analyze-pr", response_model=PRAnalysisResponse)
def analyze_pr(request: PRAnalysisRequest):
    """Analyze a Pull Request and return structured triage & mentorship feedback."""
    if not request.diff_content.strip():
        raise HTTPException(status_code=400, detail="Git diff content cannot be empty.")
    
    result = analyze_pr_with_gemma(request)
    return result

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
