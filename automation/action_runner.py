"""
HacktoShield GitHub Action Runner
Executes within GitHub Actions CI/CD to triage Pull Requests and mentor contributors.
"""

import os
import json
import sys
import requests

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from backend.schema import PRAnalysisRequest
from backend.service import analyze_pr_with_gemma

def get_pr_event_data():
    event_path = os.getenv("GITHUB_EVENT_PATH")
    if not event_path or not os.path.exists(event_path):
        print("[!] GITHUB_EVENT_PATH not set or file not found. Running in local simulation mode.")
        return None
    with open(event_path, "r", encoding="utf-8") as f:
        return json.load(f)

def run_github_action():
    token = os.getenv("GITHUB_TOKEN")
    event = get_pr_event_data()

    if not event or "pull_request" not in event:
        # Local CLI Simulation Mode
        sample_file = sys.argv[1] if len(sys.argv) > 1 else "samples/01_spam_readme.diff"
        print(f"[*] Running in Local CLI Simulation Mode using: {sample_file}")
        
        diff_text = ""
        if os.path.exists(sample_file):
            with open(sample_file, "r", encoding="utf-8") as f:
                diff_text = f.read()
        else:
            diff_text = "diff --git a/README.md b/README.md\n+minor tweak"

        req = PRAnalysisRequest(
            repo_name="Bermuda_PR_Shielder",
            pr_title="docs: update readme formatting",
            pr_description="Fixed formatting in README. Please merge for Hacktoberfest!",
            diff_content=diff_text,
            contributor_username="swag_hunter_99",
            is_first_time=True
        )

        print("[*] Analyzing PR diff with Gemma 4...")
        result = analyze_pr_with_gemma(req)
        print("\n" + "="*50)
        print(f"VERDICT:       {result.triage_verdict} (Confidence: {result.confidence_score}%)")
        print(f"DECISION:      {result.maintainer_summary.quick_decision}")
        print(f"RISK LEVEL:    {result.maintainer_summary.risk_level}")
        print(f"LABELS:        {', '.join(result.maintainer_summary.suggested_labels)}")
        print("="*50)
        print("\nCONTRIBUTOR MENTOR COMMENT:")
        print(result.contributor_mentor_comment)
        print("="*50)
        return

    pr = event["pull_request"]
    pr_number = pr["number"]
    pr_title = pr.get("title", "")
    pr_body = pr.get("body", "") or ""
    contributor = pr.get("user", {}).get("login", "contributor")
    repo_full_name = os.getenv("GITHUB_REPOSITORY", "org/repo")
    comments_url = pr.get("comments_url")
    labels_url = f"https://api.github.com/repos/{repo_full_name}/issues/{pr_number}/labels"

    # Fetch PR diff
    diff_url = pr.get("diff_url")
    diff_content = ""
    headers = {"Authorization": f"token {token}"} if token else {}
    if diff_url:
        try:
            r = requests.get(diff_url, headers=headers, timeout=15)
            if r.status_code == 200:
                diff_content = r.text
        except Exception as e:
            print(f"[!] Could not fetch diff from {diff_url}: {e}")

    if not diff_content:
        diff_content = f"Title: {pr_title}\nDescription: {pr_body}"

    # Analyze with Gemma
    req = PRAnalysisRequest(
        repo_name=repo_full_name,
        pr_title=pr_title,
        pr_description=pr_body,
        diff_content=diff_content,
        contributor_username=contributor,
        is_first_time=True
    )
    
    print(f"[*] Triaging PR #{pr_number} by @{contributor} using Gemma 4...")
    result = analyze_pr_with_gemma(req)
    print(f"[+] Verdict: {result.triage_verdict} (Confidence: {result.confidence_score}%)")

    if not token or not comments_url:
        print("[!] GITHUB_TOKEN not available. Printing output locally:\n")
        print("=== MAINTAINER DECISION ===")
        print(f"Decision: {result.maintainer_summary.quick_decision}")
        print(f"Risk: {result.maintainer_summary.risk_level}")
        print("\n=== CONTRIBUTOR COMMENT ===")
        print(result.contributor_mentor_comment)
        return

    # Post Comment on GitHub PR
    comment_payload = {
        "body": f"""### 🛡️ HacktoShield Automated Audit (Powered by Gemma 4)

**Verdict:** `{result.triage_verdict}` | **Risk:** `{result.maintainer_summary.risk_level}`

---

{result.contributor_mentor_comment}

<details>
<summary><b>Maintainer Triage Digest</b></summary>

- **Quick Decision:** {result.maintainer_summary.quick_decision}
- **Category:** {result.category}
- **Key Changes:**
{chr(10).join(f"  - {change}" for change in result.maintainer_summary.key_changes)}

<sub>Confidence: {result.confidence_score}% • Evaluated by Gemma 4 on Groq LPU</sub>
</details>
"""
    }

    try:
        comment_res = requests.post(comments_url, headers=headers, json=comment_payload)
        if comment_res.status_code in [200, 201]:
            print(f"[✓] Mentorship comment successfully posted to PR #{pr_number}")
        else:
            print(f"[!] Failed to post comment: {comment_res.status_code} {comment_res.text}")

        # Post labels
        if result.maintainer_summary.suggested_labels:
            labels_payload = {"labels": result.maintainer_summary.suggested_labels}
            requests.post(labels_url, headers=headers, json=labels_payload)
            print(f"[✓] Labels applied: {result.maintainer_summary.suggested_labels}")

    except Exception as e:
        print(f"[!] Error communicating with GitHub API: {e}")

if __name__ == "__main__":
    run_github_action()
