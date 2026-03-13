import urllib.request, json, sys

def main():
    url = "http://127.0.0.1:8005/chat"
    data = json.dumps({"message": "best veg curry which has high protein"}).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer e33ab9ff-b913-408b-b2d5-4af7233d04ae",
    }
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        sys.stdout.buffer.write(str(r.status).encode() + b"\n")
        sys.stdout.buffer.write(r.read())

if __name__ == "__main__":
    main()

