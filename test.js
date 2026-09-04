const echartsInstances = {};
window = { getPeriod: () => ({s: "2026-08-01", e: "2026-08-26"}) };

async function fetchAndRenderChartWithOverride(chartId, locId, start, end) {
    if (echartsInstances[chartId]) {
        console.log("showLoading");
    }

    try {
        const originalGetPeriod = window.getPeriod;
        window.getPeriod = () => ({ s: start, e: end });
        
        try {
            console.log(window.getPeriod());
        } finally {
            window.getPeriod = originalGetPeriod;
        }
        
    } catch (e) {
        console.error("fetchAndRenderChartWithOverride error:", e);
    }
}
fetchAndRenderChartWithOverride("echart-cal", null, "2026-01-01", "2026-12-31").catch(console.error);
