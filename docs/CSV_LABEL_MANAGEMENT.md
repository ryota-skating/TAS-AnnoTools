# CSV-Based Label Management

This document describes how to manage annotation labels using CSV files in TAS-AnnoTools.

## Overview

Annotation labels (figure skating elements) can be easily modified by editing a CSV file and running a Python script. This approach allows you to:

- Change element colors
- Add new elements
- Modify element names
- Reorganize categories

The system uses `mapping/labels.csv` as the source of truth, which is converted to mapping files and database entries.

## CSV Format

### File Location
`mapping/labels.csv`

### Column Structure

```csv
id,set_label,element_label,color
0,Three_Turn,RFI_Three_Turn,#3b82f6
1,Three_Turn,RFO_Three_Turn,#3b82f6
...
```

### Columns

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| `id` | Yes | Element ID (sequential, starting from 0) | `0`, `1`, `2` |
| `set_label` | Yes | Category/set name | `Three_Turn` |
| `element_label` | Yes | Specific element name | `RFI_Three_Turn` |
| `color` | Optional | Hex color code | `#3b82f6` |

### Validation Rules

1. **IDs must be sequential**: 0, 1, 2, ... N (no gaps allowed)
2. **No duplicate IDs**: Each ID must be unique
3. **No duplicate element_label**: Each element name must be unique
4. **Color format**: If provided, must be `#RRGGBB` (6-digit hex)
5. **Required fields**: `id`, `set_label`, `element_label` cannot be empty

### Default Colors

If `color` is empty or not provided, the script automatically assigns a default color based on `set_label`:

| Set Label | Default Color | Description |
|-----------|---------------|-------------|
| Three_Turn | #3b82f6 | Blue |
| Bracket_Turn | #8b5cf6 | Purple |
| Rocker_Turn | #06b6d4 | Cyan |
| Counter_Turn | #10b981 | Emerald |
| Loop_Turn | #f59e0b | Amber |
| Twizzle | #ef4444 | Red |
| Toe_Step | #ec4899 | Pink |
| (others) | See `CATEGORY_COLORS` in script | |

## Usage

### Basic Workflow

```bash
# 1. Stop backend server
# (Ctrl+C in terminal running npm run dev)

# 2. Edit CSV file
# Open mapping/labels.csv in your editor

# 3. Validate changes (dry-run)
uv run scripts/csv_to_mapping.py mapping/labels.csv --dry-run

# 4. Apply changes
uv run scripts/csv_to_mapping.py mapping/labels.csv

# 5. Restart backend
cd backend
npm run dev

# 6. Verify in web UI
# Open browser and check annotation colors/labels
```

### Command Options

```bash
# Basic usage - updates both files and database
uv run scripts/csv_to_mapping.py mapping/labels.csv

# Dry-run - validate without making changes
uv run scripts/csv_to_mapping.py mapping/labels.csv --dry-run

# Skip database update - only generate mapping files
uv run scripts/csv_to_mapping.py mapping/labels.csv --no-db

# Custom database path
uv run scripts/csv_to_mapping.py mapping/labels.csv --db-path backend/data/custom.db

# Custom project name (default: 'default')
uv run scripts/csv_to_mapping.py mapping/labels.csv --project my-project

# Verbose output
uv run scripts/csv_to_mapping.py mapping/labels.csv --verbose
```

## Common Workflows

### 1. Change Element Colors

**Example**: Change all Three_Turn elements from blue to red

```csv
id,set_label,element_label,color
0,Three_Turn,RFI_Three_Turn,#ff0000
1,Three_Turn,RFO_Three_Turn,#ff0000
...
```

**Steps**:
1. Edit `mapping/labels.csv` with new colors
2. Run: `uv run scripts/csv_to_mapping.py mapping/labels.csv --dry-run`
3. Verify preview output
4. Run: `uv run scripts/csv_to_mapping.py mapping/labels.csv`
5. Restart backend server

### 2. Add New Element

**Example**: Add a new element "Single_Axel" with ID 56

```csv
...
55,NONE,NONE,#6b7280
56,Jump,Single_Axel,#ff00ff
```

**Important**: Always append new elements at the end to maintain existing IDs.

**Steps**:
1. Add new row to end of CSV
2. Ensure ID is sequential (56 in this case)
3. Run dry-run to validate
4. Apply changes
5. Restart backend

### 3. Change Element Name

**Example**: Rename "Twizzle" to "Twizzle_Element"

```csv
40,Twizzle,Twizzle_Element,#ef4444
```

**Note**: This only changes the display name. The ID remains 40.

**Steps**:
1. Edit `element_label` in CSV
2. Keep `id` and `set_label` unchanged
3. Run dry-run
4. Apply changes
5. Restart backend

### 4. Create New Category

**Example**: Add a "Jump" category

```csv
...
55,NONE,NONE,#6b7280
56,Jump,Single_Axel,#ff00ff
57,Jump,Double_Axel,#ff00ff
```

The script automatically extracts unique `set_label` values and creates category mappings.

## Critical Warnings

### ⚠️ NEVER Change Existing Element IDs

Existing annotations reference elements by ID only:

```json
{"startFrame": 100, "endFrame": 200, "elementId": 5}
```

If you change ID 5 from "LFO_Three_Turn" to "Twizzle", all existing annotations will be misinterpreted.

### Safe Operations

✅ **Safe** - These do NOT break existing annotations:
- Change `color` (visual only)
- Change `element_label` text (display name only)
- Change `set_label` (category grouping only)
- Append new elements at the end (new IDs)

### Unsafe Operations

❌ **DANGEROUS** - These WILL break existing annotations:
- Reorder rows (changes IDs)
- Delete rows (shifts subsequent IDs)
- Insert rows in middle (shifts subsequent IDs)
- Change ID numbers

### Solution for Reorganization

If you must reorganize elements:

1. Export all existing annotations
2. Create ID mapping (old ID → new ID)
3. Update CSV with new structure
4. Run migration script to update all annotations
5. Re-import updated annotations

(Note: Migration script not yet implemented)

## Backup and Recovery

### Automatic Backups

The script automatically creates timestamped backups before making changes:

```
mapping/mapping_step_element.txt.backup_20250130_143022
mapping/mapping_step_set.txt.backup_20250130_153045
```

Backups are retained indefinitely and must be manually deleted.

### Manual Recovery

If changes cause problems:

1. **Restore from backup**:
   ```bash
   cp mapping/mapping_step_element.txt.backup_TIMESTAMP mapping/mapping_step_element.txt
   cp mapping/mapping_step_set.txt.backup_TIMESTAMP mapping/mapping_step_set.txt
   ```

2. **Restart backend server** to load restored files

3. **Revert CSV file** using version control:
   ```bash
   git checkout mapping/labels.csv
   ```

### Complete Rollback

If the script encounters an error during execution, it automatically:
1. Restores mapping files from backups
2. Rolls back database transaction
3. Reports the error

No partial changes are left in the system.

## Output Files

The script generates/updates three locations:

1. **mapping/mapping_step_element.txt**
   ```
   0 RFI_Three_Turn
   1 RFO_Three_Turn
   ...
   ```

2. **mapping/mapping_step_set.txt**
   ```
   0 Three_Turn
   1 Bracket_Turn
   ...
   ```

3. **Database**: `backend/data/annotations.db`
   - Table: `label_sets`
   - Creates new version with JSON data

## Troubleshooting

### Error: "Invalid ID sequence"

**Problem**: IDs are not sequential (e.g., 0, 1, 3 instead of 0, 1, 2)

**Solution**: Ensure IDs start at 0 and increment by 1 with no gaps

---

### Error: "Duplicate ID"

**Problem**: Same ID appears multiple times

**Solution**: Each row must have a unique ID

---

### Error: "Duplicate element_label"

**Problem**: Same element name appears multiple times

**Solution**: Each element must have a unique name

---

### Error: "Invalid color format"

**Problem**: Color doesn't match `#RRGGBB` format

**Solution**: Use 6-digit hex colors (e.g., `#3b82f6`, not `#36f` or `rgb(59,130,246)`)

---

### Error: "Database file not found"

**Problem**: Cannot find `backend/data/annotations.db`

**Solution**:
1. Check database path is correct
2. Use `--db-path` option to specify custom location
3. Or use `--no-db` to skip database update

---

### Problem: Changes not visible in web UI

**Solution**:
1. Ensure backend server was restarted after running script
2. Clear browser cache (Ctrl+F5)
3. Check browser console for errors
4. Verify API returns updated labels: `GET /api/labels/default`

---

### Problem: Script succeeds but backend shows old labels

**Solution**:
1. Backend caches mapping files on startup
2. You MUST restart the backend server
3. Kill existing backend process completely before restarting

## Advanced Usage

### Custom Project Name

For multi-project setups:

```bash
uv run scripts/csv_to_mapping.py mapping/labels_project2.csv --project project2
```

### Validate Only (No Changes)

```bash
uv run scripts/csv_to_mapping.py mapping/labels.csv --dry-run
```

This shows:
- Validation results
- Preview of generated files
- Database update preview
- No actual changes made

### Skip Database Update

Useful for testing mapping files without affecting database:

```bash
uv run scripts/csv_to_mapping.py mapping/labels.csv --no-db
```

Updates mapping files only, database unchanged.

## Integration with Version Control

### Recommended Git Workflow

```bash
# 1. Create feature branch
git checkout -b update-labels

# 2. Edit CSV
vim mapping/labels.csv

# 3. Run script
uv run scripts/csv_to_mapping.py mapping/labels.csv

# 4. Review changes
git diff mapping/

# 5. Commit changes
git add mapping/labels.csv
git add mapping/mapping_step_element.txt
git add mapping/mapping_step_set.txt
git commit -m "Update label colors for Three_Turn elements"

# 6. Push and create PR
git push origin update-labels
```

### What to Commit

✅ **Commit these**:
- `mapping/labels.csv` (source of truth)
- `mapping/mapping_step_element.txt` (generated)
- `mapping/mapping_step_set.txt` (generated)

❌ **Do NOT commit**:
- `mapping/*.backup_*` (backup files)
- Database files (too large, binary)

## FAQ

**Q: Can I edit mapping_step_element.txt directly instead of CSV?**

A: Not recommended. The CSV is the source of truth. Direct edits to mapping files will be overwritten next time the script runs.

---

**Q: How do I export existing labels to CSV?**

A: Currently manual. Copy data from existing mapping files or database. A future enhancement will add `--export` option.

---

**Q: Can I use a different CSV file name?**

A: Yes, just pass the path: `uv run scripts/csv_to_mapping.py my_custom_labels.csv`

---

**Q: What happens if I run the script twice with same CSV?**

A: Safe to run multiple times. It creates a new database version each time (version numbers increment).

---

**Q: Can I delete old database versions?**

A: Yes, but manual SQL required. Versions allow rollback to previous label configurations.

---

**Q: Does this affect existing annotations?**

A: Only if you change element IDs. Changing colors/names is safe.

## See Also

- [Main README](../README.md)
- [CLAUDE.md](../CLAUDE.md) - Project overview
- [Implementation Plan](../IMPLEMENTATION_PLAN.md) - Technical details
