# Contributing to HacktoShield (Bermuda PR Shielder) 🛡️

Thank you for your interest in contributing to **HacktoShield** during **Hacktoberfest**! We welcome contributions from developers of all skill levels.

---

## 🌟 Hacktoberfest Guidelines

We prioritize **meaningful open-source contributions**. To ensure your pull request is accepted:
1. Check the [Issues](../../issues) tab for tasks labeled with **`good first issue`** or **`hacktoberfest`**.
2. Avoid submitting trivial whitespace edits, cosmetic README changes, or automated bot pull requests.
3. If you find a bug or have a feature idea, please open an Issue to discuss it before submitting a PR.

---

## 🚀 Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AnshulKumar79/Bermuda_PR_Shielder.git
   cd Bermuda_PR_Shielder
   ```

2. **Create a Python virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Configure your environment:**
   Create a `.env` file in the root directory (or copy `backend/.env.example`):
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   GEMMA_MODEL=gemma2-9b-it
   PORT=8000
   ```
   *(Note: The app includes an automatic heuristic fallback mode if you don't have an API key yet).*

5. **Start the local server:**
   ```bash
   python -m uvicorn backend.main:app --reload --port 8000
   ```
   Visit `http://localhost:8000` to access the interactive web dashboard.

---

## 📌 Code Style & Commits
- Use semantic commit messages: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`.
- Ensure new endpoints include Pydantic type definitions in `backend/schema.py`.
