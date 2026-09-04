import re

with open('dashboard2.js', 'r') as f:
    content = f.read()

# 1. Add global object window.chartDateOverrides
if "window.chartDateOverrides = {}" not in content:
    content = content.replace("let echartsInstances = {};", "let echartsInstances = {};\nwindow.chartDateOverrides = {};")

# 2. Modify fetchAndRenderSecondary signature and initial logic
content = re.sub(
    r'async function fetchAndRenderSecondary\(locId, dateFilter\) \{',
    r'async function fetchAndRenderSecondary(locId, dateFilter, targetChartId = null) {\n    if (targetChartId && window.echartsInstances[targetChartId]) window.echartsInstances[targetChartId].showLoading({text: "Se descarcă datele...", color: "#3b82f6", textColor: "#fff", maskColor: "rgba(15, 15, 26, 0.8)"});',
    content
)

# 3. Update the injected buttons logic to include a toggle
old_btn_logic = """
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-outline ai-analyze-btn';
            btn.innerText = 'Analiză AI';
            btn.style.padding = '4px 12px';
            btn.style.fontSize = '12px';
            btn.style.borderRadius = '6px';
            btn.style.cursor = 'pointer';
            
            // Find the chart container inside this card to get its ID
            const chartDiv = card.querySelector('div[id^="echart-"]');
            if (chartDiv) {
                btn.onclick = () => runAiAnalysis(chartDiv.id, titleEl.innerText);
                wrapper.appendChild(btn);
            }
"""

new_btn_logic = """
            const controlsDiv = document.createElement('div');
            controlsDiv.style.display = 'flex';
            controlsDiv.style.alignItems = 'center';
            controlsDiv.style.gap = '12px';

            // Find the chart container inside this card to get its ID
            const chartDiv = card.querySelector('div[id^="echart-"]');
            
            if (chartDiv) {
                const chartId = chartDiv.id;
                
                // Toggle Checkbox
                const toggleLabel = document.createElement('label');
                toggleLabel.style.display = 'flex';
                toggleLabel.style.alignItems = 'center';
                toggleLabel.style.fontSize = '12px';
                toggleLabel.style.color = 'var(--muted)';
                toggleLabel.style.cursor = 'pointer';
                toggleLabel.style.userSelect = 'none';
                
                const toggleInput = document.createElement('input');
                toggleInput.type = 'checkbox';
                toggleInput.style.marginRight = '6px';
                toggleInput.checked = window.chartDateOverrides[chartId] || false;
                
                toggleInput.onchange = (e) => {
                    const isFullYear = e.target.checked;
                    window.chartDateOverrides[chartId] = isFullYear;
                    
                    let newStart = null;
                    if (isFullYear) {
                        newStart = new Date().getFullYear() + '-01-01';
                    }
                    // Extract locId and current eFilter from global state (if available) or assume defaults
                    // We'll call fetchAndRenderSecondary with the custom dateFilter and targetChartId
                    
                    const currentE = typeof getPeriod === 'function' ? getPeriod().e : new Date().toISOString().split('T')[0];
                    const currentS = typeof getPeriod === 'function' ? getPeriod().s : new Date().getFullYear() + '-01-01';
                    
                    const finalStart = isFullYear ? newStart : currentS;
                    const finalDateFilter = isFullYear ? finalStart : null; // If null, uses global period
                    
                    let activeLoc = typeof currentLocId !== 'undefined' ? currentLocId : null;
                    
                    // We need a specific start/end range if overriden
                    // Actually, if we pass newStart, we must modify fetchAndRenderSecondary to accept an explicit start/end
                    // Or we just modify the global state variables locally.
                    fetchAndRenderChartWithOverride(chartId, activeLoc, finalStart, currentE);
                };
                
                toggleLabel.appendChild(toggleInput);
                toggleLabel.appendChild(document.createTextNode('Tot Anul'));
                controlsDiv.appendChild(toggleLabel);
            
                // AI Button
                const btn = document.createElement('button');
                btn.className = 'btn btn-sm btn-outline ai-analyze-btn';
                btn.innerText = 'Analiză AI';
                btn.style.padding = '4px 12px';
                btn.style.fontSize = '12px';
                btn.style.borderRadius = '6px';
                btn.style.cursor = 'pointer';
                btn.onclick = () => runAiAnalysis(chartId, titleEl.innerText);
                
                controlsDiv.appendChild(btn);
                wrapper.appendChild(controlsDiv);
            }
"""
content = content.replace(old_btn_logic, new_btn_logic)

# 4. Add fetchAndRenderChartWithOverride function
override_func = """
async function fetchAndRenderChartWithOverride(chartId, locId, start, end) {
    const sFilter = start;
    const eFilter = end;
    let locPFilter = typeof locParam === 'function' ? locParam() : '';
    if (locId) {
        locPFilter = `&loc_ids=${locId}`;
    }

    let dEnd = new Date(eFilter);
    let d90Start = new Date(dEnd);
    d90Start.setDate(d90Start.getDate() - 90);
    let s90 = d90Start.toISOString().split('T')[0];
    
    if (echartsInstances[chartId]) {
        echartsInstances[chartId].showLoading({text: 'Se descarcă...', color: '#3b82f6', textColor: '#fff', maskColor: 'rgba(15, 15, 26, 0.8)'});
    }

    try {
        const [kpiData, trendData, timelineData, expData, locsData, cabsData, provsData, hourlyData] = await Promise.all([
            api(`/api/kpi?start=${sFilter}&end=${eFilter}${locPFilter}`),
            api(`/api/daily?res=day&start=${sFilter}&end=${eFilter}${locPFilter}`),
            api(`/api/daily?res=day&start=${s90}&end=${eFilter}${locPFilter}`),
            api(`/api/reports/expenses?start=${sFilter}&end=${eFilter}${locPFilter}`),
            api(`/api/locations?start=${sFilter}&end=${eFilter}${locPFilter}`),
            api(`/api/cabinets?start=${sFilter}&end=${eFilter}${locPFilter}`),
            api(`/api/providers?start=${sFilter}&end=${eFilter}${locPFilter}`),
            api(`/api/reports/hourly?start=${sFilter}&end=${eFilter}${locPFilter}`)
        ]);
        
        // Hide loading
        if (echartsInstances[chartId]) echartsInstances[chartId].hideLoading();
        
        // We will mock the variables and re-run the chart's specific code
        renderTargetChartOnly(chartId, {
            locId, sFilter, eFilter, s90,
            kpiData, trendData, timelineData, expData, locsData, cabsData, provsData, hourlyData
        });
    } catch (e) {
        console.error(e);
        if (echartsInstances[chartId]) echartsInstances[chartId].hideLoading();
    }
}
"""

if "fetchAndRenderChartWithOverride" not in content:
    content += "\n\n" + override_func

with open('dashboard2.js', 'w') as f:
    f.write(content)
