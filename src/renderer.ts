"use strict";

import powerbi from "powerbi-visuals-api";
import ISelectionId = powerbi.visuals.ISelectionId;
import ITooltipService = powerbi.extensibility.ITooltipService;
import { DisplayUnit, DisplayUnitsMode, isFavorable, ResolvedLayout, resolveDisplayUnit, VariancePoint } from "./model";

const SVG_NS = "http://www.w3.org/2000/svg";

type PanelType = "actual" | "absolute" | "relative";

interface PanelSpec {
    type: PanelType;
    ratio: number;
    integrated?: boolean;
}

interface PanelBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface RendererDataPoint extends VariancePoint {
    selectionId?: ISelectionId;
    actualTooltipValue?: string | null;
    comparisonTooltipValue?: string | null;
    tooltipItems?: Array<{ displayName: string; value: string }>;
}

export interface RenderSettings {
    invertVarianceColors: boolean;
    showVerticalAxis: boolean;
    showDataLabels: boolean;
    showTitle: boolean;
    valueFontSize: number;
    categoryFontSize: number;
    titleFontSize: number;
    decimalPlaces: number;
    displayUnits: DisplayUnitsMode;
    actualColor: string;
    comparisonColor: string;
    positiveColor: string;
    negativeColor: string;
    baselineColor: string;
}

interface RenderOptions {
    width: number;
    height: number;
    points: RendererDataPoint[];
    layout: ResolvedLayout;
    responsive: boolean;
    actualName: string;
    comparisonName: string;
    title: string;
    settings: RenderSettings;
    selectedIds: ISelectionId[];
}

interface RenderProfile {
    showPanelLabels: boolean;
    showCategoryLabels: boolean;
    panelGap: number;
    marginLeft: number;
    marginRight: number;
}

type ActiveRenderOptions = RenderOptions & { profile: RenderProfile };

interface RendererCallbacks {
    select(selectionId: ISelectionId, multiSelect: boolean): void;
    clear(): void;
}

export class IBCSRenderer {
    private readonly svg: SVGSVGElement;
    private selectedIds: ISelectionId[] = [];
    private displayUnit: DisplayUnit = { divisor: 1, suffix: "" };

    constructor(
        element: HTMLElement,
        private readonly tooltipService: ITooltipService,
        private readonly callbacks: RendererCallbacks
    ) {
        this.svg = this.createElement("svg", { class: "ibcs-visual", role: "img" });
        this.svg.addEventListener("click", () => this.callbacks.clear());
        element.appendChild(this.svg);
    }

    public render(options: RenderOptions): void {
        this.svg.replaceChildren();
        this.svg.setAttribute("width", String(Math.max(0, options.width)));
        this.svg.setAttribute("height", String(Math.max(0, options.height)));
        this.svg.setAttribute("viewBox", `0 0 ${Math.max(1, options.width)} ${Math.max(1, options.height)}`);
        this.selectedIds = options.selectedIds;
        this.displayUnit = resolveDisplayUnit(
            options.settings.displayUnits,
            options.points.flatMap(point => [point.actual, point.comparison, point.absoluteVariance])
        );

        this.svg.setAttribute("aria-label", options.title || "IBCS chart");

        if (options.width < 96 || options.height < 72) {
            this.drawMessage("Increase the visual size", options.width, options.height);
            return;
        }
        if (options.points.length === 0) {
            this.drawMessage("Add Category and Actual fields", options.width, options.height);
            return;
        }

        const baseProfile = this.resolveRenderProfile(options);
        const profile: RenderProfile = options.layout === "integratedVariance" && options.width >= 260
            ? { ...baseProfile, marginRight: Math.max(baseProfile.marginRight, 58) }
            : baseProfile;
        const settings: RenderSettings = {
            ...options.settings,
            showTitle: options.settings.showTitle && (!options.responsive || options.height >= 112),
            showVerticalAxis: options.settings.showVerticalAxis && (!options.responsive || options.width >= 360),
            showDataLabels: options.settings.showDataLabels && (!options.responsive || (options.width >= 180 && options.height >= 112)),
            valueFontSize: options.responsive && options.width < 300
                ? Math.min(options.settings.valueFontSize, 11)
                : options.settings.valueFontSize,
            categoryFontSize: options.responsive && options.width < 300
                ? Math.min(options.settings.categoryFontSize, 10)
                : options.settings.categoryFontSize,
            titleFontSize: options.responsive && options.width < 300
                ? Math.min(options.settings.titleFontSize, 13)
                : options.settings.titleFontSize
        };
        const activeOptions: ActiveRenderOptions = { ...options, settings, profile };
        const titleHeight = settings.showTitle ? Math.max(22, settings.titleFontSize + 10) : 5;
        if (settings.showTitle) {
            const title = this.createElement("text", {
                class: "ibcs-title",
                x: profile.marginLeft > 12 ? profile.marginLeft : 8,
                y: Math.max(settings.titleFontSize, 16),
                "font-size": settings.titleFontSize
            });
            title.textContent = this.fitText(options.title, options.width - profile.marginLeft - profile.marginRight, settings.titleFontSize);
            this.svg.appendChild(title);
        }

        const panels = this.panelSpecs(options.layout);
        const categoryHeight = profile.showCategoryLabels ? Math.max(30, settings.categoryFontSize * 2.35) : 5;
        const availableHeight = Math.max(40, options.height - titleHeight - categoryHeight - 8);
        const panelGap = panels.length > 1 ? profile.panelGap : 0;
        const ratioSpace = Math.max(20, availableHeight - panelGap * (panels.length - 1));
        const marginLeft = settings.showVerticalAxis ? 76 : profile.marginLeft;
        const marginRight = profile.marginRight;
        const chartWidth = Math.max(20, options.width - marginLeft - marginRight);
        let cursorY = titleHeight;

        panels.forEach((panel, panelIndex) => {
            const height = ratioSpace * panel.ratio;
            const box: PanelBox = { x: marginLeft, y: cursorY, width: chartWidth, height };
            if (panel.type === "actual") {
                this.drawActualPanel(activeOptions, box, panel.integrated === true);
            } else if (panel.type === "absolute") {
                this.drawVariancePanel(activeOptions, box, false);
            } else {
                this.drawVariancePanel(activeOptions, box, true);
            }
            cursorY += height + panelGap;

            if (panelIndex === panels.length - 1 && profile.showCategoryLabels) {
                this.drawCategoryLabels(activeOptions, box.x, box.y + box.height + 5, box.width);
            }
        });

        this.updateSelection(options.selectedIds);
    }

    public updateSelection(selectedIds: ISelectionId[]): void {
        this.selectedIds = selectedIds;
        const marks = this.svg.querySelectorAll<SVGGElement>(".ibcs-category-mark");
        marks.forEach(mark => {
            const key = mark.dataset.selectionKey;
            const active = selectedIds.length === 0 || selectedIds.some(id => id.getKey() === key);
            mark.style.opacity = active ? "1" : "0.24";
        });
    }

    private panelSpecs(layout: ResolvedLayout): PanelSpec[] {
        switch (layout) {
            case "actualAbsoluteRelative":
                return [
                    { type: "relative", ratio: 0.25 },
                    { type: "absolute", ratio: 0.20 },
                    { type: "actual", ratio: 0.55 }
                ];
            case "absoluteRelative":
                return [{ type: "relative", ratio: 0.42 }, { type: "absolute", ratio: 0.58 }];
            case "actualAbsolute":
                return [{ type: "absolute", ratio: 0.30 }, { type: "actual", ratio: 0.70 }];
            case "actualRelative":
                return [{ type: "relative", ratio: 0.32 }, { type: "actual", ratio: 0.68 }];
            case "absolute":
                return [{ type: "absolute", ratio: 1 }];
            case "relative":
                return [{ type: "relative", ratio: 1 }];
            case "integratedVariance":
                return [{ type: "actual", ratio: 1, integrated: true }];
            default:
                return [{ type: "actual", ratio: 1 }];
        }
    }

    private resolveRenderProfile(options: RenderOptions): RenderProfile {
        if (!options.responsive) {
            return {
                showPanelLabels: true,
                showCategoryLabels: true,
                panelGap: 10,
                marginLeft: 66,
                marginRight: 12
            };
        }

        const compact = options.width < 360 || options.height < 280;
        const veryCompact = options.width < 210 || options.height < 132;
        return {
            showPanelLabels: !veryCompact,
            showCategoryLabels: options.height >= 104,
            panelGap: compact ? 6 : 10,
            marginLeft: veryCompact ? 8 : compact ? 48 : 66,
            marginRight: compact ? 8 : 12
        };
    }

    private drawActualPanel(options: ActiveRenderOptions, box: PanelBox, integrated: boolean): void {
        if (integrated) {
            this.drawIntegratedVariancePanel(options, box);
            return;
        }

        const values = options.points.flatMap(point => [point.actual, point.comparison]).filter(this.isNumber);
        const min = Math.min(0, ...values);
        const max = Math.max(0, ...values);
        const [rangeMin, rangeMax] = this.panelRange(box, options.settings.showDataLabels, options.settings.valueFontSize);
        const scale = this.linearScale(min, max, rangeMin, rangeMax);
        const zeroY = scale(0);
        const step = box.width / options.points.length;
        const comparisonWidth = Math.min(80, Math.max(3, step * 0.74));
        const actualWidth = Math.min(60, Math.max(2, step * 0.55));

        this.drawBaseline(box.x, box.x + box.width, zeroY, options.settings.baselineColor, 1.5);
        if (options.profile.showPanelLabels) {
            this.drawPanelLabel("PY\nAC", box, options.settings.valueFontSize);
        }
        this.drawVerticalAxis(options, box, min, max, scale);

        options.points.forEach((point, index) => {
            const centerX = box.x + step * (index + 0.5);
            const group = this.createCategoryGroup(point, options, centerX);

            if (point.comparison !== null) {
                this.drawBar(group, centerX - comparisonWidth / 2, zeroY, scale(point.comparison), comparisonWidth, options.settings.comparisonColor, "comparison");
                const comparisonY = scale(point.comparison);
                const actualY = point.actual === null ? null : scale(point.actual);
                if (options.settings.showDataLabels && step >= 46 && actualY === null) {
                    this.drawValueLabel(group, centerX, comparisonY, zeroY, this.formatNumber(point.comparison, options.settings.decimalPlaces), options.settings.valueFontSize);
                }
            }
            if (point.actual !== null) {
                this.drawBar(group, centerX - actualWidth / 2, zeroY, scale(point.actual), actualWidth, options.settings.actualColor, "actual");
                if (options.settings.showDataLabels && step >= 24) {
                    this.drawValueLabel(group, centerX, scale(point.actual), zeroY, this.formatNumber(point.actual, options.settings.decimalPlaces), options.settings.valueFontSize);
                }
            }
            if (index === options.points.length - 1 && point.absoluteVariance !== null && point.actual !== null && point.comparison !== null && step >= 18) {
                const arrowX = Math.min(box.x + box.width - 4, centerX + comparisonWidth / 2 + 3);
                const actualY = scale(point.actual);
                const comparisonY = scale(point.comparison);
                const color = this.varianceColor(point.absoluteVariance, options.settings);
                const line = this.createElement("line", { x1: arrowX, y1: comparisonY, x2: arrowX, y2: actualY, stroke: color, "stroke-width": 2 });
                group.appendChild(line);
                const direction = actualY < comparisonY ? -1 : 1;
                const arrow = this.createElement("path", {
                    d: `M ${arrowX - 3} ${actualY - direction * 5} L ${arrowX} ${actualY} L ${arrowX + 3} ${actualY - direction * 5}`,
                    fill: "none",
                    stroke: color,
                    "stroke-width": 2
                });
                group.appendChild(arrow);
                if (index === options.points.length - 1 && point.relativeVariance !== null && options.settings.showDataLabels && step >= 42) {
                    const varianceLabel = this.createElement("text", {
                        class: "ibcs-value-label ibcs-relative-label",
                        x: box.x + box.width - 3,
                        y: (actualY + comparisonY) / 2 + options.settings.valueFontSize / 3,
                        "text-anchor": "end",
                        "font-size": options.settings.valueFontSize
                    });
                    varianceLabel.textContent = this.formatPercent(point.relativeVariance, options.settings.decimalPlaces);
                    group.appendChild(varianceLabel);
                }
            }
            this.svg.appendChild(group);
        });
    }

    private drawIntegratedVariancePanel(options: ActiveRenderOptions, box: PanelBox): void {
        const values = options.points.flatMap(point => [point.actual, point.comparison]).filter(this.isNumber);
        const min = Math.min(0, ...values);
        const max = Math.max(0, ...values);
        const [rangeMin, rangeMax] = this.panelRange(box, options.settings.showDataLabels, options.settings.valueFontSize);
        const scale = this.linearScale(min, max, rangeMin, rangeMax);
        const zeroY = scale(0);
        const step = box.width / options.points.length;
        const actualWidth = Math.min(220, Math.max(8, step * 0.80));
        const varianceWidth = actualWidth * 0.70;

        this.drawBaseline(box.x, box.x + box.width, zeroY, options.settings.baselineColor, 1.5);
        if (options.profile.showPanelLabels) {
            this.drawIntegratedPanelLabels(box, options.settings.valueFontSize);
        }
        this.drawVerticalAxis(options, box, min, max, scale);

        options.points.forEach((point, index) => {
            const centerX = box.x + step * (index + 0.5);
            const group = this.createCategoryGroup(point, options, centerX);
            const actualY = point.actual === null ? null : scale(point.actual);
            const comparisonY = point.comparison === null ? null : scale(point.comparison);

            if (point.actual !== null && actualY !== null) {
                this.drawBar(group, centerX - actualWidth / 2, zeroY, actualY, actualWidth, options.settings.actualColor, "actual");
            } else if (point.comparison !== null && comparisonY !== null) {
                this.drawBar(group, centerX - actualWidth / 2, zeroY, comparisonY, actualWidth, options.settings.comparisonColor, "comparison");
            }

            if (point.absoluteVariance !== null && actualY !== null && comparisonY !== null) {
                const color = this.varianceColor(point.absoluteVariance, options.settings);
                const varianceTop = Math.min(actualY, comparisonY);
                const varianceHeight = Math.max(3, Math.abs(actualY - comparisonY));
                const overlay = this.createElement("rect", {
                    class: "ibcs-bar ibcs-integrated-variance",
                    x: centerX + actualWidth / 2 - varianceWidth,
                    y: varianceTop,
                    width: varianceWidth,
                    height: varianceHeight,
                    fill: color
                });
                group.appendChild(overlay);

                const showVarianceLabel = options.settings.showDataLabels
                    && step >= 58
                    && varianceHeight >= options.settings.valueFontSize + 5;
                if (showVarianceLabel) {
                    const varianceLabel = this.createElement("text", {
                        class: "ibcs-value-label ibcs-integrated-variance-label",
                        x: centerX + actualWidth / 2 - varianceWidth / 2,
                        y: varianceTop - 5,
                        "text-anchor": "middle",
                        "font-size": options.settings.valueFontSize
                    });
                    varianceLabel.textContent = this.formatSigned(point.absoluteVariance, options.settings.decimalPlaces);
                    group.appendChild(varianceLabel);
                }

                if (index === options.points.length - 1 && point.relativeVariance !== null && step >= 48) {
                    this.drawIntegratedVarianceArrow(
                        group,
                        box.x + box.width + options.profile.marginRight - 4,
                        centerX + actualWidth / 2 + Math.min(44, step * 0.18),
                        comparisonY,
                        actualY,
                        point.relativeVariance,
                        color,
                        options.settings
                    );
                }
            }

            const displayedValue = point.actual ?? point.comparison;
            const displayedY = actualY ?? comparisonY;
            if (displayedValue !== null && displayedY !== null && options.settings.showDataLabels && step >= 28) {
                const barHeight = Math.abs(zeroY - displayedY);
                if (barHeight >= options.settings.valueFontSize + 12 && actualY !== null) {
                    const label = this.createElement("text", {
                        class: "ibcs-value-label ibcs-integrated-value-label",
                        x: centerX,
                        y: (zeroY + displayedY) / 2 + options.settings.valueFontSize / 3,
                        "text-anchor": "middle",
                        "font-size": options.settings.valueFontSize
                    });
                    label.textContent = this.formatNumber(displayedValue, options.settings.decimalPlaces);
                    group.appendChild(label);
                } else {
                    const labelY = actualY !== null && comparisonY !== null
                        ? Math.min(actualY, comparisonY)
                        : displayedY;
                    this.drawValueLabel(
                        group,
                        centerX,
                        labelY,
                        zeroY,
                        this.formatNumber(displayedValue, options.settings.decimalPlaces),
                        options.settings.valueFontSize
                    );
                }
            }

            this.svg.appendChild(group);
        });
    }

    private drawIntegratedVarianceArrow(
        group: SVGGElement,
        visualRight: number,
        desiredArrowX: number,
        comparisonY: number,
        actualY: number,
        relativeVariance: number,
        color: string,
        settings: RenderSettings
    ): void {
        const label = this.formatPercent(relativeVariance, settings.decimalPlaces);
        const estimatedLabelWidth = label.length * settings.valueFontSize * 0.56;
        const arrowX = Math.min(desiredArrowX, visualRight - estimatedLabelWidth - 9);
        const direction = actualY >= comparisonY ? 1 : -1;
        const line = this.createElement("line", {
            x1: arrowX,
            y1: comparisonY,
            x2: arrowX,
            y2: actualY,
            stroke: color,
            "stroke-width": 3
        });
        const arrow = this.createElement("path", {
            d: `M ${arrowX - 4} ${actualY - direction * 7} L ${arrowX} ${actualY} L ${arrowX + 4} ${actualY - direction * 7}`,
            fill: color,
            stroke: color,
            "stroke-width": 2
        });
        const percentLabel = this.createElement("text", {
            class: "ibcs-value-label ibcs-relative-label",
            x: arrowX + 7,
            y: (actualY + comparisonY) / 2 + settings.valueFontSize / 3,
            "text-anchor": "start",
            "font-size": settings.valueFontSize
        });
        percentLabel.textContent = label;
        group.append(line, arrow, percentLabel);
    }

    private drawIntegratedPanelLabels(box: PanelBox, fontSize: number): void {
        const x = box.x - 10;
        const varianceLabel = this.createElement("text", {
            class: "ibcs-panel-label",
            x,
            y: box.y + Math.max(11, fontSize),
            "text-anchor": "end",
            "font-size": Math.max(10, fontSize)
        });
        varianceLabel.textContent = "ΔPY";
        const actualLabel = this.createElement("text", {
            class: "ibcs-panel-label",
            x,
            y: box.y + box.height * 0.55,
            "text-anchor": "end",
            "font-size": Math.max(10, fontSize)
        });
        actualLabel.textContent = "AC";
        this.svg.append(varianceLabel, actualLabel);
    }

    private drawVariancePanel(options: ActiveRenderOptions, box: PanelBox, relative: boolean): void {
        const values = options.points
            .map(point => relative ? point.relativeVariance : point.absoluteVariance)
            .filter(this.isNumber);
        const min = Math.min(0, ...values);
        const max = Math.max(0, ...values);
        const [rangeMin, rangeMax] = this.panelRange(box, options.settings.showDataLabels, options.settings.valueFontSize);
        const scale = this.linearScale(min, max, rangeMin, rangeMax);
        const zeroY = scale(0);
        const step = box.width / options.points.length;
        const barWidth = Math.min(52, Math.max(3, step * 0.72));

        this.drawBaseline(box.x, box.x + box.width, zeroY, options.settings.baselineColor, 3);
        if (options.profile.showPanelLabels) {
            this.drawPanelLabel(relative ? "ΔPY%" : "ΔPY", box, options.settings.valueFontSize);
        }
        this.drawVerticalAxis(options, box, min, max, scale, relative);

        options.points.forEach((point, index) => {
            const value = relative ? point.relativeVariance : point.absoluteVariance;
            if (value === null) {
                return;
            }
            const centerX = box.x + step * (index + 0.5);
            const valueY = scale(value);
            const group = this.createCategoryGroup(point, options, centerX);
            const color = this.varianceColor(value, options.settings);

            if (relative) {
                const stem = this.createElement("line", {
                    x1: centerX,
                    y1: zeroY,
                    x2: centerX,
                    y2: valueY,
                    stroke: color,
                    "stroke-width": Math.max(3, Math.min(5, step * 0.08))
                });
                const dot = this.createElement("circle", { cx: centerX, cy: valueY, r: 4.2, fill: "#000000" });
                group.append(stem, dot);
            } else {
                this.drawBar(group, centerX - barWidth / 2, zeroY, valueY, barWidth, color, "variance");
            }

            if (options.settings.showDataLabels && step >= 24) {
                const label = relative
                    ? this.formatPercent(value, options.settings.decimalPlaces)
                    : this.formatSigned(value, options.settings.decimalPlaces);
                this.drawValueLabel(group, centerX, valueY, zeroY, label, options.settings.valueFontSize, relative);
            }
            this.svg.appendChild(group);
        });
    }

    private drawCategoryLabels(options: ActiveRenderOptions, x: number, y: number, width: number): void {
        const step = width / options.points.length;
        const minimumLabelWidth = Math.max(48, options.settings.categoryFontSize * 4.5);
        const every = Math.max(1, Math.ceil(minimumLabelWidth / Math.max(1, step)));
        const visibleIndexes = new Set<number>();
        for (let index = 0; index < options.points.length; index += every) {
            visibleIndexes.add(index);
        }
        const lastIndex = options.points.length - 1;
        const previousIndex = [...visibleIndexes].at(-1);
        if (previousIndex !== undefined && lastIndex - previousIndex < every * 0.65) {
            visibleIndexes.delete(previousIndex);
        }
        visibleIndexes.add(lastIndex);

        options.points.forEach((point, index) => {
            if (!visibleIndexes.has(index)) {
                return;
            }
            const centerX = x + step * (index + 0.5);
            const label = this.createElement("text", {
                class: "ibcs-category-label",
                x: centerX,
                y,
                "font-size": options.settings.categoryFontSize,
                "text-anchor": "middle"
            });
            const labelWidth = Math.max(step, Math.min(width, step * every - 4));
            const lines = this.splitLabel(point.category, labelWidth, options.settings.categoryFontSize);
            lines.forEach((line, lineIndex) => {
                const tspan = this.createElement("tspan", { x: centerX, dy: lineIndex === 0 ? "0" : "1.1em" });
                tspan.textContent = line;
                label.appendChild(tspan);
            });
            this.svg.appendChild(label);
        });
    }

    private drawVerticalAxis(
        options: RenderOptions,
        box: PanelBox,
        min: number,
        max: number,
        scale: (value: number) => number,
        percent = false
    ): void {
        if (!options.settings.showVerticalAxis) {
            return;
        }
        const axisX = box.x - 6;
        const axis = this.createElement("line", { x1: axisX, y1: box.y + 5, x2: axisX, y2: box.y + box.height - 5, stroke: "#B5B5B5", "stroke-width": 1 });
        this.svg.appendChild(axis);
        [min, max].forEach(value => {
            const text = this.createElement("text", {
                class: "ibcs-axis-label",
                x: axisX - 4,
                y: scale(value) + 4,
                "text-anchor": "end",
                "font-size": Math.max(8, options.settings.valueFontSize - 2)
            });
            text.textContent = percent ? this.formatPercent(value, options.settings.decimalPlaces) : this.formatNumber(value, options.settings.decimalPlaces);
            this.svg.appendChild(text);
        });
    }

    private drawPanelLabel(text: string, box: PanelBox, fontSize: number): void {
        const label = this.createElement("text", {
            class: "ibcs-panel-label",
            x: box.x - 10,
            y: box.y + box.height / 2,
            "text-anchor": "end",
            "font-size": Math.max(10, fontSize)
        });
        text.split("\n").forEach((line, index) => {
            const span = this.createElement("tspan", { x: box.x - 10, dy: index === 0 ? "-0.15em" : "1.05em" });
            span.textContent = line;
            label.appendChild(span);
        });
        this.svg.appendChild(label);
    }

    private createCategoryGroup(point: RendererDataPoint, options: RenderOptions, focusX: number): SVGGElement {
        const group = this.createElement("g", {
            class: "ibcs-category-mark",
            tabindex: point.selectionId ? 0 : -1,
            role: point.selectionId ? "button" : "img",
            "aria-label": this.ariaLabel(point, options)
        });
        if (point.selectionId) {
            group.dataset.selectionKey = point.selectionId.getKey();
            group.addEventListener("click", event => {
                event.stopPropagation();
                this.callbacks.select(point.selectionId as ISelectionId, event.ctrlKey || event.metaKey);
            });
            group.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    this.callbacks.select(point.selectionId as ISelectionId, event.ctrlKey || event.metaKey);
                }
            });
        }
        group.addEventListener("mousemove", event => this.showTooltip(event, point, options));
        group.addEventListener("mouseleave", () => this.tooltipService.hide({ immediately: true, isTouchEvent: false }));
        group.dataset.focusX = String(focusX);
        return group;
    }

    private showTooltip(event: MouseEvent, point: RendererDataPoint, options: RenderOptions): void {
        if (!this.tooltipService.enabled()) {
            return;
        }
        const items: powerbi.extensibility.VisualTooltipDataItem[] = [{ displayName: "Category", value: point.category }];
        if (point.actual !== null) {
            items.push({
                displayName: options.actualName,
                value: point.actualTooltipValue ?? this.formatRawNumber(point.actual, options.settings.decimalPlaces)
            });
        }
        if (point.comparison !== null) {
            items.push({
                displayName: options.comparisonName || "Comparison",
                value: point.comparisonTooltipValue ?? this.formatRawNumber(point.comparison, options.settings.decimalPlaces)
            });
        }
        if (point.absoluteVariance !== null) {
            items.push({ displayName: "Absolute variance", value: this.formatSigned(point.absoluteVariance, options.settings.decimalPlaces) });
        }
        if (point.relativeVariance !== null) {
            items.push({ displayName: "Relative variance", value: this.formatPercent(point.relativeVariance, options.settings.decimalPlaces) });
        }
        point.tooltipItems?.forEach(item => items.push(item));
        this.tooltipService.show({
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
            dataItems: items,
            identities: point.selectionId ? [point.selectionId] : []
        });
    }

    private drawBar(group: SVGGElement, x: number, zeroY: number, valueY: number, width: number, fill: string, className: string): void {
        const rect = this.createElement("rect", {
            class: `ibcs-bar ibcs-${className}`,
            x,
            y: Math.min(zeroY, valueY),
            width,
            height: Math.max(0.8, Math.abs(zeroY - valueY)),
            fill
        });
        group.appendChild(rect);
    }

    private drawValueLabel(
        group: SVGGElement,
        x: number,
        valueY: number,
        zeroY: number,
        value: string,
        fontSize: number,
        italic = false
    ): void {
        const positive = valueY <= zeroY;
        const label = this.createElement("text", {
            class: italic ? "ibcs-value-label ibcs-relative-label" : "ibcs-value-label",
            x,
            y: positive ? valueY - 5 : valueY + fontSize + 2,
            "text-anchor": "middle",
            "font-size": fontSize
        });
        label.textContent = value;
        group.appendChild(label);
    }

    private drawBaseline(x1: number, x2: number, y: number, color: string, width: number): void {
        this.svg.appendChild(this.createElement("line", { class: "ibcs-baseline", x1, y1: y, x2, y2: y, stroke: color, "stroke-width": width }));
    }

    private varianceColor(value: number, settings: RenderSettings): string {
        return isFavorable(value, settings.invertVarianceColors) ? settings.positiveColor : settings.negativeColor;
    }

    private panelRange(box: PanelBox, showLabels: boolean, fontSize: number): [number, number] {
        const desiredPadding = showLabels ? fontSize + 7 : 8;
        const padding = Math.min(desiredPadding, Math.max(5, box.height * 0.24));
        return [box.y + box.height - padding, box.y + padding];
    }

    private linearScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): (value: number) => number {
        if (domainMin === domainMax) {
            return () => (rangeMin + rangeMax) / 2;
        }
        const padding = (domainMax - domainMin) * 0.14;
        const min = domainMin < 0 ? domainMin - padding : 0;
        const max = domainMax > 0 ? domainMax + padding : 0;
        const span = max - min || 1;
        return value => rangeMin + ((value - min) / span) * (rangeMax - rangeMin);
    }

    private formatNumber(value: number, decimals: number): string {
        const scaled = value / this.displayUnit.divisor;
        return `${new Intl.NumberFormat(undefined, {
            maximumFractionDigits: decimals,
            minimumFractionDigits: decimals
        }).format(scaled)}${this.displayUnit.suffix}`;
    }

    private formatRawNumber(value: number, decimals: number): string {
        return new Intl.NumberFormat(undefined, {
            maximumFractionDigits: decimals,
            minimumFractionDigits: decimals
        }).format(value);
    }

    private formatSigned(value: number, decimals: number): string {
        const formatted = this.formatNumber(value, decimals);
        return value > 0 ? `+${formatted}` : formatted;
    }

    private formatPercent(value: number, decimals: number): string {
        const formatted = new Intl.NumberFormat(undefined, {
            style: "percent",
            maximumFractionDigits: decimals,
            minimumFractionDigits: decimals
        }).format(value);
        return value > 0 ? `+${formatted}` : formatted;
    }

    private splitLabel(value: string, availableWidth: number, fontSize: number): string[] {
        const maxCharacters = Math.max(2, Math.floor(availableWidth / Math.max(4.5, fontSize * 0.56)));
        if (value.length <= maxCharacters) {
            return [value];
        }
        const words = value.split(/\s+/);
        if (words.length > 1) {
            const midpoint = Math.ceil(words.length / 2);
            return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")]
                .map(line => this.truncate(line, maxCharacters));
        }
        return [this.truncate(value, maxCharacters)];
    }

    private truncate(value: string, maxCharacters: number): string {
        return value.length > maxCharacters ? `${value.slice(0, Math.max(1, maxCharacters - 1))}…` : value;
    }

    private fitText(value: string, availableWidth: number, fontSize: number): string {
        const maxCharacters = Math.max(1, Math.floor(Math.max(0, availableWidth) / Math.max(4.5, fontSize * 0.56)));
        if (maxCharacters === 1 && value.length > 1) {
            return "…";
        }
        return this.truncate(value, maxCharacters);
    }

    private ariaLabel(point: RendererDataPoint, options: RenderOptions): string {
        const parts = [point.category];
        if (point.actual !== null) {
            parts.push(`${options.actualName}: ${this.formatNumber(point.actual, options.settings.decimalPlaces)}`);
        }
        if (point.absoluteVariance !== null) {
            parts.push(`variance: ${this.formatSigned(point.absoluteVariance, options.settings.decimalPlaces)}`);
        }
        return parts.join(", ");
    }

    private drawMessage(message: string, width: number, height: number): void {
        const text = this.createElement("text", {
            class: "ibcs-empty-message",
            x: width / 2,
            y: height / 2,
            "text-anchor": "middle"
        });
        text.textContent = message;
        this.svg.appendChild(text);
    }

    private isNumber(value: number | null): value is number {
        return value !== null && Number.isFinite(value);
    }

    private createElement<K extends keyof SVGElementTagNameMap>(
        tag: K,
        attributes: Record<string, string | number | boolean> = {}
    ): SVGElementTagNameMap[K] {
        const element = document.createElementNS(SVG_NS, tag);
        Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
        return element;
    }
}
