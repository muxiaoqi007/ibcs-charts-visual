import { describe, expect, it } from "vitest";
import { appendGrandTotal, buildVariancePoint, isFavorable, resolveDisplayUnit, resolveLayout } from "../src/model";

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

    it("selects responsive layouts by available height", () => {
        expect(resolveLayout("responsive", 520, true)).toBe("actualAbsoluteRelative");
        expect(resolveLayout("responsive", 350, true)).toBe("actualAbsolute");
        expect(resolveLayout("responsive", 240, true)).toBe("absoluteRelative");
        expect(resolveLayout("responsive", 150, true)).toBe("absolute");
        expect(resolveLayout("responsive", 520, false)).toBe("actual");
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
