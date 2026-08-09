# Development guide

## Architecture

- `src/model.ts` contains pure variance, total, responsive-layout, and display-unit logic.
- `src/visual.ts` converts Power BI categorical data into the renderer contract and manages formatting and selection.
- `src/renderer.ts` draws responsive SVG panels and exposes tooltip and selection interaction.
- `src/settings.ts` defines the API 5.1+ formatting pane model.
- `capabilities.json` defines data roles, tooltip behavior, mappings, and persistent formatting properties.

## Commands

| Command | Purpose |
|---|---|
| `npm start` | Run the local Power BI developer visual server |
| `npm test` | Run semantic unit tests |
| `npm run lint` | Run the Power BI ESLint rules |
| `npm run package` | Create an importable package under `dist/` |

## Data contract

The visual accepts one category, one actual measure, one optional comparison measure, and multiple optional tooltip measures. See [field-mapping.md](field-mapping.md) for formulas and panel behavior.

## Definition of done

1. Unit tests pass.
2. ESLint passes.
3. `pbiviz package` succeeds.
4. The package imports into Power BI Desktop.
5. Every layout is checked at narrow, medium, and tall visual sizes.
6. Tooltip, multi-selection, keyboard focus, and high-value display units are checked with real model fields.

