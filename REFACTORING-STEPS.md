# TAS-AnnoTools Refactoring Steps

This document explains how to complete the refactoring from random URL to fixed URL setup.

---

## 📋 Overview

We are removing random URL (temporary tunnel) support and keeping only the Named Tunnel (fixed URL) implementation.

---

## ✅ Completed Steps

1. ✅ Created new simplified scripts
2. ✅ Created new batch files
3. ✅ Fixed Vite configuration for `app.tas-annotools.com`
4. ✅ Tested and verified fixed URL access

---

## 🔄 Manual Steps Required

Due to environment limitations, please complete the following steps manually:

### Step 1: Backup Current Services (if running)

```cmd
stop-all.bat
```

### Step 2: Delete Old Files

**Delete these files (random URL related):**

```
scripts/start-tunnel.ps1
scripts/stop-tunnel.ps1
scripts/start-all.ps1
scripts/start-named-tunnel.ps1
scripts/start-all-named.ps1
start-tunnel.bat
start-all.bat
start-named-tunnel.bat
start-all-named.bat
```

**How to delete (PowerShell):**

```powershell
# Navigate to project root
cd C:\Users\ryota\TAS-AnnoTools

# Delete old scripts
Remove-Item scripts/start-tunnel.ps1
Remove-Item scripts/stop-tunnel.ps1
Remove-Item scripts/start-all.ps1
Remove-Item scripts/start-named-tunnel.ps1
Remove-Item scripts/start-all-named.ps1

# Delete old batch files
Remove-Item start-tunnel.bat
Remove-Item start-all.bat
Remove-Item start-named-tunnel.bat
Remove-Item start-all-named.bat
```

### Step 3: Rename New Files

**Rename new files to main filenames:**

```powershell
# Rename scripts
Rename-Item scripts/start-tunnel-new.ps1 -NewName start-tunnel.ps1
Rename-Item scripts/start-all-new.ps1 -NewName start-all.ps1

# Rename batch files
Rename-Item start-tunnel-new.bat -NewName start-tunnel.bat
Rename-Item start-all-new.bat -NewName start-all.bat
```

### Step 4: Delete Unnecessary Documentation

**Delete these docs (random URL specific):**

```powershell
Remove-Item QUICKSTART-DEPLOYMENT.md
Remove-Item docs/NAMED-TUNNEL-SETUP.md
```

**Keep these docs:**
- ✅ README.md (will be updated)
- ✅ docs/DEPLOYMENT.md (main deployment guide)
- ✅ CLAUDE.md (project overview)

### Step 5: Test New Setup

```cmd
# Start all services
start-all.bat

# Verify access
# Browser: https://app.tas-annotools.com
```

### Step 6: Update README

The README.md will be updated to reflect the simplified setup (next step).

---

## 📁 Final File Structure

After refactoring:

```
TAS-AnnoTools/
├── scripts/
│   ├── start-all.ps1          ✅ (renamed from start-all-new.ps1)
│   ├── start-tunnel.ps1       ✅ (renamed from start-tunnel-new.ps1)
│   ├── stop-all.ps1           ✅ (kept as-is)
│   └── install-auto-start.ps1 ✅ (kept as-is)
├── docs/
│   ├── DEPLOYMENT.md          ✅ (main deployment guide)
│   └── ...other docs...
├── start-all.bat              ✅ (renamed from start-all-new.bat)
├── start-tunnel.bat           ✅ (renamed from start-tunnel-new.bat)
├── stop-all.bat               ✅ (kept as-is)
├── README.md                  ✅ (to be updated)
└── CLAUDE.md                  ✅ (kept as-is)
```

---

## 🎯 Benefits After Refactoring

1. **Simplified structure** - Only one way to deploy (fixed URL)
2. **Less confusion** - No choice between random URL vs fixed URL
3. **Cleaner codebase** - Removed duplicate/unused files
4. **Better maintainability** - Single source of truth

---

## ⚠️ Important Notes

- The fixed URL `https://app.tas-annotools.com` is now the only way to access externally
- All scripts and documentation now assume fixed URL deployment
- Random URL functionality has been completely removed

---

## 📞 If You Need Help

If any step fails or you encounter issues:

1. Check that all services are stopped (`stop-all.bat`)
2. Ensure no files are in use (close all PowerShell windows)
3. Use File Explorer to manually delete/rename if PowerShell commands fail

---

Ready to proceed? Run the PowerShell commands in Step 2-3 above.
