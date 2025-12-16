import os
import re

# ▼ログファイルのパス
LOG_FILE = "rename_log.txt"

# ▼元に戻したいファイル（rename後のファイル）があるフォルダ
TARGET_DIR = r"C:\Users\ryota\TAS-AnnoTools\backend\videos\optimized"

# ▼ドライラン（True = 実行しないで確認のみ）
DRY_RUN = False

# renameログの "old → new" を抽出
pattern = re.compile(r"Renamed:\s+(.*?)\s+→\s+(.*?)$")

reverse_map = []
with open(LOG_FILE, "r", encoding="utf-8") as f:
    for line in f:
        m = pattern.search(line.strip())
        if m:
            old_name = m.group(1).strip()
            new_name = m.group(2).strip()
            reverse_map.append((new_name, old_name))

print(f"Found {len(reverse_map)} rename entries.\n")

# フォルダへ移動
os.chdir(TARGET_DIR)

for new_name, old_name in reverse_map:
    if not os.path.exists(new_name):
        print(f"⚠ Skipped (not found): {new_name}")
        continue

    print(f"{new_name} → {old_name}")

    if not DRY_RUN:
        os.rename(new_name, old_name)

print("\nDone.")
