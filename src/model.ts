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
export type TopNMode = "off" | "top" | "bottom" | "topBottom";
export type TopNRankBy = "actual" | "absoluteVariance";

export interface DisplayUnit {
    divisor: number;
    suffix: string;
}

export function formatDisplayNumber(
    value: number,
    unit: DisplayUnit,
    decimals: number,
    locale: string
): string {
    const safeDecimals = Number.isFinite(decimals) ? Math.max(0, Math.min(20, Math.floor(decimals))) : 0;
    const formatted = new Intl.NumberFormat(locale, {
        maximumFractionDigits: safeDecimals,
        minimumFractionDigits: safeDecimals
    }).format(value / unit.divisor);
    return `${formatted}${unit.suffix}`;
}

export interface ColumnWidthSettings {
    overlapActualPercent: number;
    overlapComparisonPercent: number;
    integratedActualPercent: number;
    integratedVariancePercent: number;
    variancePanelPercent: number;
}

export interface ColumnWidths {
    overlapActual: number;
    overlapComparison: number;
    integratedActual: number;
    integratedVariance: number;
    variancePanel: number;
}

export interface TopNSelection {
    includedIndexes: number[];
    excludedIndexes: number[];
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
    isGrandTotal?: boolean;
}

export interface HighlightVariancePoint {
    hasHighlight: boolean;
    point: VariancePoint | null;
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

export function buildHighlightVariancePoint(point: RawVariancePoint, highlightsActive: boolean): HighlightVariancePoint {
    if (!highlightsActive) {
        return { hasHighlight: false, point: null };
    }
    return {
        hasHighlight: true,
        point: buildVariancePoint(point, false)
    };
}

export function resolveScenarioLabel(displayName: string, configuredLabel: string): string {
    const configured = configuredLabel.trim();
    if (configured) {
        return configured;
    }

    const normalized = displayName.trim().toLowerCase();
    if (/\b(forecast|fc|estimate|outlook)\b/.test(normalized) || /(预测|预估|展望)/.test(normalized)) {
        return "FC";
    }
    if (/\b(plan|pl|budget|bud|target)\b/.test(normalized) || /(计划|预算|目标)/.test(normalized)) {
        return "PL";
    }
    if (/\b(previous|prior|py|last\s+year|ly)\b/.test(normalized) || /(去年|上年|同期|前期)/.test(normalized)) {
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

export function resolveActualPanelLabel(actualLabel: string, comparisonLabel: string, hasComparison: boolean): string {
    return hasComparison ? `${comparisonLabel}\n${actualLabel}` : actualLabel;
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
    const variancePanel = Math.min(120, Math.max(3, safeStep * percent(settings.variancePanelPercent, 0.30)));

    return {
        overlapActual: actual,
        overlapComparison: comparison,
        integratedActual,
        integratedVariance: variance,
        variancePanel
    };
}

export function resolveTopNSelection(
    points: VariancePoint[],
    mode: TopNMode,
    count: number,
    rankBy: TopNRankBy
): TopNSelection {
    const safeCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
    if (mode === "off" || points.length <= safeCount) {
        return { includedIndexes: points.map((_, index) => index), excludedIndexes: [] };
    }

    const ranked = points.map((point, index) => ({
        index,
        score: Math.abs(rankBy === "absoluteVariance" ? (point.absoluteVariance ?? 0) : (point.actual ?? 0))
    }));
    const selected = new Set<number>();
    if (mode === "top" || mode === "bottom") {
        ranked.sort((left, right) => mode === "top" ? right.score - left.score : left.score - right.score);
        ranked.slice(0, safeCount).forEach(item => selected.add(item.index));
    } else {
        const topCount = Math.ceil(safeCount / 2);
        const bottomCount = Math.floor(safeCount / 2);
        [...ranked].sort((left, right) => right.score - left.score)
            .slice(0, topCount)
            .forEach(item => selected.add(item.index));
        [...ranked].sort((left, right) => left.score - right.score)
            .filter(item => !selected.has(item.index))
            .slice(0, bottomCount)
            .forEach(item => selected.add(item.index));
    }

    return {
        includedIndexes: points.map((_, index) => index).filter(index => selected.has(index)),
        excludedIndexes: points.map((_, index) => index).filter(index => !selected.has(index))
    };
}

export function aggregateVariancePoints(points: VariancePoint[], category: string): VariancePoint | null {
    if (points.length === 0) {
        return null;
    }
    const actualValues = points.map(point => point.actual).filter((value): value is number => value !== null);
    const comparisonValues = points.map(point => point.comparison).filter((value): value is number => value !== null);
    return buildVariancePoint({
        category,
        actual: actualValues.length > 0 ? actualValues.reduce((sum, value) => sum + value, 0) : null,
        comparison: comparisonValues.length > 0 ? comparisonValues.reduce((sum, value) => sum + value, 0) : null
    }, false);
}

export function resolveIntegratedVarianceGeometry(actualY: number, comparisonY: number): IntegratedVarianceGeometry {
    const delta = actualY - comparisonY;
    if (delta === 0) {
        return { top: actualY, height: 0 };
    }

    const height = Math.max(3, Math.abs(delta));
    return {
        top: delta > 0 ? comparisonY : actualY - Math.max(0, height - Math.abs(delta)),
        height
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

export function appendGrandTotal(points: VariancePoint[], label = "Total"): VariancePoint[] {
    if (points.length === 0) {
        return points;
    }
    const total = aggregateVariancePoints(points, label);
    return total ? [...points, { ...total, isGrandTotal: true }] : points;
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
