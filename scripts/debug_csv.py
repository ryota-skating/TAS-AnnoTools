#!/usr/bin/env python3
"""Debug version - test if script runs at all"""

print("Script started!")
print("Importing modules...")

try:
    import csv
    print("  ✓ csv")
    import sqlite3
    print("  ✓ sqlite3")
    import json
    print("  ✓ json")
    import argparse
    print("  ✓ argparse")
    import sys
    print("  ✓ sys")
    from pathlib import Path
    print("  ✓ pathlib")
    from dataclasses import dataclass
    print("  ✓ dataclasses")
    from typing import List, Optional, Dict, Tuple
    print("  ✓ typing")
    import re
    print("  ✓ re")
    from datetime import datetime
    print("  ✓ datetime")
    import shutil
    print("  ✓ shutil")

    print("\nAll imports successful!")

    # Check CSV file
    csv_path = Path(__file__).parent.parent / 'mapping' / 'labels.csv'
    print(f"\nChecking CSV: {csv_path}")
    print(f"  Exists: {csv_path.exists()}")
    print(f"  Absolute: {csv_path.absolute()}")

    if csv_path.exists():
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            print(f"  Rows: {len(rows)}")
            print(f"  First row: {rows[0] if rows else 'None'}")

    print("\n✓ Debug complete - no errors!")

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
