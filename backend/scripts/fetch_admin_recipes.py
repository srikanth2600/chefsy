#!/usr/bin/env python3
import urllib.request, json, sys

API = "http://127.0.0.1:8005/admin/recipes"
TOKEN = "ca8f5812-6bd8-4577-807a-d6c49a951cc6"

def main():
    req = urllib.request.Request(API, headers={"Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            j = json.load(r)
    except Exception as e:
        print("ERROR", e, file=sys.stderr)
        sys.exit(1)
    recs = j.get("recipes", [])
    print("total_recipes:", len(recs))
    print("first_20:")
    for idx, r in enumerate(recs[:20], start=1):
        print(f"{idx}. id={r.get('id')} key={r.get('recipe_key')} title={r.get('title')}")

if __name__ == '__main__':
    main()

