// HacktoShield Frontend Application Logic
// Enhanced with Real-time Diff Telemetry, HUD Meters, and Keyboard Shortcuts

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
    return session`
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
  const verdictStatusPill = document.getElementById("verdictStatusPill");
  const confidenceScore = document.getElementById("confidenceScore");
  const confidenceRing = document.getElementById("confidenceRing");

  const quickDecision = document.getElementById("quickDecision");
  const riskPill = document.getElementById("riskPill");
  const changesList = document.getElementById("changesList");
  const suggestedLabels = document.getElementById("suggestedLabels");
  const mentorComment = document.getElementById("mentorComment");
  const reasoningText = document.getElementById("reasoningText");
  const copyCommentBtn = document.getElementById("copyCommentBtn");
  const copyBtnText = document.getElementById("copyBtnText");
  const toast = document.getElementById("toast");

  // PR Auto-Fetch elements
  const prUrlInput = document.getElementById("prUrlInput");
  const fetchPrBtn = document.getElementById("fetchPrBtn");
  const fetchBtnText = document.getElementById("fetchBtnText");
  const fetchSpinner = document.getElementById("fetchSpinner");
  const importStatusRow = document.getElementById("importStatusRow");
  const importStatusBadge = document.getElementById("importStatusBadge");
  const panelSub = document.querySelector(".panel-sub");

  // Terminal stats elements
  const diffAddedCount = document.getElementById("diffAddedCount");
  const diffDeletedCount = document.getElementById("diffDeletedCount");
  const diffTotalLines = document.getElementById("diffTotalLines");
  const clearDiffBtn = document.getElementById("clearDiffBtn");

  // Risk meter HUD bars
  const rb1 = document.getElementById("rb1");
  const rb2 = document.getElementById("rb2");
  const rb3 = document.getElementById("rb3");
  const rb4 = document.getElementById("rb4");

  // Loading step indicators
  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  const step3 = document.getElementById("step3");

  // Live diff stats calculation
  function updateDiffStats() {
    const text = diffContent.value || "";
    const lines = text.split("\n");
    let added = 0;
    let deleted = 0;

    lines.forEach(line => {
      if (line.startsWith("+") && !line.startsWith("+++")) added++;
      else if (line.startsWith("-") && !line.startsWith("---")) deleted++;
    });

    if (diffAddedCount) diffAddedCount.textContent = `+${added} lines`;
    if (diffDeletedCount) diffDeletedCount.textContent = `-${deleted} lines`;
    if (diffTotalLines) diffTotalLines.textContent = `${lines.length} lines`;
  }

  diffContent.addEventListener("input", updateDiffStats);

  // Auto-Fetch PR Logic from GitHub URL
  async function fetchPRDetails(rawUrl) {
    const url = (rawUrl || (prUrlInput ? prUrlInput.value : "")).trim();
    if (!url) {
      if (prUrlInput) prUrlInput.focus();
      return;
    }

    if (fetchPrBtn) fetchPrBtn.disabled = true;
    if (fetchSpinner) fetchSpinner.style.display = "inline-block";
    if (fetchBtnText) fetchBtnText.textContent = "Fetching...";
    if (importStatusRow && importStatusBadge) {
      importStatusRow.style.display = "block";
      importStatusBadge.className = "import-status-badge status-loading";
      importStatusBadge.textContent = "Connecting to GitHub & fetching unified diff...";
    }

    try {
      const response = await fetch("/api/fetch-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pr_url: url })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP Error ${response.status}`);
      }

      const data = await response.json();

      // Populate form fields
      prTitle.value = data.pr_title || "";
      contributorName.value = data.contributor_username || "contributor";
      prDesc.value = data.pr_description || "";
      isFirstTime.checked = Boolean(data.is_first_time);
      diffContent.value = data.diff_content || "";
      updateDiffStats();

      if (panelSub) {
        panelSub.textContent = `Target: ${data.repo_name} (PR #${data.pull_number})`;
      }

      // Mark presets as inactive, set custom active
      presetButtons.forEach(b => b.classList.remove("active"));
      if (customInputBtn) customInputBtn.classList.add("active");

      // Success indicator
      if (importStatusBadge) {
        importStatusBadge.className = "import-status-badge status-success";
        importStatusBadge.textContent = `Loaded ${data.repo_name} #${data.pull_number}: "${(data.pr_title || '').slice(0, 45)}${(data.pr_title || '').length > 45 ? '...' : ''}"`;
      }

      toast.querySelector(".toast-title").textContent = "PR Fetched Successfully";
      toast.querySelector(".toast-sub").textContent = `${data.repo_name} #${data.pull_number} loaded into context`;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2600);

    } catch (err) {
      console.error("PR Fetch Error:", err);
      if (importStatusBadge) {
        importStatusBadge.className = "import-status-badge status-error";
        importStatusBadge.textContent = `Error: ${err.message}`;
      }
    } finally {
      if (fetchPrBtn) fetchPrBtn.disabled = false;
      if (fetchSpinner) fetchSpinner.style.display = "none";
      if (fetchBtnText) fetchBtnText.textContent = "Fetch PR";
    }
  }

  if (fetchPrBtn) {
    fetchPrBtn.addEventListener("click", () => fetchPRDetails());
  }

  if (prUrlInput) {
    prUrlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        fetchPRDetails();
      }
    });

    // Auto-fetch when user pastes a valid GitHub PR link
    let debounceTimer;
    prUrlInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const val = prUrlInput.value.trim();
      if (/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/.test(val)) {
        debounceTimer = setTimeout(() => {
          fetchPRDetails(val);
        }, 350);
      }
    });
  }

  // Tab key support in diff editor for clean indentation
  diffContent.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = diffContent.selectionStart;
      const end = diffContent.selectionEnd;
      diffContent.value = diffContent.value.substring(0, start) + "  " + diffContent.value.substring(end);
      diffContent.selectionStart = diffContent.selectionEnd = start + 2;
      updateDiffStats();
    }
  });

  // Clear diff button
  if (clearDiffBtn) {
    clearDiffBtn.addEventListener("click", () => {
      diffContent.value = "";
      updateDiffStats();
      diffContent.focus();
    });
  }

  // Keyboard shortcut: Ctrl+Enter (or Cmd+Enter) to trigger audit
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!analyzeBtn.disabled) {
        prForm.requestSubmit ? prForm.requestSubmit() : prForm.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    }
  });

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

  // Check health and update header telemetry if available
  try {
    const healthRes = await fetch("/api/health");
    if (healthRes.ok) {
      const healthData = await healthRes.json();
      const statusText = document.getElementById("apiStatusText");
      if (statusText && healthData.status === "online") {
        statusText.textContent = healthData.groq_configured ? "ONLINE (GROQ)" : "ONLINE (DEMO)";
      }
    }
  } catch (e) {
    console.debug("Health endpoint ping skipped");
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
      updateDiffStats();
      diffContent.focus();
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
    updateDiffStats();
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

    // Reset loading step pills
    if (step1 && step2 && step3) {
      step1.className = "step-pill active";
      step2.className = "step-pill";
      step3.className = "step-pill";
    }

    const loadingMsgs = [
      { text: "Parsing git diff unified syntax...", step: 1 },
      { text: "Accelerating prompt with Groq LPU (300+ tok/s)...", step: 2 },
      { text: "Gemma 4 evaluating Hacktoberfest authenticity...", step: 2 },
      { text: "Synthesizing empathetic contributor feedback...", step: 3 }
    ];
    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % loadingMsgs.length;
      loadingMessage.textContent = loadingMsgs[msgIdx].text;
      
      const curStep = loadingMsgs[msgIdx].step;
      if (step1 && step2 && step3) {
        step1.className = curStep >= 1 ? "step-pill active" : "step-pill";
        step2.className = curStep >= 2 ? "step-pill active" : "step-pill";
        step3.className = curStep >= 3 ? "step-pill active" : "step-pill";
      }
    }, 550);

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

    // Confidence score & SVG Ring Animation
    const conf = data.confidence_score || 95;
    confidenceScore.textContent = `${conf}%`;
    if (confidenceRing) {
      confidenceRing.setAttribute("stroke-dasharray", `${conf}, 100`);
      if (conf >= 85) confidenceRing.style.stroke = "#10b981";
      else if (conf >= 60) confidenceRing.style.stroke = "#00f2fe";
      else confidenceRing.style.stroke = "#f59e0b";
    }

    // Verdict Banner & Styling
    verdictBanner.className = "verdict-banner";
    const verdict = data.triage_verdict || "NEEDS_IMPROVEMENT";

    if (verdict === "SPAM") {
      verdictBanner.classList.add("verdict-spam");
      verdictIcon.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
      verdictLabel.textContent = "SPAM / TRIVIAL DETECTED";
      if (verdictStatusPill) verdictStatusPill.textContent = "FLAGGED FOR CLOSURE";
    } else if (verdict === "SECURITY_ALERT") {
      verdictBanner.classList.add("verdict-security");
      verdictIcon.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      verdictLabel.textContent = "CRITICAL SECURITY RISK";
      if (verdictStatusPill) verdictStatusPill.textContent = "BLOCK MERGE & ROTATE";
    } else if (verdict === "READY_TO_MERGE") {
      verdictBanner.classList.add("verdict-merge");
      verdictIcon.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      verdictLabel.textContent = "READY TO MERGE";
      if (verdictStatusPill) verdictStatusPill.textContent = "FAST-TRACK APPROVED";
    } else {
      verdictBanner.classList.add("verdict-needs-work");
      verdictIcon.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>`;
      verdictLabel.textContent = "NEEDS REVISION (COACHING READY)";
      if (verdictStatusPill) verdictStatusPill.textContent = "MENTORSHIP FEEDBACK";
    }

    verdictCategory.textContent = data.category || "General Contribution";

    // Maintainer Card
    const m = data.maintainer_summary || {};
    quickDecision.textContent = m.quick_decision || "--";

    const risk = (m.risk_level || "LOW").toUpperCase();
    riskPill.className = `risk-pill risk-${risk}`;
    riskPill.textContent = `${risk} RISK`;

    // Animate Risk Meter HUD Bars
    updateRiskMeterBars(risk);

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

  function updateRiskMeterBars(risk) {
    if (!rb1 || !rb2 || !rb3 || !rb4) return;
    rb1.className = "risk-bar";
    rb2.className = "risk-bar";
    rb3.className = "risk-bar";
    rb4.className = "risk-bar";

    if (risk === "LOW") {
      rb1.className = "risk-bar active-low";
    } else if (risk === "MEDIUM") {
      rb1.className = "risk-bar active-med";
      rb2.className = "risk-bar active-med";
    } else if (risk === "HIGH") {
      rb1.className = "risk-bar active-high";
      rb2.className = "risk-bar active-high";
      rb3.className = "risk-bar active-high";
    } else if (risk === "CRITICAL") {
      rb1.className = "risk-bar active-high";
      rb2.className = "risk-bar active-high";
      rb3.className = "risk-bar active-high";
      rb4.className = "risk-bar active-high";
    }
  }

  // Copy Comment Button
  copyCommentBtn.addEventListener("click", () => {
    const text = mentorComment.textContent;
    navigator.clipboard.writeText(text).then(() => {
      copyCommentBtn.classList.add("copied");
      if (copyBtnText) copyBtnText.textContent = "Copied to Clipboard";
      toast.classList.add("show");
      
      setTimeout(() => {
        toast.classList.remove("show");
        copyCommentBtn.classList.remove("copied");
        if (copyBtnText) copyBtnText.textContent = "Copy Markdown";
      }, 2400);
    }).catch(err => {
      console.error("Clipboard write error:", err);
    });
  });

});
