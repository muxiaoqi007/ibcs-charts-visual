"use strict";

import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

const layoutItems: powerbi.IEnumMember[] = [
    { displayName: "Responsive", value: "responsive" },
    { displayName: "Integrated variance", value: "integratedVariance" },
    { displayName: "Absolute variance", value: "absolute" },
    { displayName: "Relative variance", value: "relative" },
    { displayName: "Absolute / Relative", value: "absoluteRelative" },
    { displayName: "Actual / Absolute", value: "actualAbsolute" },
    { displayName: "Actual / Relative", value: "actualRelative" },
    { displayName: "Actual", value: "actual" }
];

const displayUnitsItems: powerbi.IEnumMember[] = [
    { displayName: "Auto", value: "auto" },
    { displayName: "None", value: "none" },
    { displayName: "Thousands", value: "thousands" },
    { displayName: "Millions", value: "millions" },
    { displayName: "Billions", value: "billions" },
    { displayName: "Trillions", value: "trillions" }
];

class ChartSettingsCard extends FormattingSettingsCard {
    layout = new formattingSettings.ItemDropdown({
        name: "layout",
        displayName: "Layout",
        items: layoutItems,
        value: layoutItems[0]
    });

    invertVarianceColors = new formattingSettings.ToggleSwitch({
        name: "invertVarianceColors",
        displayName: "Invert variance colors",
        value: false
    });

    treatNullsAsZeros = new formattingSettings.ToggleSwitch({
        name: "treatNullsAsZeros",
        displayName: "Treat nulls as zeros",
        value: false
    });

    grandTotal = new formattingSettings.ToggleSwitch({
        name: "grandTotal",
        displayName: "Grand total",
        value: false
    });

    showVerticalAxis = new formattingSettings.ToggleSwitch({
        name: "showVerticalAxis",
        displayName: "Show vertical axis",
        value: false
    });

    name = "chartSettings";
    displayName = "Chart settings";
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
        displayName: "Actual",
        value: { value: "#404040" }
    });

    comparisonColor = new formattingSettings.ColorPicker({
        name: "comparisonColor",
        displayName: "Previous year / Plan",
        value: { value: "#D2D2D2" }
    });

    positiveColor = new formattingSettings.ColorPicker({
        name: "positiveColor",
        displayName: "Favorable variance",
        value: { value: "#69C900" }
    });

    negativeColor = new formattingSettings.ColorPicker({
        name: "negativeColor",
        displayName: "Unfavorable variance",
        value: { value: "#FF2B0B" }
    });

    baselineColor = new formattingSettings.ColorPicker({
        name: "baselineColor",
        displayName: "Baseline",
        value: { value: "#808080" }
    });

    name = "colors";
    displayName = "Colors";
    slices: FormattingSettingsSlice[] = [
        this.actualColor,
        this.comparisonColor,
        this.positiveColor,
        this.negativeColor,
        this.baselineColor
    ];
}

class DataLabelsCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        value: true
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Value text size",
        value: 12,
        options: { minValue: { value: 8, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 28, type: powerbi.visuals.ValidatorType.Max } }
    });

    categoryFontSize = new formattingSettings.NumUpDown({
        name: "categoryFontSize",
        displayName: "Category text size",
        value: 11,
        options: { minValue: { value: 8, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 24, type: powerbi.visuals.ValidatorType.Max } }
    });

    decimalPlaces = new formattingSettings.NumUpDown({
        name: "decimalPlaces",
        displayName: "Decimal places",
        value: 1,
        options: { minValue: { value: 0, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 4, type: powerbi.visuals.ValidatorType.Max } }
    });

    displayUnits = new formattingSettings.ItemDropdown({
        name: "displayUnits",
        displayName: "Display units",
        items: displayUnitsItems,
        value: displayUnitsItems[0]
    });

    name = "dataLabels";
    displayName = "Data labels";
    slices: FormattingSettingsSlice[] = [this.show, this.displayUnits, this.decimalPlaces, this.fontSize, this.categoryFontSize];
}

class TitleCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        value: true
    });

    text = new formattingSettings.TextInput({
        name: "text",
        displayName: "Text",
        value: "",
        placeholder: "Auto"
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Text size",
        value: 14,
        options: { minValue: { value: 9, type: powerbi.visuals.ValidatorType.Min }, maxValue: { value: 32, type: powerbi.visuals.ValidatorType.Max } }
    });

    name = "title";
    displayName = "Title";
    slices: FormattingSettingsSlice[] = [this.show, this.text, this.fontSize];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    chartSettings = new ChartSettingsCard();
    colors = new ColorsCard();
    dataLabels = new DataLabelsCard();
    title = new TitleCard();

    cards = [this.chartSettings, this.colors, this.dataLabels, this.title];
}
