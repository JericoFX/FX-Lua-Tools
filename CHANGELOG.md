# Changelog

## [Unreleased]
### Added
- Debounced Lua document scanning to avoid redundant re-analysis while typing.
- Shared diagnostic context helpers to reuse parsed document text across all checks.
- Additional sanitisation that ignores strings and comments when scanning for waits or globals.

### Changed
- Clarified warning copy for loop diagnostics and improved block parsing robustness.
- Workspace scans now report errors opening files without interrupting the rest of the scan.

### Fixed
- Diagnostics are cleared when Lua files close to prevent stale warnings.
