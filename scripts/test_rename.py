#!/usr/bin/env python3
"""Quick test of rename_videos.py logic"""

from pathlib import Path
import sys

# Test parsing a few filenames
test_files = [
    "men_olympic_short_program_2018_01_00019225_00023525.mp4",
    "women_world_short_program_2018_32_00458150_00462450.mp4",
]

print("Testing filename parsing:")
import re

pattern = r'^(men|women)_(olympic|world)_short_program_(\d{4})_(\d+)_(\d+)_(\d+)\.mp4$'

for filename in test_files:
    match = re.match(pattern, filename)
    if match:
        gender_raw, competition_raw, year, start_num, frame_start, frame_end = match.groups()
        gender = "Men" if gender_raw == "men" else "Women"
        competition = "Olympic" if competition_raw == "olympic" else "WorldChampionship"
        print(f"\n{filename}")
        print(f"  Competition: {competition}")
        print(f"  Gender: {gender}")
        print(f"  Starting #: {int(start_num)}")
    else:
        print(f"\n{filename} - NO MATCH")

# Test CSV parsing
print("\n" + "=" * 60)
print("Testing CSV parsing:")
csv_path = Path(__file__).parent.parent / 'starting_number_skaters_name.csv'
print(f"CSV: {csv_path}")
print(f"Exists: {csv_path.exists()}")

if csv_path.exists():
    import csv
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        headers = next(reader)
        column_headers = next(reader)

        print(f"\nFirst 3 data rows:")
        for i, row in enumerate(reader):
            if i >= 3:
                break
            if row and any(row):
                print(f"  Row {i+1}: {row}")

                # Men Olympic (columns 0-1)
                if len(row) > 1 and row[0].strip() and row[1].strip():
                    print(f"    Men Olympic #{row[0]}: {row[1]}")

                # Women Olympic (columns 2-3)
                if len(row) > 3 and row[2].strip() and row[3].strip():
                    print(f"    Women Olympic #{row[2]}: {row[3]}")

    # Show a sample rename
    print("\n" + "=" * 60)
    print("Sample rename for men_olympic_short_program_2018_01_*.mp4:")
    print("  Competition: Olympic")
    print("  Gender: Men")
    print("  Starting #: 1")
    print("  Skater: MONTOYA Felipe")
    print("  New filename: Olympic_Men_SP#01_MONTOYA_Felipe.mp4")

print("\n✓ Test complete!")
