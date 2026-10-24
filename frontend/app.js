// HacktoShield Frontend Application Logic

// Local backup of presets in case API call hasn't resolved
const FALLBACK_PRESETS = {
  spam_readme: {
    pr_title: "docs: update readme formatting",
    pr_description: "Fixed minor formatting issues in README for better readability. Please merge for Hacktoberfest!",
    contributor_username: "swag_hunter_99",
    is_first_time: true,
    diff_content: `diff --git a/README.md b/README.md
index 83a1b02..c192f11 100644
--- a/README.md
+++ b/README.md
@@ -12,4 +12,5 @@
 ## Getting Started
-Run \`npm install\` and then \`npm start\` to run the project locally.
+Run \`npm install\` and then \`npm start\` to run the project locally. 
+
 Thanks for using our tool!`
  },
  buggy_first_timer: {
    pr_title: "feat(auth): refresh user session when near expiry",
    pr_description: "Closes #142. Added automatic token refresh logic so users don't get logged out abruptly. First time contributing to this repo!",
    contributor_username: "dev_alex",
    is_first_time: true,
    diff_content: `diff --git a/src/auth/session.py b/src/auth/session.py
index 45f7a10..98d2e33 100644
--- a/src/auth/session.py
+++ b/src/auth/session.py
@@ -34,6 +34,13 @@ def check_and_refresh_session(session: dict) -> dict:
+    # Refresh session if expiring in less than 5 minutes
+    time_left = session["expires_at"] - current_timestamp()
+    if time_left < 300:
+        new_token = request_token_refresh(session["refresh_token"])
+        session["token"] = new_token["access_token"]
+        session["expires_at"] = new_token["expires_in"] + current_timestamp()
+    return session`
  },
  exposed_secret: {
    pr_title: "fix: integrate groq client with direct key",
    pr_description: "Added direct configuration for quick testing with Groq endpoint.",
    contributor_username: "quick_coder_42",
    is_first_time: false,
    diff_content: `diff --git a/config/settings.py b/config/settings.py
index 12b4e89..77a1c90 100644
--- a/config/settings.py
+++ b/config/settings.py
@@ -10,3 +10,6 @@ DATABASE_URL = os.getenv("DATABASE_URL")
-GROQ_API_KEY = os.getenv("GROQ_API_KEY")
+GROQ_API_KEY = "gsk_live_98a7sdf897sdfy89sd7f897sdf897sd98f7"
+GROQ_MODEL = "gemma-4"
+DEBUG = True`
  }
};

let currentPresets = FALLBACK_PRESETS;

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const prForm = document.getElementById("prForm");
  const prTitle = document.getElementById("prTitle");
  const contributorName = document.getElementById("contributorName");
  const prDesc = document.getElementById("prDesc");
  const isFirstTime = document.getElementById("isFirstTime");
  const diffContent = document.getElementById("diffContent");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const presetButtons = document.querySelectorAll(".preset-btn");
  const customInputBtn = document.getElementById("customInputBtn");

  const placeholderState = document.getElementById("placeholderState");
  const loadingState = document.getElementById("loadingState");
  const loadingMessage = document.getElementById("loadingMessage");
  const outputContent = document.getElementById("outputContent");

  const verdictBanner = document.getElementById("verdictBanner");
  const verdictIcon = document.getElementById("verdictIcon");
  const verdictLabel = document.getElementById("verdictLabel");
  const verdictCategory = document.getElementById("verdictCategory");
  const confidenceScore = document.getElementById("confidenceScore");

  const quickDecision = document.getElementById("quickDecision");
  const riskPill = document.getElementById("riskPill");
  const changesList = document.getElementById("changesList");
  const suggestedLabels = document.getElementById("suggestedLabels");
  const mentorComment = document.getElementById("mentorComment");
  const reasoningText = document.getElementById("reasoningText");
  const copyCommentBtn = document.getElementById("copyCommentBtn");
  const toast = document.getElementById("toast");

  // Load presets from backend
  try {
    const res = await fetch("/api/presets");
    if (res.ok) {
      const data = await res.json();
      currentPresets = {};
      data.forEach(p => { currentPresets[p.id] = p; });
    }
  } catch (err) {
    console.warn("Using fallback presets:", err);
  }

  // Load initial preset
  loadPreset("spam_readme");

  // Preset button clicks
  presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      presetButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const presetId = btn.getAttribute("data-preset");
      if (presetId && currentPresets[presetId]) {
        loadPreset(presetId);
      }
    });
  });

  if (customInputBtn) {
    customInputBtn.addEventListener("click", () => {
      presetButtons.forEach(b => b.classList.remove("active"));
      customInputBtn.classList.add("active");
      prTitle.value = "";
      prDesc.value = "";
      contributorName.value = "contributor";
      diffContent.value = "";
      diffContent.focus();
    });
  }

  // Live GitHub PR URL Fetcher
  const githubPrUrl = document.getElementById("githubPrUrl");
  const fetchPrBtn = document.getElementById("fetchPrBtn");

  if (fetchPrBtn && githubPrUrl) {
    fetchPrBtn.addEventListener("click", async () => {
      const url = githubPrUrl.value.trim();
      if (!url) {
        alert("Please paste a valid GitHub PR URL (e.g. https://github.com/owner/repo/pull/123)");
        githubPrUrl.focus();
        return;
      }

      fetchPrBtn.disabled = true;
      const originalText = fetchPrBtn.innerHTML;
      fetchPrBtn.innerHTML = "<span>⏳</span> Fetching...";

      try {
        const res = await fetch(`/api/fetch-github-pr?url=${encodeURIComponent(url)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || "Failed to fetch PR from GitHub");
        }

        // Fill form fields
        prTitle.value = data.pr_title || "";
        prDesc.value = data.pr_description || "";
        contributorName.value = data.contributor_username || "contributor";
        diffContent.value = data.diff_content || "";
        isFirstTime.checked = true;

        // Deselect presets to indicate custom PR
        presetButtons.forEach(b => b.classList.remove("active"));
        if (customInputBtn) customInputBtn.classList.add("active");

        // Toast notification
        toast.textContent = `📥 Loaded PR #${data.pr_number} from ${data.repo_name}!`;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2500);

      } catch (err) {
        console.error("Fetch error:", err);
        alert(`Could not fetch PR: ${err.message}`);
      } finally {
        fetchPrBtn.disabled = false;
        fetchPrBtn.innerHTML = originalText;
      }
    });

    // Allow pressing Enter in URL input to trigger fetch
    githubPrUrl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        fetchPrBtn.click();
      }
    });
  }

  function loadPreset(presetKey) {
    const p = currentPresets[presetKey];
    if (!p) return;
    prTitle.value = p.pr_title || "";
    prDesc.value = p.pr_description || "";
    contributorName.value = p.contributor_username || "contributor";
    isFirstTime.checked = Boolean(p.is_first_time);
    diffContent.value = p.diff_content || "";
  }

  // Form submission
  prForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      repo_name: "Bermuda_PR_Shielder",
      pr_title: prTitle.value.trim(),
      pr_description: prDesc.value.trim(),
      diff_content: diffContent.value.trim(),
      contributor_username: contributorName.value.trim() || "contributor",
      is_first_time: isFirstTime.checked
    };

    if (!payload.diff_content) {
      alert("Please provide a git diff to analyze.");
      return;
    }

    // UI state: loading
    placeholderState.style.display = "none";
    outputContent.style.display = "none";
    loadingState.style.display = "flex";
    analyzeBtn.disabled = true;

    const loadingMsgs = [
      "Analyzing git diff unified syntax...",
      "Feeding payload to Gemma 4 on Groq...",
      "Evaluating Hacktoberfest contribution authenticity...",
      "Synthesizing empathetic contributor feedback..."
    ];
    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % loadingMsgs.length;
      loadingMessage.textContent = loadingMsgs[msgIdx];
    }, 600);

    try {
      const response = await fetch("/api/analyze-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      clearInterval(interval);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();
      renderResults(result);

    } catch (err) {
      clearInterval(interval);
      console.error("Audit failed:", err);
      alert(`Audit failed: ${err.message}. Please check if the backend server is running.`);
    } finally {
      loadingState.style.display = "none";
      analyzeBtn.disabled = false;
    }
  });

  function renderResults(data) {
    outputContent.style.display = "block";

    // Confidence
    confidenceScore.textContent = `${data.confidence_score || 95}%`;

    // Verdict Banner & Styling
    verdictBanner.className = "verdict-banner";
    const verdict = data.triage_verdict || "NEEDS_IMPROVEMENT";

    if (verdict === "SPAM") {
      verdictBanner.classList.add("verdict-spam");
      verdictIcon.textContent = "🚨";
      verdictLabel.textContent = "SPAM / TRIVIAL DETECTED";
    } else if (verdict === "SECURITY_ALERT") {
      verdictBanner.classList.add("verdict-security");
      verdictIcon.textContent = "🔥";
      verdictLabel.textContent = "CRITICAL SECURITY RISK";
    } else if (verdict === "READY_TO_MERGE") {
      verdictBanner.classList.add("verdict-merge");
      verdictIcon.textContent = "✅";
      verdictLabel.textContent = "READY TO MERGE";
    } else {
      verdictBanner.classList.add("verdict-needs-work");
      verdictIcon.textContent = "🌱";
      verdictLabel.textContent = "NEEDS REVISION (COACHING READY)";
    }

    verdictCategory.textContent = data.category || "General Contribution";

    // Maintainer Card
    const m = data.maintainer_summary || {};
    quickDecision.textContent = m.quick_decision || "--";

    const risk = (m.risk_level || "LOW").toUpperCase();
    riskPill.className = `risk-pill risk-${risk}`;
    riskPill.textContent = `${risk} RISK`;

    changesList.innerHTML = "";
    (m.key_changes || []).forEach(change => {
      const li = document.createElement("li");
      li.textContent = change;
      changesList.appendChild(li);
    });

    suggestedLabels.innerHTML = "";
    (m.suggested_labels || []).forEach(lbl => {
      const span = document.createElement("span");
      span.className = "github-label";
      span.textContent = lbl;
      suggestedLabels.appendChild(span);
    });

    // Contributor Card
    mentorComment.textContent = data.contributor_mentor_comment || "No comment generated.";

    // Reasoning
    reasoningText.textContent = data.reasoning || "Gemma completed evaluation based on commit intent and syntax rules.";
  }

  // Copy Comment Button
  copyCommentBtn.addEventListener("click", () => {
    const text = mentorComment.textContent;
    navigator.clipboard.writeText(text).then(() => {
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2200);
    }).catch(err => {
      console.error("Clipboard write error:", err);
    });
  });

});
