#!/usr/bin/env python3
"""
Video File Renaming Script

Renames video files based on skater information from CSV.
Converts filenames like:
  men_olympic_short_program_2018_01_00019225_00023525.mp4
To:
  Olympic_Men_SP#1_MONTOYA_Felipe.mp4

Usage:
  python scripts/rename_videos.py [--dry-run] [--video-dir PATH] [--csv PATH]
"""

import csv
import re
import sys
from pathlib import Path
from typing import Dict, Tuple, Optional, List
from dataclasses import dataclass
import argparse


@dataclass
class SkaterInfo:
    """Skater information from CSV"""
    name: str
    starting_number: int
    competition: str  # "Olympic" or "WorldChampionship"
    gender: str  # "Men" or "Women"


@dataclass
class VideoFileInfo:
    """Parsed video file information"""
    original_path: Path
    competition: str
    gender: str
    starting_number: int
    year: int
    frame_start: int
    frame_end: int


class VideoRenamer:
    """Handles video file renaming based on CSV data"""

    def __init__(self, csv_path: Path, video_dir: Path):
        self.csv_path = csv_path
        self.video_dir = video_dir
        self.skaters: Dict[Tuple[str, str, int], SkaterInfo] = {}

    def parse_csv(self) -> None:
        """Parse CSV file and build skater lookup dictionary"""
        print(f"Reading CSV: {self.csv_path}")

        with open(self.csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            headers = next(reader)  # Skip header row 1
            column_headers = next(reader)  # Row with "Starting No.", "Name", etc.

            # Process each data row
            for row in reader:
                if not row or not any(row):  # Skip empty rows
                    continue

                # Men Olympic (columns 0-1)
                if len(row) > 1 and row[0].strip() and row[1].strip():
                    try:
                        num = int(row[0].strip())
                        name = row[1].strip()
                        key = ("Olympic", "Men", num)
                        self.skaters[key] = SkaterInfo(name, num, "Olympic", "Men")
                    except ValueError:
                        pass

                # Women Olympic (columns 2-3)
                if len(row) > 3 and row[2].strip() and row[3].strip():
                    try:
                        num = int(row[2].strip())
                        name = row[3].strip()
                        key = ("Olympic", "Women", num)
                        self.skaters[key] = SkaterInfo(name, num, "Olympic", "Women")
                    except ValueError:
                        pass

                # Men WorldChampionship (columns 4-5)
                if len(row) > 5 and row[4].strip() and row[5].strip():
                    try:
                        num = int(row[4].strip())
                        name = row[5].strip()
                        key = ("WorldChampionship", "Men", num)
                        self.skaters[key] = SkaterInfo(name, num, "WorldChampionship", "Men")
                    except ValueError:
                        pass

                # Women WorldChampionship (columns 6-7)
                if len(row) > 7 and row[6].strip() and row[7].strip():
                    try:
                        num = int(row[6].strip())
                        name = row[7].strip()
                        key = ("WorldChampionship", "Women", num)
                        self.skaters[key] = SkaterInfo(name, num, "WorldChampionship", "Women")
                    except ValueError:
                        pass

        print(f"  Loaded {len(self.skaters)} skater records")
        print(f"    Men Olympic: {sum(1 for k in self.skaters.keys() if k[0] == 'Olympic' and k[1] == 'Men')}")
        print(f"    Women Olympic: {sum(1 for k in self.skaters.keys() if k[0] == 'Olympic' and k[1] == 'Women')}")
        print(f"    Men WorldChampionship: {sum(1 for k in self.skaters.keys() if k[0] == 'WorldChampionship' and k[1] == 'Men')}")
        print(f"    Women WorldChampionship: {sum(1 for k in self.skaters.keys() if k[0] == 'WorldChampionship' and k[1] == 'Women')}")

    def parse_video_filename(self, filepath: Path) -> Optional[VideoFileInfo]:
        """
        Parse video filename to extract metadata.

        Expected format:
          {gender}_{competition}_short_program_{year}_{starting_number}_{frame_start}_{frame_end}.mp4

        Examples:
          men_olympic_short_program_2018_01_00019225_00023525.mp4
          women_world_short_program_2018_32_00458150_00462450.mp4
        """
        pattern = r'^(men|women)_(olympic|world)_short_program_(\d{4})_(\d+)_(\d+)_(\d+)\.mp4$'
        match = re.match(pattern, filepath.name)

        if not match:
            return None

        gender_raw, competition_raw, year, start_num, frame_start, frame_end = match.groups()

        # Normalize values
        gender = "Men" if gender_raw == "men" else "Women"
        competition = "Olympic" if competition_raw == "olympic" else "WorldChampionship"

        return VideoFileInfo(
            original_path=filepath,
            competition=competition,
            gender=gender,
            starting_number=int(start_num),
            year=int(year),
            frame_start=int(frame_start),
            frame_end=int(frame_end)
        )

    def generate_new_filename(self, video_info: VideoFileInfo) -> Optional[str]:
        """
        Generate new filename based on skater information.

        Format: {Competition}_{Gender}_SP#{Number}_{LastName}_{FirstName}.mp4
        Example: Olympic_Men_SP#1_MONTOYA_Felipe.mp4
        """
        key = (video_info.competition, video_info.gender, video_info.starting_number)
        skater = self.skaters.get(key)

        if not skater:
            return None

        # Parse name (format: "LASTNAME Firstname" or just "NAME")
        name_parts = skater.name.split(maxsplit=1)
        if len(name_parts) == 2:
            lastname, firstname = name_parts
        else:
            lastname = name_parts[0]
            firstname = ""

        # Build filename
        comp_short = "Olympic" if video_info.competition == "Olympic" else "World"

        if firstname:
            new_name = f"{comp_short}_{video_info.gender}_SP#{video_info.starting_number:02d}_{lastname}_{firstname}.mp4"
        else:
            new_name = f"{comp_short}_{video_info.gender}_SP#{video_info.starting_number:02d}_{lastname}.mp4"

        return new_name

    def find_video_files(self) -> List[Path]:
        """Find all video files in the video directory"""
        video_files = list(self.video_dir.glob("*.mp4"))
        print(f"\nFound {len(video_files)} video files in {self.video_dir}")
        return video_files

    def rename_videos(self, dry_run: bool = True) -> None:
        """
        Rename video files based on CSV data.

        Args:
            dry_run: If True, only show what would be renamed without making changes
        """
        video_files = self.find_video_files()

        if not video_files:
            print("  No video files found!")
            return

        rename_plan: List[Tuple[Path, Path]] = []
        skipped: List[Tuple[Path, str]] = []

        # Build rename plan
        for filepath in video_files:
            video_info = self.parse_video_filename(filepath)

            if not video_info:
                skipped.append((filepath, "Failed to parse filename"))
                continue

            new_filename = self.generate_new_filename(video_info)

            if not new_filename:
                skipped.append((filepath, f"No skater found for {video_info.competition} {video_info.gender} #{video_info.starting_number}"))
                continue

            new_path = filepath.parent / new_filename

            if new_path.exists() and new_path != filepath:
                skipped.append((filepath, f"Target already exists: {new_filename}"))
                continue

            rename_plan.append((filepath, new_path))

        # Display results
        print("\n" + "=" * 80)
        if dry_run:
            print("DRY RUN - No files will be renamed")
        else:
            print("RENAMING FILES")
        print("=" * 80)

        if rename_plan:
            print(f"\nFiles to rename ({len(rename_plan)}):")
            print("-" * 80)
            for old_path, new_path in rename_plan:
                print(f"  {old_path.name}")
                print(f"  → {new_path.name}")
                print()

        if skipped:
            print(f"\nSkipped files ({len(skipped)}):")
            print("-" * 80)
            for filepath, reason in skipped:
                print(f"  {filepath.name}")
                print(f"  Reason: {reason}")
                print()

        # Execute renames if not dry run
        if not dry_run and rename_plan:
            print("\nExecuting renames...")
            success_count = 0
            error_count = 0

            for old_path, new_path in rename_plan:
                try:
                    old_path.rename(new_path)
                    print(f"  ✓ Renamed: {old_path.name} → {new_path.name}")
                    success_count += 1
                except Exception as e:
                    print(f"  ✗ Failed: {old_path.name} - {e}")
                    error_count += 1

            print("\n" + "=" * 80)
            print(f"Rename complete: {success_count} succeeded, {error_count} failed")
            print("=" * 80)
        elif dry_run and rename_plan:
            print("\n" + "=" * 80)
            print("To execute these renames, run without --dry-run:")
            print("  python scripts/rename_videos.py")
            print("=" * 80)


def main():
    parser = argparse.ArgumentParser(
        description="Rename video files based on skater information from CSV"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        default=True,
        help='Show what would be renamed without making changes (default: True)'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Actually rename files (overrides --dry-run)'
    )
    parser.add_argument(
        '--video-dir',
        type=Path,
        default=None,
        help='Path to video directory (default: backend/videos/optimized/)'
    )
    parser.add_argument(
        '--csv',
        type=Path,
        default=None,
        help='Path to CSV file (default: starting_number_skaters_name.csv)'
    )

    args = parser.parse_args()

    # Determine paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    csv_path = args.csv or project_root / 'starting_number_skaters_name.csv'
    video_dir = args.video_dir or project_root / 'backend' / 'videos' / 'optimized'

    # Validate paths
    if not csv_path.exists():
        print(f"Error: CSV file not found: {csv_path}")
        sys.exit(1)

    if not video_dir.exists():
        print(f"Error: Video directory not found: {video_dir}")
        sys.exit(1)

    # Determine dry run mode
    dry_run = not args.execute

    print("=" * 80)
    print("Video File Renaming Tool")
    print("=" * 80)
    print(f"CSV file: {csv_path}")
    print(f"Video directory: {video_dir}")
    print(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE'}")
    print("=" * 80)

    # Execute renaming
    renamer = VideoRenamer(csv_path, video_dir)

    try:
        renamer.parse_csv()
        renamer.rename_videos(dry_run=dry_run)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    print("\n✓ Complete!")


if __name__ == '__main__':
    main()
