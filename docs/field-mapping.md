# Field mapping and rendering contract

| Role | Required | Kind | Meaning |
|---|---:|---|---|
| Category | Yes | Grouping | Ordered P&L line, account, product, region, or other comparison entity |
| Actual | Yes | Measure | Current-period actual value |
| Previous year / Plan | No | Measure | Baseline used to calculate absolute and relative variance |
| Tooltips | No | Measure(s) | Additional values shown only on hover; multiple fields are supported |

## Layout behavior

| Layout | Panels from top to bottom |
|---|---|
| Responsive | Width-, height-, and category-density-dependent; spacious charts show all three panels and compact charts integrate variance into Actual |
| Integrated variance | Actual columns with narrower, right-aligned semantic variance blocks and a final relative-variance arrow |
| Absolute variance | Signed semantic variance bars |
| Relative variance | Thin semantic stems with black terminal dots |
| Absolute / Relative | Relative, absolute |
| Actual / Absolute | Absolute, actual |
| Actual / Relative | Relative, actual |
| Actual | Overlapped comparison and actual columns |

All composite layouts share category positions. The category axis is shown only once at the bottom, which keeps the three analyses visually aligned.

## Formatting pane

- **Chart settings:** layout, favorable direction, null handling, grand total, optional vertical axis.
- **Top N + Others:** Top N, Bottom N, or Top/Bottom N filtering; ranking by Actual or absolute variance; optional “其他” aggregation.
- **Scenario labels:** Actual abbreviation and automatic or custom comparison abbreviation.
- **Column design:** widths for overlapping Actual/Comparison, integrated Actual/variance columns, and independent ΔPY columns.
- **Colors:** actual, comparison, favorable, unfavorable, and baseline colors.
- **Data labels:** visibility, Auto/None/K/M/B/T display units, value/category text size, and decimals.
- **Title:** visibility, text, and size.

Tooltip measures preserve their model format string. Actual and comparison values, absolute variance, relative variance, and fields added to the Tooltips role appear together in the hover card.

All data-role and formatting-pane labels exposed in Power BI are Chinese. When Top N filtering and grand total are both enabled, “其他” is calculated from excluded rows and “总计” is calculated from the complete dataset.

Cross-highlight values are rendered as foreground marks over subdued full-value marks. Right-clicking a selectable category opens the native Power BI context menu. High-contrast colors and the host locale are read from the Power BI visual host.

## Recommended input shape

Use a dedicated numeric sort column for P&L or operational sequences and set the Category field to **Sort by column** in the model. The visual respects the order received from Power BI; it does not reorder categories internally.
