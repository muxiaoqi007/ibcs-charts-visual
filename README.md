# IBCS Charts for Power BI

![IBCS Charts icon](docs/icon-preview.png)

An independent Power BI custom visual that reproduces the core information-design pattern shown in the reference screenshots: neutral actual/comparison columns, absolute variance bars, relative variance lollipops, direct labels, and aligned responsive panels.

This project is not affiliated with or endorsed by Zebra BI. “Zebra BI” is referenced only to describe the visual behavior being reproduced. IBCS is a broader reporting notation standard; this MVP implements a useful subset rather than claiming full IBCS compliance.

## Import the packaged visual

Download the latest `.pbiviz` from [GitHub Releases](https://github.com/muxiaoqi007/ibcs-charts-visual/releases/latest), then:

1. Open Power BI Desktop.
2. For development builds, enable **File → Options and settings → Options → Current file → Report settings → Develop a visual**.
3. In the Visualizations pane, choose **… → Import a visual from a file**.
4. Select the downloaded `.pbiviz` file.
5. Add one `Category`, one `Actual`, optionally one `Previous year / Plan` measure, and any additional hover measures under `Tooltips`.

## Supported layouts

- Responsive
- Integrated variance
- Absolute variance
- Relative variance
- Absolute / Relative
- Actual / Absolute
- Actual / Relative
- Actual

Responsive mode considers the visual's width, height, and category density. Spacious visuals show Actual, absolute variance, and relative variance as aligned panels; medium visuals keep Actual and absolute variance; compact or dense visuals fold variance indicators into the Actual panel. Titles, axes, value labels, and category labels are progressively fitted or reduced to avoid clipping. If no comparison measure is supplied, the visual automatically falls back to Actual.

## Semantics

- Absolute variance: `Actual - Comparison`
- Relative variance: `(Actual - Comparison) / ABS(Comparison)`
- A zero comparison produces no relative percentage, avoiding an infinite result.
- Favorable variance is green and unfavorable variance is red by default.
- Enable **Invert variance colors** for measures where lower is better, such as cost or defect rate.
- Enable **Treat nulls as zeros** only when a missing observation truly means zero.
- **Grand total** sums Actual and Comparison separately, then recomputes both variances from those totals.
- Data-label units can be Auto, None, Thousands (K), Millions (M), Billions (B), or Trillions (T). Relative variance remains a percentage.
- Additional measures placed in `Tooltips` appear in the hover card and preserve their model format strings.

## Development

```bash
npm install --cache /path/to/a/writable/npm-cache
npm test
npm run lint
npm run package
```

The project uses the official `powerbi-visuals-tools` CLI and Power BI Visuals API 5.11.1.

See [development](docs/development.md), [field mapping](docs/field-mapping.md), [release instructions](docs/releasing.md), and [contribution guidelines](CONTRIBUTING.md).

## MVP limitations

- One categorical field, two chart measures, and optional additional tooltip measures.
- No drill hierarchy, small multiples, forecast scenarios, or per-category favorable-direction metadata yet.
- Number labels currently use the browser/Power BI locale and the visual's decimal-place setting; model dynamic format strings are not yet applied.
- Rendering must still be visually checked in Power BI Desktop because the local build environment cannot emulate the full Power BI host.
