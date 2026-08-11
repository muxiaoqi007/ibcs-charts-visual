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

export interface ColumnWidthSettings {
    overlapActualPercent: number;
    overlapComparisonPercent: number;
    integratedActualPercent: number;
    integratedVariancePercent: number;
}

export interface ColumnWidths {
    overlapActual: number;
    overlapComparison: number;
    integratedActual: number;
    integratedVariance: number;
}

export interface IntegratedVarianceGeometry {
    top: number;
    height: number;
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

export function resolveScenarioLabel(displayName: string, configuredLabel: string): string {
    const configured = configuredLabel.trim();
    if (configured) {
        return configured;
    }

    const normalized = displayName.trim().toLowerCase();
    if (/\b(forecast|fc|estimate|outlook)\b/.test(normalized)) {
        return "FC";
    }
    if (/\b(plan|pl|budget|bud|target)\b/.test(normalized)) {
        return "PL";
    }
    if (/\b(previous|prior|py|last\s+year|ly)\b/.test(normalized)) {
        return "PY";
    }

    const initials = displayName
        .trim()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .map(part => part[0])
        .join("")
        .toUpperCase();
    return initials.slice(0, 3) || "PY";
}

export function resolveColumnWidths(step: number, settings: ColumnWidthSettings): ColumnWidths {
    const safeStep = Number.isFinite(step) ? Math.max(0, step) : 0;
    const percent = (value: number, fallback: number): number => {
        return Number.isFinite(value) ? Math.max(1, Math.min(100, value)) / 100 : fallback;
    };
    const comparison = Math.min(240, Math.max(3, safeStep * percent(settings.overlapComparisonPercent, 0.30)));
    const actual = Math.min(
        comparison,
        Math.min(240, Math.max(2, safeStep * percent(settings.overlapActualPercent, 0.23)))
    );
    const integratedActual = Math.min(240, Math.max(8, safeStep * percent(settings.integratedActualPercent, 0.80)));
    const variance = integratedActual * percent(settings.integratedVariancePercent, 0.70);

    return {
        overlapActual: actual,
        overlapComparison: comparison,
        integratedActual,
        integratedVariance: variance
    };
}

export function resolveIntegratedVarianceGeometry(actualY: number, comparisonY: number): IntegratedVarianceGeometry {
    return {
        top: Math.min(actualY, comparisonY),
        height: Math.max(3, Math.abs(actualY - comparisonY))
    };
}

export function canShowIntegratedVarianceLabel(step: number, varianceHeight: number, fontSize: number): boolean {
    return step >= 58 && varianceHeight >= fontSize + 5;
}

export function resolveLayout(
    mode: LayoutMode,
    width: number,
    height: number,
    hasComparison: boolean,
    categoryCount: number
): ResolvedLayout {
    if (!hasComparison) {
        return "actual";
    }
    if (mode !== "responsive") {
        return mode;
    }

    const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
    const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
    const safeCategoryCount = Number.isFinite(categoryCount) ? Math.max(1, Math.floor(categoryCount)) : 1;
    const estimatedCategoryWidth = Math.max(0, safeWidth - 78) / safeCategoryCount;

    // Separate variance panels need both vertical room and enough horizontal
    // space per category to keep their marks and labels meaningful.
    if (safeWidth >= 360 && safeHeight >= 460 && estimatedCategoryWidth >= 18) {
        return "actualAbsoluteRelative";
    }
    if (safeWidth >= 260 && safeHeight >= 300 && estimatedCategoryWidth >= 12) {
        return "actualAbsolute";
    }

    // Zebra BI-style responsive charts fold the variance back into the main
    // actual/comparison panel when the visual becomes compact.
    return "integratedVariance";
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
