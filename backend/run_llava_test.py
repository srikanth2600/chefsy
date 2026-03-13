import sys
import json
import traceback

sys.path.insert(0, ".")

from app.application.recipe_service import generate_recipe
import os

def main():
    provider = os.environ.get("PROVIDER", "ollama:llava:13b")
    try:
        print(f"Starting test for 'vegetable soup' using provider={provider}...")
        r = generate_recipe("vegetable soup", provider=provider)
        print("SUCCESS")
        print(json.dumps(r, indent=2))
    except Exception:
        print("ERROR")
        traceback.print_exc()

if __name__ == "__main__":
    main()

