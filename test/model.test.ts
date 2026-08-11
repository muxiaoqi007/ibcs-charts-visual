import { describe, expect, it } from "vitest";
import {
    appendGrandTotal,
    buildVariancePoint,
    canShowIntegratedVarianceLabel,
    isFavorable,
    resolveColumnWidths,
    resolveDisplayUnit,
    resolveIntegratedVarianceGeometry,
    resolveLayout,
    resolveScenarioLabel
} from "../src/model";

describe("buildVariancePoint", () => {
    it("computes signed absolute and relative variance", () => {
        const point = buildVariancePoint({ category: "Revenue", actual: 120, comparison: 100 }, false);
        expect(point?.absoluteVariance).toBe(20);
        expect(point?.relativeVariance).toBe(0.2);
    });

    it("uses the magnitude of a negative comparison as the relative denominator", () => {
        const point = buildVariancePoint({ category: "Cost", actual: -80, comparison: -100 }, false);
        expect(point?.absoluteVariance).toBe(20);
        expect(point?.relativeVariance).toBe(0.2);
    });

    it("returns no relative variance when comparison is zero", () => {
        const point = buildVariancePoint({ category: "New", actual: 10, comparison: 0 }, false);
        expect(point?.absoluteVariance).toBe(10);
        expect(point?.relativeVariance).toBeNull();
    });

    it("drops rows where both measures are null", () => {
        expect(buildVariancePoint({ category: "Blank", actual: null, comparison: null }, false)).toBeNull();
    });

    it("turns nulls into zeros when enabled", () => {
        const point = buildVariancePoint({ category: "Blank", actual: null, comparison: 25 }, true);
        expect(point?.actual).toBe(0);
        expect(point?.absoluteVariance).toBe(-25);
    });
});

describe("variance semantics", () => {
    it("inverts favorable direction", () => {
        expect(isFavorable(5, false)).toBe(true);
        expect(isFavorable(-5, false)).toBe(false);
        expect(isFavorable(5, true)).toBe(false);
        expect(isFavorable(-5, true)).toBe(true);
    });

    it("selects responsive layouts by width, height, and category density", () => {
        expect(resolveLayout("responsive", 720, 520, true, 12)).toBe("actualAbsoluteRelative");
        expect(resolveLayout("responsive", 520, 350, true, 12)).toBe("actualAbsolute");
        expect(resolveLayout("responsive", 520, 240, true, 12)).toBe("integratedVariance");
        expect(resolveLayout("responsive", 240, 520, true, 12)).toBe("integratedVariance");
        expect(resolveLayout("responsive", 520, 520, true, 40)).toBe("integratedVariance");
        expect(resolveLayout("responsive", 720, 520, false, 12)).toBe("actual");
    });

    it("does not change an explicitly selected layout", () => {
        expect(resolveLayout("relative", 180, 120, true, 40)).toBe("relative");
    });
});

describe("grand total", () => {
    it("appends a recomputed total", () => {
        const points = [
            buildVariancePoint({ category: "A", actual: 20, comparison: 10 }, false),
            buildVariancePoint({ category: "B", actual: 30, comparison: 40 }, false)
        ].filter(point => point !== null);
        const result = appendGrandTotal(points);
        expect(result.at(-1)).toMatchObject({ category: "Total", actual: 50, comparison: 50, absoluteVariance: 0 });
    });
});

describe("display units", () => {
    it("resolves explicit units", () => {
        expect(resolveDisplayUnit("millions", [1])).toEqual({ divisor: 1_000_000, suffix: "M" });
        expect(resolveDisplayUnit("none", [9_000_000])).toEqual({ divisor: 1, suffix: "" });
    });

    it("selects automatic units from the largest absolute value", () => {
        expect(resolveDisplayUnit("auto", [-2_500_000, 100])).toEqual({ divisor: 1_000_000, suffix: "M" });
        expect(resolveDisplayUnit("auto", [999, null])).toEqual({ divisor: 1, suffix: "" });
    });
});

describe("scenario labels", () => {
    it("detects common comparison scenarios", () => {
        expect(resolveScenarioLabel("Previous year", "")).toBe("PY");
        expect(resolveScenarioLabel("Operating Plan", "")).toBe("PL");
        expect(resolveScenarioLabel("Rolling Forecast", "")).toBe("FC");
    });

    it("prefers the configured label and derives a fallback abbreviation", () => {
        expect(resolveScenarioLabel("Previous year", "LY")).toBe("LY");
        expect(resolveScenarioLabel("Reference Scenario", "")).toBe("RS");
    });
});

describe("column widths", () => {
    it("keeps the comparison wider and the integrated variance narrower", () => {
        expect(resolveColumnWidths(270, {
            overlapActualPercent: 23,
            overlapComparisonPercent: 30,
            integratedActualPercent: 80,
            integratedVariancePercent: 70
        })).toEqual({
            overlapActual: 62.1,
            overlapComparison: 81,
            integratedActual: 216,
            integratedVariance: 151.2
        });
    });

    it("prevents the foreground overlap column from exceeding the comparison", () => {
        const widths = resolveColumnWidths(100, {
            overlapActualPercent: 80,
            overlapComparisonPercent: 20,
            integratedActualPercent: 80,
            integratedVariancePercent: 70
        });
        expect(widths.overlapActual).toBe(20);
        expect(widths.overlapComparison).toBe(20);
    });
});

describe("integrated variance geometry", () => {
    it("keeps a tiny variance visible without showing a colliding label", () => {
        const geometry = resolveIntegratedVarianceGeometry(100, 99.5);
        expect(geometry).toEqual({ top: 99.5, height: 3 });
        expect(canShowIntegratedVarianceLabel(120, geometry.height, 12)).toBe(false);
    });

    it("shows a variance label only when width and height both fit", () => {
        expect(canShowIntegratedVarianceLabel(80, 24, 12)).toBe(true);
        expect(canShowIntegratedVarianceLabel(40, 24, 12)).toBe(false);
    });
});
