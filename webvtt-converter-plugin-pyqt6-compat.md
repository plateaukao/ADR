# WebVTT Converter Plugin - Calibre 8.x PyQt6 Compatibility

## Problem
Plugin crashed with `AttributeError: type object 'QFileDialog' has no attribute 'ShowDirsOnly'` when selecting a subtitle directory in Calibre 8.x.

## Root Cause
Calibre 8.x migrated from PyQt5 to PyQt6, which uses `qt.core` as the import path instead of `PyQt5.Qt`. In PyQt6, enum values like `ShowDirsOnly` moved from `QFileDialog.ShowDirsOnly` to `QFileDialog.Option.ShowDirsOnly`.

## Solution
- **Imports**: Added `try/except` to import from `qt.core` first (Calibre 8.x), falling back to `PyQt5` (older Calibre).
- **Enum access**: Used `getattr(QFileDialog, 'ShowDirsOnly', None) or QFileDialog.Option.ShowDirsOnly` to support both PyQt5 and PyQt6 enum styles.

## Key Files
- `main.py` — UI dialog with Qt imports and file dialog usage

## Lessons Learned
- Calibre plugin development requires checking which Qt binding version is in use; `qt.core` is the forward-compatible import path for Calibre 6+.
- `getattr` with fallback is a clean pattern for handling enum location changes across PyQt versions.
