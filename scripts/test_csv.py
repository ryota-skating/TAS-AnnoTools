#!/usr/bin/env python3
"""Test script to verify CSV processing"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("CSV Processing Test")
print("=" * 60)

# Test 1: Check CSV file exists
csv_path = Path(__file__).parent.parent / 'mapping' / 'labels.csv'
print(f"\n1. Checking CSV file: {csv_path}")
print(f"   Exists: {csv_path.exists()}")

if csv_path.exists():
    # Test 2: Read CSV
    import csv
    print(f"\n2. Reading CSV file...")
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        print(f"   Found {len(rows)} rows")
        print(f"   Columns: {reader.fieldnames}")

        # Show first 3 rows
        print(f"\n   First 3 rows:")
        for i, row in enumerate(rows[:3]):
            print(f"   {i}: {row}")

        # Check for ID sequence issues
        print(f"\n3. Checking ID sequence...")
        errors = []
        for i, row in enumerate(rows):
            try:
                row_id = int(row['id'])
                if row_id != i:
                    errors.append(f"   Row {i+2}: Expected ID {i}, got {row_id}")
            except ValueError:
                errors.append(f"   Row {i+2}: Invalid ID '{row['id']}'")

        if errors:
            print(f"   ❌ Found {len(errors)} ID sequence errors:")
            for err in errors[:5]:  # Show first 5
                print(err)
        else:
            print(f"   ✓ ID sequence is valid (0 to {len(rows)-1})")

print("\n" + "=" * 60)
print("Test Complete")
print("=" * 60)
