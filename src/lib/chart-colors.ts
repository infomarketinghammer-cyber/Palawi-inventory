// Chart colours. Logo hues (teal, leaf) with chroma raised so they read as colour, validated with the
// dataviz palette validator: lightness band, chroma floor, CVD ΔE ≈ 25, normal-vision ΔE ≈ 27 — all pass.
// At most two categorical series per chart; more categories use single-hue bars. Red is for alerts only.
export const SERIES = ["#1b7a57", "#9cc22e"] as const;
export const SINGLE = SERIES[0];
export const ALERT = "#dc2626";
/** Sequential teal (light → dark) for heatmaps. */
export const SEQUENTIAL = ["#e4f2ec", "#c8e4d9", "#9fd0bd", "#6fb99c", "#3c7b62", "#254b3c"] as const;
export const GRID = "#e4f2ec";
export const AXIS = "#496e60";
