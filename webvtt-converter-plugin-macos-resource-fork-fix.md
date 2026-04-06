# WebVTT Converter Plugin - macOS Resource Fork Fix

## Problem
Calibre's WebVTT Converter plugin crashed with `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xa3 in position 45` when processing VTT files on macOS.

## Root Cause
macOS creates `._` (Apple Double) binary metadata files alongside real files (e.g., `._不可能的婚禮.S01E01.WEBRip.Netflix.ko.vtt`). The plugin's `*.vtt` regex matched these binary files, then attempted to parse them as UTF-8 text VTT files. The binary content contained byte `0xa3` at position 45 which is invalid UTF-8.

## Solution
- **convert.py**: Added `not f.startswith('._')` filter to all three file-listing functions (`get_film_name`, `get_lang_list`, `convert_webvtt_to_html`) to skip macOS resource fork files.
- **webvtt/parsers.py**: Improved `_read_file_encoding` to auto-detect non-UTF-8 encodings (EUC-KR, CP949, Big5, GB18030, Shift-JIS, Latin-1) with graceful fallback. Added `errors='replace'` to file open as a safety net.

## Key Files
- `convert.py` — file listing and conversion logic
- `webvtt/parsers.py` — file reading and encoding detection

## Lessons Learned
- macOS `._` files are invisible in Finder but visible to `os.listdir()` — always filter them in file-processing code.
- The bug was hard to reproduce outside Calibre because `._` files only appeared in Calibre's temp directory during zip extraction, not in the original directory.
- Debug logging to a temp file was essential to diagnose the issue, but `tempfile.gettempdir()` returns different paths in Calibre's bundled Python vs system Python.
