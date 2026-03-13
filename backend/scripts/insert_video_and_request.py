import psycopg
import urllib.request, json, sys, time

def insert_video_for_keyword(keyword: str):
    conn = psycopg.connect(host="localhost", port=5432, dbname="gharka_chef", user="postgres", password="postgres123")
    cur = conn.cursor()
    # Insert a sample approved video for the keyword
    cur.execute(
        "INSERT INTO videos (keyword, url, title, thumbnail, channel, status) VALUES (%s, %s, %s, %s, %s, %s)",
        (keyword, f"https://www.youtube.com/watch?v=dQw4w9WgXcQ", f"Video for {keyword}", "", "Channel", "approved"),
    )
    conn.commit()
    conn.close()

def post_chat_same_chat(chat_id: int, message: str, token: str, include_videos: bool = True):
    url = "http://127.0.0.1:8005/chat"
    data = {"chat_id": chat_id, "message": message, "include_videos": include_videos}
    body = json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        sys.stdout.buffer.write(str(r.status).encode() + b"\n")
        sys.stdout.buffer.write(r.read())

def get_chat(chat_id: int, token: str):
    url = f"http://127.0.0.1:8005/chat/{chat_id}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        sys.stdout.buffer.write(str(r.status).encode() + b"\n")
        sys.stdout.buffer.write(r.read())

if __name__ == "__main__":
    token = "e33ab9ff-b913-408b-b2d5-4af7233d04ae"
    chat_id = 17
    message = "best veg curry which has high protein"
    # 1) show current chat
    print("=== GET existing chat ===")
    get_chat(chat_id, token)
    # 2) Insert video record for the expected title
    keyword = "Veggie Delight Curry"
    print("=== inserting video for keyword:", keyword, "===")
    insert_video_for_keyword(keyword)
    time.sleep(0.5)
    # 3) POST chat with include_videos True
    print("=== POST /chat with include_videos=true ===")
    post_chat_same_chat(chat_id, message, token, include_videos=True)
    time.sleep(0.5)
    # 4) fetch chat again
    print("=== GET chat after video request ===")
    get_chat(chat_id, token)

