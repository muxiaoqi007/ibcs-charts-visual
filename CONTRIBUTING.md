# Contributing

## Prerequisites

- Node.js 22 LTS
- npm
- Power BI Desktop or Power BI Service developer mode for host testing

## Local workflow

```bash
git clone https://github.com/muxiaoqi007/ibcs-charts-visual.git
cd ibcs-charts-visual
npm ci
npm test
npm run lint
npm run package
```

Use `npm start` for the Power BI developer visual server. Keep data conversion and variance semantics in pure functions where possible, and add tests under `test/` for every semantic change.

## Pull requests

1. Keep each pull request focused on one behavior.
2. Update `CHANGELOG.md` for user-visible changes.
3. Run tests, lint, and packaging locally.
4. Include Power BI Desktop screenshots when changing rendered layout.
5. Do not commit `dist/`, `.tmp/`, `node_modules/`, report data, or private `.pbix` files.

