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
