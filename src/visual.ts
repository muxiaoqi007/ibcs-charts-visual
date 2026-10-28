"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataView = powerbi.DataView;
import DataViewValueColumn = powerbi.DataViewValueColumn;

import {
    aggregateVariancePoints,
    appendGrandTotal,
    buildHighlightVariancePoint,
    buildVariancePoint,
    DisplayUnitsMode,
    LayoutMode,
    resolveLayout,
    resolveScenarioLabel,
    resolveTopNSelection,
    TopNMode,
    TopNRankBy
} from "./model";
import { IBCSRenderer, RendererDataPoint, RenderSettings } from "./renderer";
import { VisualFormattingSettingsModel } from "./settings";

export class Visual implements IVisual {
    private readonly events: IVisualEventService;
    private readonly host: IVisualHost;
    private readonly selectionManager: ISelectionManager;
    private readonly renderer: IBCSRenderer;
    private readonly formattingSettingsService: FormattingSettingsService;
    private formattingSettings = new VisualFormattingSettingsModel();

    constructor(options: VisualConstructorOptions) {
        this.events = options.host.eventService;
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager();
        this.formattingSettingsService = new FormattingSettingsService();
        this.renderer = new IBCSRenderer(options.element, options.host.tooltipService, {
            select: (selectionId, multiSelect) => {
                this.selectionManager.select(selectionId, multiSelect).then(ids => this.renderer.updateSelection(ids as ISelectionId[]));
            },
            clear: () => {
                this.selectionManager.clear().then(() => this.renderer.updateSelection([]));
            },
            contextMenu: (selectionId, position) => {
                this.selectionManager.showContextMenu(selectionId, position);
            }
        });
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);

        try {
            const dataView = options.dataViews?.[0];
            if (dataView) {
                this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                    VisualFormattingSettingsModel,
                    dataView
                );
            }

            const converted = this.convertData(dataView, options);
            const layoutValue = String(this.formattingSettings.chartSettings.layout.value.value) as LayoutMode;
            const layout = resolveLayout(
                layoutValue,
                options.viewport.width,
                options.viewport.height,
                converted.hasComparison,
                converted.points.length
            );

            this.renderer.render({
                width: options.viewport.width,
                height: options.viewport.height,
                points: converted.points,
                layout,
                responsive: layoutValue === "responsive",
                actualName: converted.actualName,
                comparisonName: converted.comparisonName,
                hasComparison: converted.hasComparison,
                actualLabel: this.formattingSettings.scenarioLabels.actualLabel.value.trim() || "AC",
                comparisonLabel: resolveScenarioLabel(
                    converted.comparisonName,
                    this.formattingSettings.scenarioLabels.comparisonLabel.value
                ),
                title: this.resolveTitle(converted.actualName, converted.comparisonName),
                settings: this.readSettings(),
                selectedIds: this.selectionManager.getSelectionIds() as ISelectionId[],
                locale: this.host.locale,
                theme: this.readTheme()
            });

            this.events.renderingFinished(options);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("IBCS Charts render failed", error);
            this.renderer.showError(message, options.viewport.width, options.viewport.height);
            this.events.renderingFailed(options, message);
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private resolveTitle(actualName: string, comparisonName: string): string {
        const configured = this.formattingSettings.title.text.value.trim();
        if (configured) {
            return configured;
        }
        return comparisonName ? `${actualName} vs ${comparisonName}` : actualName;
    }

    private readSettings(): RenderSettings {
        // Persisted or cleared formatting values can be blank; fall back so layout math never becomes NaN.
        const num = (value: number, fallback: number): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;
        return {
            invertVarianceColors: this.formattingSettings.chartSettings.invertVarianceColors.value,
            showVerticalAxis: this.formattingSettings.chartSettings.showVerticalAxis.value,
            showDataLabels: this.formattingSettings.dataLabels.show.value,
            showTitle: this.formattingSettings.title.show.value,
            valueFontSize: num(this.formattingSettings.dataLabels.fontSize.value, 12),
            categoryFontSize: num(this.formattingSettings.dataLabels.categoryFontSize.value, 11),
            titleFontSize: num(this.formattingSettings.title.fontSize.value, 14),
            decimalPlaces: Math.max(0, Math.min(4, Math.round(num(this.formattingSettings.dataLabels.decimalPlaces.value, 1)))),
            displayUnits: String(this.formattingSettings.dataLabels.displayUnits.value.value) as DisplayUnitsMode,
            actualColor: this.formattingSettings.colors.actualColor.value.value,
            comparisonColor: this.formattingSettings.colors.comparisonColor.value.value,
            positiveColor: this.formattingSettings.colors.positiveColor.value.value,
            negativeColor: this.formattingSettings.colors.negativeColor.value.value,
            baselineColor: this.formattingSettings.colors.baselineColor.value.value,
            overlapActualPercent: num(this.formattingSettings.columnDesign.overlapActualPercent.value, 23),
            overlapComparisonPercent: num(this.formattingSettings.columnDesign.overlapComparisonPercent.value, 30),
            integratedActualPercent: num(this.formattingSettings.columnDesign.integratedActualPercent.value, 80),
            integratedVariancePercent: num(this.formattingSettings.columnDesign.integratedVariancePercent.value, 70),
            variancePanelPercent: num(this.formattingSettings.columnDesign.variancePanelPercent.value, 30)
        };
    }

    private readTheme(): { highContrast: boolean; foreground: string; background: string; selected: string } {
        const palette = this.host.colorPalette;
        return {
            highContrast: palette.isHighContrast,
            foreground: palette.foreground.value,
            background: palette.background.value,
            selected: palette.foregroundSelected.value
        };
    }

    private convertData(dataView: DataView | undefined, options: VisualUpdateOptions): {
        points: RendererDataPoint[];
        actualName: string;
        comparisonName: string;
        hasComparison: boolean;
    } {
        const categorical = dataView?.categorical;
        const categoryColumn = categorical?.categories?.[0];
        const actualColumn = categorical?.values?.find(column => Boolean(column.source.roles?.actual));
        const comparisonColumn = categorical?.values?.find(column => Boolean(column.source.roles?.comparison));
        const tooltipColumns = categorical?.values?.filter(column => Boolean(column.source.roles?.Tooltips)) ?? [];
        const actualName = actualColumn?.source.displayName ?? "实际值";
        const comparisonName = comparisonColumn?.source.displayName ?? "";

        if (!actualColumn && !comparisonColumn) {
            return { points: [], actualName, comparisonName, hasComparison: false };
        }

        const rowCount = Math.max(
            categoryColumn?.values.length ?? 0,
            actualColumn?.values.length ?? 0,
            comparisonColumn?.values.length ?? 0
        );
        const points: RendererDataPoint[] = [];
        const treatNullsAsZeros = this.formattingSettings.chartSettings.treatNullsAsZeros.value;
        const highlightsActive = Boolean(actualColumn?.highlights || comparisonColumn?.highlights);

        for (let index = 0; index < rowCount; index += 1) {
            const raw = buildVariancePoint({
                category: String(categoryColumn?.values[index] ?? index + 1),
                actual: this.numericValue(actualColumn, index),
                comparison: this.numericValue(comparisonColumn, index)
            }, treatNullsAsZeros);

            if (!raw) {
                continue;
            }
            const highlight = buildHighlightVariancePoint({
                category: raw.category,
                actual: this.numericHighlightValue(actualColumn, index),
                comparison: this.numericHighlightValue(comparisonColumn, index)
            }, highlightsActive);

            const selectionId = categoryColumn
                ? this.host.createSelectionIdBuilder().withCategory(categoryColumn, index).createSelectionId()
                : undefined;
            points.push({
                ...raw,
                highlight: highlight.point,
                highlightsActive: highlight.hasHighlight,
                selectionId,
                actualFormat: actualColumn?.source.format,
                comparisonFormat: comparisonColumn?.source.format,
                tooltipItems: tooltipColumns.flatMap(column => {
                    const formatted = this.formattedColumnValue(column, index);
                    return formatted === null ? [] : [{ displayName: column.source.displayName, value: formatted }];
                })
            });
        }

        const allPoints = [...points];
        const topNMode = String(this.formattingSettings.topN.mode.value.value) as TopNMode;
        if (topNMode !== "off") {
            const selection = resolveTopNSelection(
                allPoints,
                topNMode,
                this.formattingSettings.topN.count.value,
                String(this.formattingSettings.topN.rankBy.value.value) as TopNRankBy
            );
            const filteredPoints = selection.includedIndexes.map(index => allPoints[index]);
            if (this.formattingSettings.topN.includeOthers.value && selection.excludedIndexes.length > 0) {
                const excludedPoints = selection.excludedIndexes.map(index => allPoints[index]);
                const other = aggregateVariancePoints(excludedPoints, "其他");
                const highlightedOther = aggregateVariancePoints(
                    excludedPoints
                        .map(point => point.highlight)
                        .filter((point): point is NonNullable<typeof point> => point !== null && point !== undefined),
                    "其他"
                );
                if (other) {
                    filteredPoints.push({
                        ...other,
                        highlight: highlightsActive ? highlightedOther : undefined,
                        highlightsActive,
                        actualFormat: actualColumn?.source.format,
                        comparisonFormat: comparisonColumn?.source.format
                    });
                }
            }
            points.splice(0, points.length, ...filteredPoints);
        }

        if (this.formattingSettings.chartSettings.grandTotal.value) {
            const withTotal = appendGrandTotal(allPoints, "总计");
            if (withTotal.length > allPoints.length) {
                const highlightedPoints = allPoints
                    .map(point => point.highlight)
                    .filter((point): point is NonNullable<typeof point> => point !== null && point !== undefined);
                const highlightedWithTotal = appendGrandTotal(highlightedPoints, "总计");
                const highlightTotal = highlightedWithTotal.length > highlightedPoints.length
                    ? highlightedWithTotal[highlightedWithTotal.length - 1]
                    : null;
                points.push({
                    ...withTotal[withTotal.length - 1],
                    highlight: highlightsActive ? highlightTotal : undefined,
                    highlightsActive,
                    selectionId: undefined,
                    actualFormat: actualColumn?.source.format,
                    comparisonFormat: comparisonColumn?.source.format
                });
            }
        }

        return {
            points,
            actualName,
            comparisonName,
            hasComparison: Boolean(comparisonColumn)
        };
    }

    private numericValue(column: DataViewValueColumn | undefined, index: number): number | null {
        const value = column?.values[index];
        return typeof value === "number" && Number.isFinite(value) ? value : null;
    }

    private numericHighlightValue(column: DataViewValueColumn | undefined, index: number): number | null {
        const value = column?.highlights?.[index];
        return typeof value === "number" && Number.isFinite(value) ? value : null;
    }

    private formattedColumnValue(column: DataViewValueColumn | undefined, index: number): string | null {
        const value = column?.values[index];
        if (value === null || value === undefined) {
            return null;
        }
        return valueFormatter.format(value, column?.source.format, true, this.host.locale);
    }
}
