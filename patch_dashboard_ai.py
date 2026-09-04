with open('dashboard2.js', 'r') as f:
    content = f.read()

ai_script = """
function injectAiButtons() {
    const dashboardCards = document.querySelectorAll('#view-dashboard2 .card');
    dashboardCards.forEach(card => {
        const titleEl = card.querySelector('h3');
        if (!titleEl || card.querySelector('.ai-analyze-btn')) return;

        // Wrap title in a flex container if it's not already
        if (titleEl.parentElement.style.display !== 'flex') {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.justifyContent = 'space-between';
            wrapper.style.alignItems = 'center';
            wrapper.style.marginBottom = titleEl.style.marginBottom || '16px';
            titleEl.style.marginBottom = '0';
            
            titleEl.parentNode.insertBefore(wrapper, titleEl);
            wrapper.appendChild(titleEl);
            
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
        }
    });
}

async function runAiAnalysis(chartId, title) {
    const modal = document.getElementById('ai-analysis-modal');
    const content = document.getElementById('ai-modal-content');
    const modalTitle = document.getElementById('ai-modal-title');
    
    if (!modal || !content) return;
    
    modalTitle.innerText = `Analiză AI: ${title}`;
    content.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100px;"><div class="spinner"></div><span style="margin-left:10px;">Se analizează datele...</span></div>';
    modal.style.display = 'flex';
    
    // Extract ECharts data
    let chartData = [];
    try {
        const instanceId = chartId.replace('echart-', '');
        const chartInstance = echartsInstances[instanceId] || echarts.getInstanceByDom(document.getElementById(chartId));
        
        if (chartInstance) {
            const opt = chartInstance.getOption();
            
            if (opt.series && opt.series.length) {
                opt.series.forEach((s, idx) => {
                    let seriesName = s.name || `Seria ${idx+1}`;
                    let sData = s.data || [];
                    
                    // For pie/donut, data is usually [{name: 'X', value: 10}]
                    // For line/bar, data is [10, 20, 30] and we need to map to xAxis
                    let mappedData = [];
                    if (opt.xAxis && opt.xAxis[0] && opt.xAxis[0].data) {
                        let xLabels = opt.xAxis[0].data;
                        mappedData = sData.map((val, i) => ({
                            label: xLabels[i] || `Punct ${i+1}`,
                            value: val
                        }));
                    } else if (opt.yAxis && opt.yAxis[0] && opt.yAxis[0].data && (s.type === 'bar' && opt.yAxis[0].type === 'category')) {
                        let yLabels = opt.yAxis[0].data;
                        mappedData = sData.map((val, i) => ({
                            label: yLabels[i] || `Punct ${i+1}`,
                            value: val
                        }));
                    } else {
                        mappedData = sData;
                    }
                    
                    chartData.push({
                        indicator: seriesName,
                        values: mappedData
                    });
                });
            }
        }
    } catch(e) {
        console.error("Error extracting chart data:", e);
    }
    
    try {
        const res = await fetch('/api/ai/analyze-chart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, data: chartData })
        });
        const data = await res.json();
        
        if (data.success) {
            let htmlText = data.analysis
                .replace(/\\n/g, '<br>')
                .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
            content.innerHTML = htmlText;
        } else {
            content.innerHTML = `<div style="color:var(--danger)">Eroare: ${data.error || 'Nu s-a putut genera analiza.'}</div>`;
        }
    } catch(e) {
        content.innerHTML = `<div style="color:var(--danger)">Eroare rețea: ${e.message}</div>`;
    }
}
"""

content = content + "\n\n" + ai_script

# Inject call to injectAiButtons() at the end of initDashboard2
content = content.replace("        setTimeout(() => {\n            Object.values(echartsInstances).forEach(chart => {\n                if(chart) chart.resize();\n            });\n        }, 100);\n    } catch (e) {", "        setTimeout(() => {\n            Object.values(echartsInstances).forEach(chart => {\n                if(chart) chart.resize();\n            });\n            injectAiButtons();\n        }, 100);\n    } catch (e) {")

with open('dashboard2.js', 'w') as f:
    f.write(content)
