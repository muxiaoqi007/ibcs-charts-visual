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

import { appendGrandTotal, buildVariancePoint, DisplayUnitsMode, LayoutMode, resolveLayout } from "./model";
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
            const layout = resolveLayout(layoutValue, options.viewport.height, converted.hasComparison);

            this.renderer.render({
                width: options.viewport.width,
                height: options.viewport.height,
                points: converted.points,
                layout,
                actualName: converted.actualName,
                comparisonName: converted.comparisonName,
                title: this.resolveTitle(converted.actualName, converted.comparisonName),
                settings: this.readSettings(),
                selectedIds: this.selectionManager.getSelectionIds() as ISelectionId[]
            });

            this.events.renderingFinished(options);
        } catch (error) {
            this.events.renderingFailed(options, error instanceof Error ? error.message : String(error));
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
        return {
            invertVarianceColors: this.formattingSettings.chartSettings.invertVarianceColors.value,
            showVerticalAxis: this.formattingSettings.chartSettings.showVerticalAxis.value,
            showDataLabels: this.formattingSettings.dataLabels.show.value,
            showTitle: this.formattingSettings.title.show.value,
            valueFontSize: this.formattingSettings.dataLabels.fontSize.value,
            categoryFontSize: this.formattingSettings.dataLabels.categoryFontSize.value,
            titleFontSize: this.formattingSettings.title.fontSize.value,
            decimalPlaces: Math.max(0, Math.min(4, Math.round(this.formattingSettings.dataLabels.decimalPlaces.value))),
            displayUnits: String(this.formattingSettings.dataLabels.displayUnits.value.value) as DisplayUnitsMode,
            actualColor: this.formattingSettings.colors.actualColor.value.value,
            comparisonColor: this.formattingSettings.colors.comparisonColor.value.value,
            positiveColor: this.formattingSettings.colors.positiveColor.value.value,
            negativeColor: this.formattingSettings.colors.negativeColor.value.value,
            baselineColor: this.formattingSettings.colors.baselineColor.value.value
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
        const actualName = actualColumn?.source.displayName ?? "Actual";
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

        for (let index = 0; index < rowCount; index += 1) {
            const raw = buildVariancePoint({
                category: String(categoryColumn?.values[index] ?? index + 1),
                actual: this.numericValue(actualColumn, index),
                comparison: this.numericValue(comparisonColumn, index)
            }, treatNullsAsZeros);

            if (!raw) {
                continue;
            }

            const selectionId = categoryColumn
                ? this.host.createSelectionIdBuilder().withCategory(categoryColumn, index).createSelectionId()
                : undefined;
            points.push({
                ...raw,
                selectionId,
                actualTooltipValue: this.formattedColumnValue(actualColumn, index),
                comparisonTooltipValue: this.formattedColumnValue(comparisonColumn, index),
                tooltipItems: tooltipColumns.flatMap(column => {
                    const formatted = this.formattedColumnValue(column, index);
                    return formatted === null ? [] : [{ displayName: column.source.displayName, value: formatted }];
                })
            });
        }

        if (this.formattingSettings.chartSettings.grandTotal.value) {
            const withTotal = appendGrandTotal(points);
            if (withTotal.length > points.length) {
                points.push({ ...withTotal[withTotal.length - 1], selectionId: undefined });
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

    private formattedColumnValue(column: DataViewValueColumn | undefined, index: number): string | null {
        const value = column?.values[index];
        if (value === null || value === undefined) {
            return null;
        }
        return valueFormatter.format(value, column?.source.format, true, this.host.locale);
    }
}
