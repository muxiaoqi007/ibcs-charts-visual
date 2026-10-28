# Changelog

## 1.5.3.0 — 2026-10-28

- Displayed rendering errors inside the visual instead of leaving an empty canvas.

## 1.5.2.0 — 2026-09-04

- Unified Actual, Comparison, and absolute-variance tooltip values under the visual's display-unit and decimal settings.
- Kept relative variance on the same decimal setting and retained model formatting for additional tooltip measures.

## 1.5.1.0 — 2026-09-04

- Limited the terminal relative-variance arrow to an explicitly enabled grand-total category.
- Prevented Top N “其他” and ordinary final categories from being styled as totals.
- Preserved per-category integrated variance blocks when Responsive mode switches to its compact layout.

## 1.5.0.0 — 2026-08-12

- Added Top N, Bottom N, and Top/Bottom N filtering with optional “其他” aggregation.
- Added an independent variance-column width control and reduced its default width to 30% of category spacing.
- Localized every data role, formatting card, setting, and enumeration option into Chinese.
- Kept grand totals based on the complete dataset when Top N filtering is active.

## 1.4.0.0 — 2026-08-12

- Added Power BI cross-highlight rendering with subdued full-value backgrounds and highlighted foreground values.
- Added Power BI high-contrast palette support and theme-aware text, background, axes, labels, and focus colors.
- Added host-locale number formatting and model format strings for Actual, Comparison, and absolute variance labels.
- Added Power BI context menus on category marks.

## 1.3.1.0 — 2026-08-12

- Stopped rendering favorable variance marks for exact zero variances in every layout.
- Removed the comparison scenario label from Actual-only charts.
- Added Chinese Previous Year, Plan, and Forecast scenario-name recognition.
- Removed the unsupported Power BI cross-highlight capability declaration until highlight rendering is implemented.

## 1.3.0.0 — 2026-08-11

- Added automatic and configurable AC/PY/PL/FC scenario abbreviations.
- Added formatting controls for overlapping and integrated column widths.
- Added measured SVG label collision handling with semantic label priorities.
- Added regression coverage for responsive column and tiny-variance geometry.

## 1.2.0.0 — 2026-08-11

- Made Responsive layout react to width, height, and category density.
- Added automatic compact integrated-variance mode and progressive label, axis, and margin fitting.
- Refined Actual/PY overlap and added compact colored variance blocks with a final relative-variance arrow.

## 1.1.0.0 — 2026-08-09

- Replaced repeated tooltip-role projections with one dedicated Tooltips field well.
- Added multiple additional tooltip measures with model-aware formatting.
- Added Auto, None, K, M, B, and T data-label display units.
- Replaced the scaffold icon with an IBCS-style variance and comparison icon.

## 1.0.0.0 — 2026-08-09

- Initial IBCS actual, absolute-variance, and relative-variance visual.
