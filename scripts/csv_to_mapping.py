#!/usr/bin/env python3
"""
CSV to Mapping Converter
Converts labels.csv to mapping files and updates database

Usage:
    uv run scripts/csv_to_mapping.py mapping/labels.csv
    uv run scripts/csv_to_mapping.py mapping/labels.csv --dry-run
    uv run scripts/csv_to_mapping.py mapping/labels.csv --no-db
"""

import csv
import sqlite3
import json
import argparse
import sys
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
import re
from datetime import datetime
import shutil


@dataclass
class ElementRecord:
    """Represents a single element from CSV"""
    id: int
    set_label: str
    element_label: str
    color: Optional[str] = None


@dataclass
class SetRecord:
    """Represents a category/set"""
    id: int
    name: str
    color: str


# Color mapping from mappingService.ts (lines 214-237)
CATEGORY_COLORS: Dict[str, str] = {
    'Three_Turn': '#3b82f6',     # Blue
    'Bracket_Turn': '#8b5cf6',   # Purple
    'Rocker_Turn': '#06b6d4',    # Cyan
    'Counter_Turn': '#10b981',   # Emerald
    'Loop_Turn': '#f59e0b',      # Amber
    'Twizzle': '#ef4444',        # Red
    'Toe_Step': '#ec4899',       # Pink
    'Chasse': '#84cc16',         # Lime
    'Mohawk': '#f97316',         # Orange
    'Choctaw': '#8b5cf6',        # Violet
    'Change_of_Edge': '#06b6d4', # Cyan
    'Cross_Roll': '#059669',     # Emerald
    'Swing_Roll': '#0d9488',     # Teal
    'Cross_Over': '#7c3aed',     # Violet
    'Spiral': '#db2777',         # Pink
    'Arabesque': '#be185d',      # Rose
    'Spread_Eagles': '#c2410c',  # Orange
    'Ina_Bauers': '#7c2d12',     # Orange
    'Hydroblading': '#1e40af',   # Blue
    'Knee_Slide': '#374151',     # Gray
    'NONE': '#6b7280',           # Gray
    'Other': '#9ca3af'           # Light Gray
}


def get_default_color(set_name: str) -> str:
    """Get default color for a set/category"""
    return CATEGORY_COLORS.get(set_name, CATEGORY_COLORS['Other'])


def read_csv(csv_path: Path) -> List[ElementRecord]:
    """Read and parse CSV file"""
    records = []

    try:
        with open(csv_path, 'r', encoding='utf-8-sig') as f:  # utf-8-sig handles BOM
            reader = csv.DictReader(f)

            # Validate header
            required_cols = {'id', 'set_label', 'element_label'}
            if not required_cols.issubset(set(reader.fieldnames or [])):
                raise ValueError(f"CSV missing required columns. Required: {required_cols}, Found: {reader.fieldnames}")

            for row_num, row in enumerate(reader, start=2):  # start=2 accounts for header
                try:
                    element_id = int(row['id'])
                except ValueError:
                    raise ValueError(f"Line {row_num}: Invalid ID format '{row['id']}' (must be integer)")

                set_label = row['set_label'].strip()
                element_label = row['element_label'].strip()

                if not set_label:
                    raise ValueError(f"Line {row_num}: set_label cannot be empty")
                if not element_label:
                    raise ValueError(f"Line {row_num}: element_label cannot be empty")

                # Color is optional
                color = row.get('color', '').strip() or None

                record = ElementRecord(
                    id=element_id,
                    set_label=set_label,
                    element_label=element_label,
                    color=color
                )
                records.append(record)

    except FileNotFoundError:
        raise ValueError(f"CSV file not found: {csv_path}")
    except Exception as e:
        raise ValueError(f"Error reading CSV: {e}")

    if not records:
        raise ValueError("CSV file contains no data rows")

    return records


def validate_csv(records: List[ElementRecord]) -> List[str]:
    """Validate CSV data, return list of error messages"""
    errors = []

    # Check ID sequence (must be 0, 1, 2, ... N)
    for i, record in enumerate(records):
        if record.id != i:
            errors.append(f"Element at row {i+2}: Expected ID {i}, got {record.id} (IDs must be sequential starting from 0)")

    # Check for duplicate IDs
    id_counts: Dict[int, int] = {}
    for record in records:
        id_counts[record.id] = id_counts.get(record.id, 0) + 1

    for element_id, count in id_counts.items():
        if count > 1:
            errors.append(f"Duplicate ID {element_id} appears {count} times")

    # Check for duplicate element names
    name_counts: Dict[str, int] = {}
    for record in records:
        name_counts[record.element_label] = name_counts.get(record.element_label, 0) + 1

    for name, count in name_counts.items():
        if count > 1:
            errors.append(f"Duplicate element_label '{name}' appears {count} times")

    # Validate colors
    color_pattern = re.compile(r'^#[0-9A-Fa-f]{6}$')
    for record in records:
        if record.color and not color_pattern.match(record.color):
            errors.append(f"ID {record.id} ('{record.element_label}'): Invalid color format '{record.color}' (must be #RRGGBB)")

    return errors


def extract_sets(records: List[ElementRecord]) -> List[SetRecord]:
    """
    Extract unique set labels and assign sequential IDs.
    Preserve order of first appearance.
    """
    seen_sets: Dict[str, int] = {}  # {set_name: first_appearance_index}
    set_colors: Dict[str, str] = {}  # {set_name: color}

    for i, record in enumerate(records):
        set_name = record.set_label
        if set_name not in seen_sets:
            seen_sets[set_name] = i
            # Use color from first element in set, or generate default
            set_colors[set_name] = record.color if record.color else get_default_color(set_name)

    # Sort by first appearance, assign sequential IDs
    sorted_sets = sorted(seen_sets.items(), key=lambda x: x[1])

    return [
        SetRecord(id=i, name=name, color=set_colors[name])
        for i, (name, _) in enumerate(sorted_sets)
    ]


def generate_element_mapping(records: List[ElementRecord]) -> str:
    """Generate mapping_step_element.txt content"""
    lines = []
    for record in records:
        lines.append(f"{record.id} {record.element_label}")
    return '\n'.join(lines) + '\n'


def generate_set_mapping(sets: List[SetRecord]) -> str:
    """Generate mapping_step_set.txt content"""
    lines = []
    for set_record in sets:
        lines.append(f"{set_record.id} {set_record.name}")
    return '\n'.join(lines) + '\n'


def create_backups(mapping_dir: Path) -> Dict[str, Path]:
    """Create timestamped backups of existing mapping files"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_paths = {}

    element_file = mapping_dir / 'mapping_step_element.txt'
    set_file = mapping_dir / 'mapping_step_set.txt'

    if element_file.exists():
        backup = mapping_dir / f'mapping_step_element.txt.backup_{timestamp}'
        shutil.copy2(element_file, backup)
        backup_paths['element'] = backup
        print(f"  Created backup: {backup.name}")

    if set_file.exists():
        backup = mapping_dir / f'mapping_step_set.txt.backup_{timestamp}'
        shutil.copy2(set_file, backup)
        backup_paths['set'] = backup
        print(f"  Created backup: {backup.name}")

    return backup_paths


def restore_from_backups(backup_paths: Dict[str, Path], mapping_dir: Path):
    """Restore files from backups"""
    if 'element' in backup_paths:
        element_file = mapping_dir / 'mapping_step_element.txt'
        shutil.copy2(backup_paths['element'], element_file)
        print(f"  Restored: {element_file.name}")

    if 'set' in backup_paths:
        set_file = mapping_dir / 'mapping_step_set.txt'
        shutil.copy2(backup_paths['set'], set_file)
        print(f"  Restored: {set_file.name}")


def write_mapping_files(
    element_content: str,
    set_content: str,
    mapping_dir: Path,
    dry_run: bool
) -> None:
    """Write mapping files"""
    element_file = mapping_dir / 'mapping_step_element.txt'
    set_file = mapping_dir / 'mapping_step_set.txt'

    if dry_run:
        print("\n[DRY RUN] Would write mapping files:")
        print(f"  {element_file}")
        print(f"  {set_file}")
        return

    # Write new files
    element_file.write_text(element_content, encoding='utf-8')
    set_file.write_text(set_content, encoding='utf-8')

    print(f"\n✓ Generated: {element_file}")
    print(f"✓ Generated: {set_file}")


def build_label_items_json(records: List[ElementRecord], sets: List[SetRecord]) -> str:
    """Build items_json structure for database"""
    # Build set lookup
    set_map = {s.name: s.id for s in sets}

    items = []
    for record in records:
        item = {
            'elementId': record.id,
            'name': record.element_label,
            'category': record.set_label,
            'color': record.color if record.color else get_default_color(record.set_label),
            'description': record.element_label.replace('_', ' '),
            'enabled': True
        }
        items.append(item)

    return json.dumps(items, indent=2)


def update_database(
    records: List[ElementRecord],
    sets: List[SetRecord],
    db_path: Path,
    project: str,
    dry_run: bool
) -> None:
    """Update label_sets table with new configuration"""

    items_json = build_label_items_json(records, sets)

    if dry_run:
        print("\n[DRY RUN] Would update database:")
        print(f"  Project: {project}")
        print(f"  Items count: {len(records)}")
        print(f"  Database: {db_path}")
        print(f"\n  Sample item:")
        items = json.loads(items_json)
        print(f"  {json.dumps(items[0], indent=4)}")
        return

    # Check database exists
    if not db_path.exists():
        raise ValueError(f"Database file not found: {db_path}")

    # Connect to database
    conn = None
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Begin transaction
        cursor.execute("BEGIN TRANSACTION")

        # Get next version
        cursor.execute(
            "SELECT MAX(version) FROM label_sets WHERE project = ?",
            (project,)
        )
        result = cursor.fetchone()
        next_version = (result[0] or 0) + 1

        # Insert new version
        cursor.execute("""
            INSERT INTO label_sets (project, version, items_json, updated_by, mapping_name)
            VALUES (?, ?, ?, ?, ?)
        """, (
            project,
            next_version,
            items_json,
            'csv_import_script',
            'default'
        ))

        # Commit transaction
        conn.commit()

        print(f"\n✓ Updated database:")
        print(f"  Project: {project}")
        print(f"  Version: {next_version}")
        print(f"  Items: {len(records)}")

    except Exception as e:
        if conn:
            conn.rollback()
        raise Exception(f"Database update failed: {e}")
    finally:
        if conn:
            conn.close()


def main():
    parser = argparse.ArgumentParser(
        description='Convert CSV labels to mapping files and update database',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  uv run scripts/csv_to_mapping.py mapping/labels.csv
  uv run scripts/csv_to_mapping.py mapping/labels.csv --dry-run
  uv run scripts/csv_to_mapping.py mapping/labels.csv --no-db
        """
    )
    parser.add_argument('csv_path', type=Path,
                       help='Path to CSV file')
    parser.add_argument('--dry-run', action='store_true',
                       help='Validate and preview without making changes')
    parser.add_argument('--no-db', action='store_true',
                       help='Skip database update')
    parser.add_argument('--db-path', type=Path,
                       default=Path('backend/data/annotations.db'),
                       help='Database path (default: backend/data/annotations.db)')
    parser.add_argument('--project', default='default',
                       help='Project name for database update (default: default)')
    parser.add_argument('--verbose', action='store_true',
                       help='Show detailed output')

    args = parser.parse_args()

    # Convert to absolute paths
    script_dir = Path(__file__).parent.parent  # Project root
    csv_path = script_dir / args.csv_path if not args.csv_path.is_absolute() else args.csv_path
    db_path = script_dir / args.db_path if not args.db_path.is_absolute() else args.db_path
    mapping_dir = script_dir / 'mapping'

    backup_paths = {}

    try:
        print(f"Processing CSV: {csv_path}")
        print("=" * 60)

        # Read and validate CSV
        print("\n1. Reading CSV...")
        records = read_csv(csv_path)
        print(f"   Found {len(records)} elements")

        print("\n2. Validating CSV...")
        errors = validate_csv(records)

        if errors:
            print("\n❌ Validation errors:")
            for error in errors:
                print(f"   - {error}")
            sys.exit(1)
        print("   ✓ Validation passed")

        # Extract unique sets
        print("\n3. Extracting categories...")
        sets = extract_sets(records)
        print(f"   Found {len(sets)} unique categories")
        if args.verbose:
            for s in sets:
                print(f"     - {s.id}: {s.name} ({s.color})")

        # Generate mapping file contents
        print("\n4. Generating mapping files...")
        element_content = generate_element_mapping(records)
        set_content = generate_set_mapping(sets)

        if args.dry_run:
            print("\n" + "=" * 60)
            print("DRY RUN MODE - No changes will be made")
            print("=" * 60)

            print("\n[PREVIEW] mapping_step_element.txt (first 10 lines):")
            preview_lines = element_content.split('\n')[:10]
            for line in preview_lines:
                if line:
                    print(f"  {line}")
            if len(element_content.split('\n')) > 10:
                print(f"  ... ({len(records) - 10} more lines)")

            print("\n[PREVIEW] mapping_step_set.txt:")
            for line in set_content.split('\n'):
                if line:
                    print(f"  {line}")

            write_mapping_files(element_content, set_content, mapping_dir, dry_run=True)

            if not args.no_db:
                update_database(records, sets, db_path, args.project, dry_run=True)

            print("\n✓ Dry run completed successfully")
            print("\nTo apply changes, run without --dry-run flag")
            sys.exit(0)

        # Create backups
        print("\n5. Creating backups...")
        backup_paths = create_backups(mapping_dir)
        if not backup_paths:
            print("   (No existing files to backup)")

        # Write mapping files
        print("\n6. Writing mapping files...")
        write_mapping_files(element_content, set_content, mapping_dir, dry_run=False)

        # Update database
        if not args.no_db:
            print("\n7. Updating database...")
            update_database(records, sets, db_path, args.project, dry_run=False)
        else:
            print("\n7. Skipping database update (--no-db)")

        print("\n" + "=" * 60)
        print(f"✓ SUCCESS: Processed {len(records)} elements, {len(sets)} categories")
        print("=" * 60)

        if not args.no_db:
            print("\nNext steps:")
            print("1. Restart the backend server to load new mapping files")
            print("2. Verify changes in the web UI")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")

        # Rollback: restore from backups
        if backup_paths and not args.dry_run:
            print("\n⚠ Rolling back changes...")
            restore_from_backups(backup_paths, mapping_dir)
            print("✓ Files restored from backup")

        sys.exit(1)


if __name__ == '__main__':
    main()
