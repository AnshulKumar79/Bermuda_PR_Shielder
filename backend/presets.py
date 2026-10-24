PRESETS = {
    "spam_readme": {
        "id": "spam_readme",
        "name": "Spam / Trivial README Edit",
        "description": "Contributor added a random comma & newline to README.md to game Hacktoberfest swag.",
        "pr_title": "docs: update readme formatting",
        "pr_description": "Fixed minor formatting issues in README for better readability. Please merge for Hacktoberfest!",
        "contributor_username": "swag_hunter_99",
        "is_first_time": True,
        "diff_content": """diff --git a/README.md b/README.md
index 83a1b02..c192f11 100644
--- a/README.md
+++ b/README.md
@@ -12,4 +12,5 @@
 ## Getting Started
-Run `npm install` and then `npm start` to run the project locally.
+Run `npm install` and then `npm start` to run the project locally. 
+
 Thanks for using our tool!"""
    },
    "buggy_first_timer": {
        "id": "buggy_first_timer",
        "name": "First-Timer PR (Missing Null Check)",
        "description": "Genuine contributor added session token refresh, but forgot to handle expired/None tokens.",
        "pr_title": "feat(auth): refresh user session when near expiry",
        "pr_description": "Closes #142. Added an automatic token refresh logic so users don't get logged out abruptly. First time contributing to this repo!",
        "contributor_username": "dev_alex",
        "is_first_time": True,
        "diff_content": """diff --git a/src/auth/session.py b/src/auth/session.py
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
+    return session"""
    },
    "exposed_secret": {
        "id": "exposed_secret",
        "name": "Critical Security Risk (Leaked API Key)",
        "description": "Contributor accidentally hardcoded a production Groq API key in application config.",
        "pr_title": "fix: integrate groq client with direct key",
        "pr_description": "Added direct configuration for quick testing with Groq endpoint.",
        "contributor_username": "quick_coder_42",
        "is_first_time": False,
        "diff_content": """diff --git a/config/settings.py b/config/settings.py
index 12b4e89..77a1c90 100644
--- a/config/settings.py
+++ b/config/settings.py
@@ -10,3 +10,6 @@ DATABASE_URL = os.getenv("DATABASE_URL")
-GROQ_API_KEY = os.getenv("GROQ_API_KEY")
+GROQ_API_KEY = "gsk_live_98a7sdf897sdfy89sd7f897sdf897sd98f7"
+GROQ_MODEL = "gemma2-9b-it"
+DEBUG = True"""
    }
}
