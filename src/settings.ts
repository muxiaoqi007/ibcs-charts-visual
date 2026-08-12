"use strict";

import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

const layoutItems: powerbi.IEnumMember[] = [
    { displayName: "响应式", value: "responsive" },
    { displayName: "集成差异", value: "integratedVariance" },
    { displayName: "绝对差异", value: "absolute" },
    { displayName: "相对差异", value: "relative" },
    { displayName: "绝对差异 / 相对差异", value: "absoluteRelative" },
    { displayName: "实际值 / 绝对差异", value: "actualAbsolute" },
    { displayName: "实际值 / 相对差异", value: "actualRelative" },
    { displayName: "实际值", value: "actual" }
];

const displayUnitsItems: powerbi.IEnumMember[] = [
    { displayName: "自动", value: "auto" },
    { displayName: "无", value: "none" },
    { displayName: "千 (K)", value: "thousands" },
    { displayName: "百万 (M)", value: "millions" },
    { displayName: "十亿 (B)", value: "billions" },
    { displayName: "万亿 (T)", value: "trillions" }
];

const topNModeItems: powerbi.IEnumMember[] = [
    { displayName: "关闭", value: "off" },
    { displayName: "前 N 项", value: "top" },
    { displayName: "后 N 项", value: "bottom" },
    { displayName: "前后 N 项", value: "topBottom" }
];

const topNRankItems: powerbi.IEnumMember[] = [
    { displayName: "实际值", value: "actual" },
    { displayName: "绝对差异", value: "absoluteVariance" }
];

class ChartSettingsCard extends FormattingSettingsCard {
    layout = new formattingSettings.ItemDropdown({
        name: "layout",
        displayName: "布局",
        items: layoutItems,
        value: layoutItems[0]
    });

    invertVarianceColors = new formattingSettings.ToggleSwitch({
        name: "invertVarianceColors",
        displayName: "反转差异颜色",
        value: false
    });

    treatNullsAsZeros = new formattingSettings.ToggleSwitch({
        name: "treatNullsAsZeros",
        displayName: "将空值视为零",
        value: false
    });

    grandTotal = new formattingSettings.ToggleSwitch({
        name: "grandTotal",
        displayName: "显示总计",
        value: false
    });

    showVerticalAxis = new formattingSettings.ToggleSwitch({
        name: "showVerticalAxis",
        displayName: "显示纵轴",
        value: false
    });

    name = "chartSettings";
    displayName = "图表设置";
    slices: FormattingSettingsSlice[] = [
        this.layout,
        this.invertVarianceColors,
        this.treatNullsAsZeros,
        this.grandTotal,
        this.showVerticalAxis
    ];
}

class ColorsCard extends FormattingSettingsCard {
    actualColor = new formattingSettings.ColorPicker({
        name: "actualColor",
        displayName: "实际值",
        value: { value: "#404040" }
    });

    comparisonColor = new formattingSettings.ColorPicker({
        name: "comparisonColor",
        displayName: "对比值（上年/计划）",
        value: { value: "#D2D2D2" }
    });

    positiveColor = new formattingSettings.ColorPicker({
        name: "positiveColor",
        displayName: "有利差异",
        value: { value: "#69C900" }
    });

    negativeColor = new formattingSettings.ColorPicker({
        name: "negativeColor",
        displayName: "不利差异",
        value: { value: "#FF2B0B" }
    });

    baselineColor = new formattingSettings.ColorPicker({
        name: "baselineColor",
        displayName: "基准线",
        value: { value: "#808080" }
    });

    name = "colors";
    displayName = "颜色";
    slices: FormattingSettingsSlice[] = [
        this.actualColor,
        this.comparisonColor,
        this.positiveColor,
        this.negativeColor,
        this.baselineColor
    ];
}

class ScenarioLabelsCard extends FormattingSettingsCard {
    actualLabel = new formattingSettings.TextInput({
        name: "actualLabel",
        displayName: "实际值缩写",
        value: "AC",
        placeholder: "AC"
    });

    comparisonLabel = new formattingSettings.TextInput({
        name: "comparisonLabel",
        displayName: "对比值缩写",
        value: "",
        placeholder: "自动"
    });

    name = "scenarioLabels";
    displayName = "场景标签";
    slices: FormattingSettingsSlice[] = [this.actualLabel, this.comparisonLabel];
}

class ColumnDesignCard extends FormattingSettingsCard {
    overlapActualPercent = new formattingSettings.NumUpDown({
        name: "overlapActualPercent",
        displayName: "重叠实际柱宽度 (%)",
        value: 23,
        options: { minValue: { value: 5, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 100, type: powerbi.visuals.ValidatorType.Max } }
    });

    overlapComparisonPercent = new formattingSettings.NumUpDown({
        name: "overlapComparisonPercent",
        displayName: "重叠对比柱宽度 (%)",
        value: 30,
        options: { minValue: { value: 5, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 100, type: powerbi.visuals.ValidatorType.Max } }
    });

    integratedActualPercent = new formattingSettings.NumUpDown({
        name: "integratedActualPercent",
        displayName: "集成实际柱宽度 (%)",
        value: 80,
        options: { minValue: { value: 10, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 100, type: powerbi.visuals.ValidatorType.Max } }
    });

    integratedVariancePercent = new formattingSettings.NumUpDown({
        name: "integratedVariancePercent",
        displayName: "集成差异块宽度 (%)",
        value: 70,
        options: { minValue: { value: 10, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 100, type: powerbi.visuals.ValidatorType.Max } }
    });

    variancePanelPercent = new formattingSettings.NumUpDown({
        name: "variancePanelPercent",
        displayName: "独立差异柱宽度 (%)",
        value: 30,
        options: { minValue: { value: 5, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 100, type: powerbi.visuals.ValidatorType.Max } }
    });

    name = "columnDesign";
    displayName = "柱形设计";
    slices: FormattingSettingsSlice[] = [
        this.overlapActualPercent,
        this.overlapComparisonPercent,
        this.integratedActualPercent,
        this.integratedVariancePercent,
        this.variancePanelPercent
    ];
}

class TopNCard extends FormattingSettingsCard {
    mode = new formattingSettings.ItemDropdown({
        name: "mode",
        displayName: "筛选方式",
        items: topNModeItems,
        value: topNModeItems[0]
    });

    count = new formattingSettings.NumUpDown({
        name: "count",
        displayName: "保留项数",
        value: 8,
        options: { minValue: { value: 1, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 100, type: powerbi.visuals.ValidatorType.Max } }
    });

    rankBy = new formattingSettings.ItemDropdown({
        name: "rankBy",
        displayName: "排序依据",
        items: topNRankItems,
        value: topNRankItems[0]
    });

    includeOthers = new formattingSettings.ToggleSwitch({
        name: "includeOthers",
        displayName: "汇总为“其他”",
        value: true
    });

    name = "topN";
    displayName = "前 N 项与其他";
    slices: FormattingSettingsSlice[] = [this.mode, this.count, this.rankBy, this.includeOthers];
}

class DataLabelsCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "显示数据标签",
        value: true
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "数值字号",
        value: 12,
        options: { minValue: { value: 8, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 28, type: powerbi.visuals.ValidatorType.Max } }
    });

    categoryFontSize = new formattingSettings.NumUpDown({
        name: "categoryFontSize",
        displayName: "类目字号",
        value: 11,
        options: { minValue: { value: 8, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 24, type: powerbi.visuals.ValidatorType.Max } }
    });

    decimalPlaces = new formattingSettings.NumUpDown({
        name: "decimalPlaces",
        displayName: "小数位数",
        value: 1,
        options: { minValue: { value: 0, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 4, type: powerbi.visuals.ValidatorType.Max } }
    });

    displayUnits = new formattingSettings.ItemDropdown({
        name: "displayUnits",
        displayName: "显示单位",
        items: displayUnitsItems,
        value: displayUnitsItems[0]
    });

    name = "dataLabels";
    displayName = "数据标签";
    slices: FormattingSettingsSlice[] = [this.show, this.displayUnits, this.decimalPlaces, this.fontSize, this.categoryFontSize];
}

class TitleCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "显示标题",
        value: true
    });

    text = new formattingSettings.TextInput({
        name: "text",
        displayName: "标题文本",
        value: "",
        placeholder: "自动"
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "标题字号",
        value: 14,
        options: { minValue: { value: 9, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 32, type: powerbi.visuals.ValidatorType.Max } }
    });

    name = "title";
    displayName = "标题";
    slices: FormattingSettingsSlice[] = [this.show, this.text, this.fontSize];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    chartSettings = new ChartSettingsCard();
    scenarioLabels = new ScenarioLabelsCard();
    columnDesign = new ColumnDesignCard();
    topN = new TopNCard();
    colors = new ColorsCard();
    dataLabels = new DataLabelsCard();
    title = new TitleCard();

    cards = [this.chartSettings, this.topN, this.scenarioLabels, this.columnDesign, this.colors, this.dataLabels, this.title];
}
