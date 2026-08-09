export type LayoutMode =
    | "responsive"
    | "integratedVariance"
    | "absolute"
    | "relative"
    | "absoluteRelative"
    | "actualAbsolute"
    | "actualRelative"
    | "actual";

export type ResolvedLayout = Exclude<LayoutMode, "responsive"> | "actualAbsoluteRelative";

export type DisplayUnitsMode = "auto" | "none" | "thousands" | "millions" | "billions" | "trillions";

export interface DisplayUnit {
    divisor: number;
    suffix: string;
}

export interface RawVariancePoint {
    category: string;
    actual: number | null | undefined;
    comparison: number | null | undefined;
}

export interface VariancePoint {
    category: string;
    actual: number | null;
    comparison: number | null;
    absoluteVariance: number | null;
    relativeVariance: number | null;
}

function finiteNumber(value: number | null | undefined): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildVariancePoint(point: RawVariancePoint, treatNullsAsZeros: boolean): VariancePoint | null {
    let actual = finiteNumber(point.actual);
    let comparison = finiteNumber(point.comparison);

    if (treatNullsAsZeros) {
        actual ??= 0;
        comparison ??= 0;
    }

    if (actual === null && comparison === null) {
        return null;
    }

    const absoluteVariance = actual !== null && comparison !== null ? actual - comparison : null;
    const relativeVariance = absoluteVariance !== null && comparison !== 0
        ? absoluteVariance / Math.abs(comparison)
        : null;

    return {
        category: point.category,
        actual,
        comparison,
        absoluteVariance,
        relativeVariance
    };
}

export function isFavorable(value: number, invertVarianceColors: boolean): boolean {
    return invertVarianceColors ? value < 0 : value >= 0;
}

export function resolveLayout(mode: LayoutMode, height: number, hasComparison: boolean): ResolvedLayout {
    if (!hasComparison) {
        return "actual";
    }
    if (mode !== "responsive") {
        return mode;
    }
    if (height >= 470) {
        return "actualAbsoluteRelative";
    }
    if (height >= 310) {
        return "actualAbsolute";
    }
    if (height >= 190) {
        return "absoluteRelative";
    }
    return "absolute";
}

export function appendGrandTotal(points: VariancePoint[]): VariancePoint[] {
    if (points.length === 0) {
        return points;
    }
    const actualValues = points.map(point => point.actual).filter((value): value is number => value !== null);
    const comparisonValues = points.map(point => point.comparison).filter((value): value is number => value !== null);
    const total = buildVariancePoint({
        category: "Total",
        actual: actualValues.length > 0 ? actualValues.reduce((sum, value) => sum + value, 0) : null,
        comparison: comparisonValues.length > 0 ? comparisonValues.reduce((sum, value) => sum + value, 0) : null
    }, false);
    return total ? [...points, total] : points;
}

export function resolveDisplayUnit(mode: DisplayUnitsMode, values: Array<number | null | undefined>): DisplayUnit {
    const fixedUnits: Record<Exclude<DisplayUnitsMode, "auto">, DisplayUnit> = {
        none: { divisor: 1, suffix: "" },
        thousands: { divisor: 1_000, suffix: "K" },
        millions: { divisor: 1_000_000, suffix: "M" },
        billions: { divisor: 1_000_000_000, suffix: "B" },
        trillions: { divisor: 1_000_000_000_000, suffix: "T" }
    };
    if (mode !== "auto") {
        return fixedUnits[mode];
    }
    const maxMagnitude = values.reduce<number>((max, value) => {
        return typeof value === "number" && Number.isFinite(value) ? Math.max(max, Math.abs(value)) : max;
    }, 0);
    if (maxMagnitude >= fixedUnits.trillions.divisor) {
        return fixedUnits.trillions;
    }
    if (maxMagnitude >= fixedUnits.billions.divisor) {
        return fixedUnits.billions;
    }
    if (maxMagnitude >= fixedUnits.millions.divisor) {
        return fixedUnits.millions;
    }
    if (maxMagnitude >= fixedUnits.thousands.divisor) {
        return fixedUnits.thousands;
    }
    return fixedUnits.none;
}
