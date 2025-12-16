#!/usr/bin/env python3
"""
Video File Name Restoration Script

Restores renamed video files back to their original format.
Converts filenames like:
  Olympic_Men_SP#01_MONTOYA_Felipe.mp4
Back to:
  men_olympic_short_program_2018_01_00019225_00023525.mp4

Usage:
  python scripts/restore_original_names.py [--dry-run] [--video-dir PATH]
"""

import re
import sys
from pathlib import Path
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass
import argparse


@dataclass
class RenamedFileInfo:
    """Parsed renamed file information"""
    original_path: Path
    competition: str  # "Olympic" or "World"
    gender: str  # "Men" or "Women"
    starting_number: int


@dataclass
class OriginalFileInfo:
    """Original file information"""
    gender: str
    competition: str
    starting_number: int
    frame_start: int
    frame_end: int


class NameRestorer:
    """Handles restoring original video filenames"""

    # Mapping table built from the rename log you provided
    RENAME_MAP: Dict[str, str] = {
        "Olympic_Men_SP#01_MONTOYA_Felipe.mp4": "men_olympic_short_program_2018_01_00019225_00023525.mp4",
        "Olympic_Men_SP#02_BESSEGHIER_Chafik.mp4": "men_olympic_short_program_2018_02_00028750_00033050.mp4",
        "Olympic_Men_SP#03_ZHOU_Vincent.mp4": "men_olympic_short_program_2018_03_00039100_00043350.mp4",
        "Olympic_Men_SP#04_TEN_Denis.mp4": "men_olympic_short_program_2018_04_00048975_00053150.mp4",
        "Olympic_Men_SP#05_RIZZO_Matteo.mp4": "men_olympic_short_program_2018_05_00058500_00062850.mp4",
        "Olympic_Men_SP#06_MARTINEZ_Michael Christian.mp4": "men_olympic_short_program_2018_06_00068525_00072825.mp4",
        "Olympic_Men_SP#07_PANIOT_Yaroslav.mp4": "men_olympic_short_program_2018_07_00090200_00094500.mp4",
        "Olympic_Men_SP#08_YAN_Han.mp4": "men_olympic_short_program_2018_08_00100125_00104375.mp4",
        "Olympic_Men_SP#09_YEE_Julian Zhi Jie.mp4": "men_olympic_short_program_2018_09_00110175_00114450.mp4",
        "Olympic_Men_SP#10_KERRY_Brendan.mp4": "men_olympic_short_program_2018_10_00120325_00124625.mp4",
        "Olympic_Men_SP#11_KVITELASHVILI_Morisi.mp4": "men_olympic_short_program_2018_11_00129850_00134100.mp4",
        "Olympic_Men_SP#12_MESSING_Keegan.mp4": "men_olympic_short_program_2018_12_00139800_00144125.mp4",
        "Olympic_Men_SP#13_BREZINA_Michal.mp4": "men_olympic_short_program_2018_13_00161975_00166300.mp4",
        "Olympic_Men_SP#14_CHA_Junhwan.mp4": "men_olympic_short_program_2018_14_00172125_00176400.mp4",
        "Olympic_Men_SP#15_FENTZ_Paul.mp4": "men_olympic_short_program_2018_15_00182075_00186325.mp4",
        "Olympic_Men_SP#16_GE_Misha.mp4": "men_olympic_short_program_2018_16_00191625_00195825.mp4",
        "Olympic_Men_SP#17_HENDRICKX_Jorik.mp4": "men_olympic_short_program_2018_17_00201750_00205975.mp4",
        "Olympic_Men_SP#18_SAMOHIN_Daniel.mp4": "men_olympic_short_program_2018_18_00211000_00215325.mp4",
        "Olympic_Men_SP#19_RIPPON_Adam.mp4": "men_olympic_short_program_2018_19_00233400_00237625.mp4",
        "Olympic_Men_SP#20_ALIEV_Dmitri.mp4": "men_olympic_short_program_2018_20_00243325_00247600.mp4",
        "Olympic_Men_SP#21_CHAN_Patrick.mp4": "men_olympic_short_program_2018_21_00253325_00257575.mp4",
        "Olympic_Men_SP#22_TANAKA_Keiji.mp4": "men_olympic_short_program_2018_22_00263175_00267425.mp4",
        "Olympic_Men_SP#23_BYCHENKO_Alexei.mp4": "men_olympic_short_program_2018_23_00272975_00277250.mp4",
        "Olympic_Men_SP#24_VASILJEVS_Deniss.mp4": "men_olympic_short_program_2018_24_00283000_00287175.mp4",
        "Olympic_Men_SP#25_HANYU_Yuzuru.mp4": "men_olympic_short_program_2018_25_00307075_00311350.mp4",
        "Olympic_Men_SP#26_CHEN_Nathan.mp4": "men_olympic_short_program_2018_26_00317650_00321950.mp4",
        "Olympic_Men_SP#27_KOLYADA_Mikhail.mp4": "men_olympic_short_program_2018_27_00326425_00330700.mp4",
        "Olympic_Men_SP#28_UNO_Shoma.mp4": "men_olympic_short_program_2018_28_00336125_00340400.mp4",
        "Olympic_Men_SP#29_FERNANDEZ_Javier.mp4": "men_olympic_short_program_2018_29_00345950_00350225.mp4",
        "Olympic_Men_SP#30_JIN_Boyang.mp4": "men_olympic_short_program_2018_30_00356100_00360375.mp4",
        "World_Men_SP#01_Slavik_HAYRAPETYAN.mp4": "men_world_short_program_2018_01_00034225_00038525.mp4",
        "World_Men_SP#02_Brendan_KERRY.mp4": "men_world_short_program_2018_02_00044050_00048375.mp4",
        "World_Men_SP#03_Javier_RAYA.mp4": "men_world_short_program_2018_03_00053975_00058200.mp4",
        "World_Men_SP#04_Burak_DEMIRBOGA.mp4": "men_world_short_program_2018_04_00062325_00066575.mp4",
        "World_Men_SP#05_Chih-I_TSAO.mp4": "men_world_short_program_2018_05_00071625_00075975.mp4",
        "World_Men_SP#06_Phillip_HARRIS.mp4": "men_world_short_program_2018_06_00093950_00098100.mp4",
        "World_Men_SP#07_Romain_PONSART.mp4": "men_world_short_program_2018_07_00103400_00107575.mp4",
        "World_Men_SP#08_Valtter_VIRTANEN.mp4": "men_world_short_program_2018_08_00112975_00117250.mp4",
        "World_Men_SP#09_Julian_Zhi Jie YEE.mp4": "men_world_short_program_2018_09_00122775_00127050.mp4",
        "World_Men_SP#10_Jinseo_KIM.mp4": "men_world_short_program_2018_10_00133450_00137700.mp4",
        "World_Men_SP#12_Kazuki_TOMONO.mp4": "men_world_short_program_2018_12_00185775_00190075.mp4",
        "World_Men_SP#13_Abzal_RAKIMGALIEV.mp4": "men_world_short_program_2018_13_00196950_00201250.mp4",
        "World_Men_SP#14_Nicholas_VRDOLJAK.mp4": "men_world_short_program_2018_14_00206750_00211050.mp4",
        "World_Men_SP#15_Donovan_CARRILLO.mp4": "men_world_short_program_2018_15_00215450_00219675.mp4",
        "World_Men_SP#16_Larry_LOUPOLOVER.mp4": "men_world_short_program_2018_16_00237250_00241525.mp4",
        "World_Men_SP#17_Paul_FENTZ.mp4": "men_world_short_program_2018_17_00245875_00250150.mp4",
        "World_Men_SP#18_Stephane_WALKER.mp4": "men_world_short_program_2018_18_00255650_00259975.mp4",
        "World_Men_SP#19_Ivan_PAVLOV.mp4": "men_world_short_program_2018_19_00265150_00269425.mp4",
        "World_Men_SP#20_Keegan_MESSING.mp4": "men_world_short_program_2018_20_00275025_00279300.mp4",
        "World_Men_SP#21_Michal_BREZINA.mp4": "men_world_short_program_2018_21_00311750_00316075.mp4",
        "World_Men_SP#22_Morisi_KVITELASHVILI.mp4": "men_world_short_program_2018_22_00321100_00325350.mp4",
        "World_Men_SP#23_Matteo_RIZZO.mp4": "men_world_short_program_2018_23_00330575_00334925.mp4",
        "World_Men_SP#24_Donovan_CARRILLO.mp4": "men_world_short_program_2018_24_00341000_00345300.mp4",
        "World_Men_SP#25_Nam_NGUYEN.mp4": "men_world_short_program_2018_25_00350300_00354450.mp4",
        "World_Men_SP#26_Daniel_SAMOHIN.mp4": "men_world_short_program_2018_26_00371775_00376100.mp4",
        "World_Men_SP#27_Stephane_WALKER.mp4": "men_world_short_program_2018_27_00381550_00385775.mp4",
        "World_Men_SP#28_Burak_DEMIRBOGA.mp4": "men_world_short_program_2018_28_00391750_00395975.mp4",
        "World_Men_SP#31_Misha_GE.mp4": "men_world_short_program_2018_31_00420700_00424950.mp4",
        "World_Men_SP#32_Mikhail_KOLYADA.mp4": "men_world_short_program_2018_32_00448850_00453100.mp4",
        "World_Men_SP#33_Alexei_BYCHENKO.mp4": "men_world_short_program_2018_33_00458475_00462750.mp4",
        "World_Men_SP#34_Nathan_CHEN.mp4": "men_world_short_program_2018_34_00468025_00472325.mp4",
        "World_Men_SP#35_Dmitri_ALIEV.mp4": "men_world_short_program_2018_35_00477850_00482100.mp4",
        "World_Men_SP#36_Boyang_JIN.mp4": "men_world_short_program_2018_36_00487675_00491925.mp4",
        "World_Men_SP#37_Shoma_UNO.mp4": "men_world_short_program_2018_37_00497500_00501775.mp4",
        "Olympic_Women_SP#01_TENNELL_Bradie.mp4": "women_olympic_short_program_2018_01_00019125_00023350.mp4",
        "Olympic_Women_SP#02_WILLIAMS_Isadora.mp4": "women_olympic_short_program_2018_02_00028975_00033275.mp4",
        "Olympic_Women_SP#03_KHNYCHENKOVA_Anna.mp4": "women_olympic_short_program_2018_03_00038750_00042975.mp4",
        "Olympic_Women_SP#04_NIKITINA_Diana.mp4": "women_olympic_short_program_2018_04_00048950_00053200.mp4",
        "Olympic_Women_SP#05_KIM_Hanul.mp4": "women_olympic_short_program_2018_05_00058775_00063075.mp4",
        "Olympic_Women_SP#06_OESTLUND_Anita.mp4": "women_olympic_short_program_2018_06_00068425_00072750.mp4",
        "Olympic_Women_SP#07_LI_Xiangning.mp4": "women_olympic_short_program_2018_07_00090250_00094600.mp4",
        "Olympic_Women_SP#08_PAGANINI_Alexia.mp4": "women_olympic_short_program_2018_08_00100075_00104325.mp4",
        "Olympic_Women_SP#09_MAMBEKOVA_Aiza.mp4": "women_olympic_short_program_2018_09_00110100_00114375.mp4",
        "Olympic_Women_SP#10_PELTONEN_Emmi.mp4": "women_olympic_short_program_2018_10_00120125_00124375.mp4",
        "Olympic_Women_SP#11_AUSTMAN_Larkyn.mp4": "women_olympic_short_program_2018_11_00129625_00133900.mp4",
        "Olympic_Women_SP#12_MEITE_Mae Berenice.mp4": "women_olympic_short_program_2018_12_00139700_00144000.mp4",
        "Olympic_Women_SP#13_CRAINE_Kailani.mp4": "women_olympic_short_program_2018_13_00162925_00167175.mp4",
        "Olympic_Women_SP#14_TOTH_Ivett.mp4": "women_olympic_short_program_2018_14_00172825_00177100.mp4",
        "Olympic_Women_SP#15_RUSSO_Giada.mp4": "women_olympic_short_program_2018_15_00182450_00186750.mp4",
        "Olympic_Women_SP#16_HENDRICKX_Loena.mp4": "women_olympic_short_program_2018_16_00192800_00197075.mp4",
        "Olympic_Women_SP#17_SCHOTT_Nicole.mp4": "women_olympic_short_program_2018_17_00202550_00206850.mp4",
        "Olympic_Women_SP#18_RAJICOVA_Nicole.mp4": "women_olympic_short_program_2018_18_00212550_00216800.mp4",
        "Olympic_Women_SP#19_SAKAMOTO_Kaori.mp4": "women_olympic_short_program_2018_19_00234550_00238825.mp4",
        "Olympic_Women_SP#20_NAGASU_Mirai.mp4": "women_olympic_short_program_2018_20_00244425_00248700.mp4",
        "Olympic_Women_SP#21_DALEMAN_Gabrielle.mp4": "women_olympic_short_program_2018_21_00254025_00258300.mp4",
        "Olympic_Women_SP#22_CHEN_Karen.mp4": "women_olympic_short_program_2018_22_00264175_00268475.mp4",
        "Olympic_Women_SP#23_TURSYNBAEVA_Elizabet.mp4": "women_olympic_short_program_2018_23_00273750_00277925.mp4",
        "Olympic_Women_SP#24_CHOI_Dabin.mp4": "women_olympic_short_program_2018_24_00283725_00288000.mp4",
        "Olympic_Women_SP#25_MEDVEDEVA_Evgenia.mp4": "women_olympic_short_program_2018_25_00310800_00315000.mp4",
        "Olympic_Women_SP#26_MIYAHARA_Satoko.mp4": "women_olympic_short_program_2018_26_00320525_00324775.mp4",
        "Olympic_Women_SP#27_OSMOND_Kaetlyn.mp4": "women_olympic_short_program_2018_27_00330000_00334225.mp4",
        "Olympic_Women_SP#28_ZAGITOVA_Alina.mp4": "women_olympic_short_program_2018_28_00340000_00344225.mp4",
        "Olympic_Women_SP#29_KOSTNER_Carolina.mp4": "women_olympic_short_program_2018_29_00350225_00354475.mp4",
        "Olympic_Women_SP#30_KHNYCHENKOVA_Anna.mp4": "women_olympic_short_program_2018_30_00359750_00364075.mp4",
        "World_Women_SP#01_Dasa_GRM.mp4": "women_world_short_program_2018_01_00034700_00038925.mp4",
        "World_Women_SP#02_Hanul_KIM.mp4": "women_world_short_program_2018_02_00043725_00048000.mp4",
        "World_Women_SP#03_Xiangning_LI.mp4": "women_world_short_program_2018_03_00053300_00057600.mp4",
        "World_Women_SP#04_Natasha_MCKAY.mp4": "women_world_short_program_2018_04_00062325_00066525.mp4",
        "World_Women_SP#05_Elisabetta_LECCARDI.mp4": "women_world_short_program_2018_05_00071750_00076075.mp4",
        "World_Women_SP#06_Viveca_LINDFORS.mp4": "women_world_short_program_2018_06_00092725_00096925.mp4",
        "World_Women_SP#07_Angelina_KUCHVALSKA.mp4": "women_world_short_program_2018_07_00103175_00107375.mp4",
        "World_Women_SP#08_Alisa_STOMAKHINA.mp4": "women_world_short_program_2018_08_00112775_00117050.mp4",
        "World_Women_SP#09_Larkyn_AUSTMAN.mp4": "women_world_short_program_2018_09_00122050_00126300.mp4",
        "World_Women_SP#10_Isadora_WILLIAMS.mp4": "women_world_short_program_2018_10_00131825_00136050.mp4",
        "World_Women_SP#12_Anne_Line GJERSEM.mp4": "women_world_short_program_2018_12_00184450_00188650.mp4",
        "World_Women_SP#13_Antonina_DUBININA.mp4": "women_world_short_program_2018_13_00194200_00198525.mp4",
        "World_Women_SP#14_Amy_LIN.mp4": "women_world_short_program_2018_14_00203575_00207850.mp4",
        "World_Women_SP#15_Elzbieta_KROPA.mp4": "women_world_short_program_2018_15_00212650_00216875.mp4",
        "World_Women_SP#16_Kailani_CRAINE.mp4": "women_world_short_program_2018_16_00233550_00237825.mp4",
        "World_Women_SP#17_Eliska_BREZINOVA.mp4": "women_world_short_program_2018_17_00243625_00247825.mp4",
        "World_Women_SP#18_Alexia_PAGANINI.mp4": "women_world_short_program_2018_18_00253500_00257800.mp4",
        "World_Women_SP#19_Anita_ÖSTLUND.mp4": "women_world_short_program_2018_19_00263450_00267750.mp4",
        "World_Women_SP#20_Bradie_TENNELL.mp4": "women_world_short_program_2018_20_00273925_00278150.mp4",
        "World_Women_SP#21_Laurine_LECAVELIER.mp4": "women_world_short_program_2018_21_00320925_00325175.mp4",
        "World_Women_SP#22_Dabin_CHOI.mp4": "women_world_short_program_2018_22_00330900_00335150.mp4",
        "World_Women_SP#23_Loena_HENDRICKX.mp4": "women_world_short_program_2018_23_00340775_00345050.mp4",
        "World_Women_SP#24_Ivett_TOTH.mp4": "women_world_short_program_2018_24_00350250_00354500.mp4",
        "World_Women_SP#25_Stanislava_KONSTANTINOVA.mp4": "women_world_short_program_2018_25_00360050_00364325.mp4",
        "World_Women_SP#26_Gabrielle_DALEMAN.mp4": "women_world_short_program_2018_26_00381750_00386000.mp4",
        "World_Women_SP#27_Nicole_RAJICOVA.mp4": "women_world_short_program_2018_27_00391150_00395400.mp4",
        "World_Women_SP#29_Mirai_NAGASU.mp4": "women_world_short_program_2018_29_00410050_00414275.mp4",
        "World_Women_SP#30_Alina_ZAGITOVA.mp4": "women_world_short_program_2018_30_00419825_00424150.mp4",
        "World_Women_SP#31_Mariah_BELL.mp4": "women_world_short_program_2018_31_00429175_00433425.mp4",
        "World_Women_SP#32_Wakaba_HIGUCHI.mp4": "women_world_short_program_2018_32_00458150_00462450.mp4",
        "World_Women_SP#33_Carolina_KOSTNER.mp4": "women_world_short_program_2018_33_00467675_00471900.mp4",
        "World_Women_SP#34_Maria_SOTSKOVA.mp4": "women_world_short_program_2018_34_00477800_00482000.mp4",
        "World_Women_SP#35_Kaetlyn_OSMOND.mp4": "women_world_short_program_2018_35_00487625_00491975.mp4",
        "World_Women_SP#36_Satoko_MIYAHARA.mp4": "women_world_short_program_2018_36_00497000_00501275.mp4",
    }

    def __init__(self, video_dir: Path):
        self.video_dir = video_dir

    def find_renamed_files(self) -> List[Path]:
        """Find all renamed video files in the video directory"""
        video_files = list(self.video_dir.glob("*.mp4"))

        # Filter only renamed files (matching the new pattern)
        renamed_pattern = r'^(Olympic|World)_(Men|Women)_SP#\d+_.*\.mp4$'
        renamed_files = [f for f in video_files if re.match(renamed_pattern, f.name)]

        print(f"\nFound {len(renamed_files)} renamed files in {self.video_dir}")
        return renamed_files

    def restore_files(self, dry_run: bool = True) -> None:
        """
        Restore video files to their original names.

        Args:
            dry_run: If True, only show what would be restored without making changes
        """
        renamed_files = self.find_renamed_files()

        if not renamed_files:
            print("  No renamed files found!")
            return

        restore_plan: List[Tuple[Path, Path]] = []
        skipped: List[Tuple[Path, str]] = []

        # Build restore plan
        for filepath in renamed_files:
            original_name = self.RENAME_MAP.get(filepath.name)

            if not original_name:
                skipped.append((filepath, "No mapping found for this filename"))
                continue

            original_path = filepath.parent / original_name

            if original_path.exists() and original_path != filepath:
                skipped.append((filepath, f"Original filename already exists: {original_name}"))
                continue

            restore_plan.append((filepath, original_path))

        # Display results
        print("\n" + "=" * 80)
        if dry_run:
            print("DRY RUN - No files will be restored")
        else:
            print("RESTORING ORIGINAL FILENAMES")
        print("=" * 80)

        if restore_plan:
            print(f"\nFiles to restore ({len(restore_plan)}):")
            print("-" * 80)
            for current_path, original_path in restore_plan:
                print(f"  {current_path.name}")
                print(f"  → {original_path.name}")
                print()

        if skipped:
            print(f"\nSkipped files ({len(skipped)}):")
            print("-" * 80)
            for filepath, reason in skipped:
                print(f"  {filepath.name}")
                print(f"  Reason: {reason}")
                print()

        # Execute restores if not dry run
        if not dry_run and restore_plan:
            print("\nExecuting restore...")
            success_count = 0
            error_count = 0

            for current_path, original_path in restore_plan:
                try:
                    current_path.rename(original_path)
                    print(f"  ✓ Restored: {current_path.name} → {original_path.name}")
                    success_count += 1
                except Exception as e:
                    print(f"  ✗ Failed: {current_path.name} - {e}")
                    error_count += 1

            print("\n" + "=" * 80)
            print(f"Restore complete: {success_count} succeeded, {error_count} failed")
            print("=" * 80)
        elif dry_run and restore_plan:
            print("\n" + "=" * 80)
            print("To execute these restores, run without --dry-run:")
            print("  python scripts/restore_original_names.py --execute")
            print("=" * 80)


def main():
    parser = argparse.ArgumentParser(
        description="Restore video files to their original names"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        default=True,
        help='Show what would be restored without making changes (default: True)'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Actually restore files (overrides --dry-run)'
    )
    parser.add_argument(
        '--video-dir',
        type=Path,
        default=None,
        help='Path to video directory (default: backend/videos/optimized/)'
    )

    args = parser.parse_args()

    # Determine paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    video_dir = args.video_dir or project_root / 'backend' / 'videos' / 'optimized'

    # Validate paths
    if not video_dir.exists():
        print(f"Error: Video directory not found: {video_dir}")
        sys.exit(1)

    # Determine dry run mode
    dry_run = not args.execute

    print("=" * 80)
    print("Video File Name Restoration Tool")
    print("=" * 80)
    print(f"Video directory: {video_dir}")
    print(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE'}")
    print("=" * 80)

    # Execute restoration
    restorer = NameRestorer(video_dir)

    try:
        restorer.restore_files(dry_run=dry_run)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    print("\n✓ Complete!")


if __name__ == '__main__':
    main()
