# Release guide

## Versioning

Power BI visual versions use four numeric parts, for example `1.1.0.0`. Keep these values synchronized:

- `package.json` → `version`
- `pbiviz.json` → `visual.version`
- `pbiviz.json` → root `version`

## Release checklist

1. Update `CHANGELOG.md`.
2. Run `npm ci`, `npm test`, `npm run lint`, and `npm run package`.
3. Import the generated `.pbiviz` into Power BI Desktop and test all field roles.
4. Commit and push the version change.
5. Create a GitHub release and attach the package:

```bash
gh release create v1.1.0.0 \
  dist/IBCSChartsE4C67B88137F4C35A06FE091C117D316.1.1.0.0.pbiviz \
  --title "IBCS Charts 1.1.0.0" \
  --notes-file CHANGELOG.md
```

The `.pbiviz` belongs in the GitHub release, not in the Git repository.

