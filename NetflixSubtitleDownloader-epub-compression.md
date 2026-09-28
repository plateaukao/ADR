2026-09-28

# Compress EPUB contents with DEFLATE level 6

Generated EPUB chapters were stored without compression, making subtitle books unnecessarily large. The shared EPUB generator now sets DEFLATE level 6 on every regular entry except mimetype, which keeps its explicit STORE setting. Both Netflix and Disney+ export callers inherit this behavior without changes to their download flows.

Recompressing the supplied book with the bundled JSZip reduced its size from 604,520 to 201,006 bytes, a 66.7 percent reduction, with identical extracted contents. A Node regression test verifies content preservation, CRC integrity, DEFLATE entries, and the first uncompressed mimetype entry. The test passes.

Project commit: 4ab2cf1.
