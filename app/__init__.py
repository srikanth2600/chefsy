from pathlib import Path

# Expose the `backend/app` directory as the top-level `app` package.
# This lets absolute imports like `app.api` resolve to `gharka-chef/backend/app`.
__path__.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "app"))

