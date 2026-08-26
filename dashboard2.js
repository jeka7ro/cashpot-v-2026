// dashboard2.js - ECharts implementation with REAL API DATA

let echartsInstances = {};

async function initDashboard2() {
    console.log("[Dashboard2] initDashboard2 called (Real Data Mode)");
    try {
        if (typeof echarts === 'undefined') {
            throw new Error("ECharts library is not loaded! The CDN script might be blocked.");
        }
        
        // Asigurăm că avem acces la funcțiile globale din app.js
        if (typeof getPeriod === 'undefined' || typeof api === 'undefined') {
            throw new Error("Missing global functions from app.js. Make sure app.js is loaded first.");
        }

        const isDark = document.body.classList.contains('dark') || getComputedStyle(document.body).getPropertyValue('--bg').trim() === '#0f0f1a';
        const textColor = isDark ? '#e2e8f0' : '#1e293b';
        const splitLineColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const colorPalette = ['#eab308', '#f97316', '#ef4444', '#8b5cf6', '#3b82f6', '#10b981', '#14b8a6', '#f43f5e'];

        // Preluăm filtrele curente de dată
        const { s, e } = getPeriod();
        const locP = typeof locParam === 'function' ? locParam() : '';

        // Fetch data in parallel
        console.log(`[Dashboard2] Fetching data for period: ${s} to ${e}`);
        
        // 90 days for timeline
        let dEnd = new Date(e);
        let d90Start = new Date(dEnd);
        d90Start.setDate(d90Start.getDate() - 90);
        let s90 = d90Start.toISOString().split('T')[0];

        const [locData, kpiData, trendData, timelineData] = await Promise.all([
            api(`/api/locations?start=${s}&end=${e}${locP}`),
            api(`/api/kpi?start=${s}&end=${e}${locP}`),
            api(`/api/daily?res=day&start=${s}&end=${e}${locP}`),
            api(`/api/daily?res=day&start=${s90}&end=${e}${locP}`)
        ]);

        // --- 1. DRILL-DOWN DONUT CHART ---
        const domDonut = document.getElementById('echart-donut');
        if (domDonut) {
            if (!echartsInstances['donut']) echartsInstances['donut'] = echarts.init(domDonut);
            const donutChart = echartsInstances['donut'];
            
            // Cleanup old listeners if they exist to prevent multiple fires
            donutChart.off('click');

            // Calculate days for Average Drop/Machine/Day
            let diffDays = 1;
            if (s && e) {
                const sDate = new Date(s);
                const eDate = new Date(e);
                diffDays = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1);
            }

            // Format locData for ECharts (Average Drop / Machine / Day)
            const level1Data = (locData || []).map(r => {
                const totalIn = r.total_in || 0;
                const machines = r.buc || 1; // prevent division by zero
                const avgDrop = totalIn / machines / diffDays;
                return {
                    name: r.locatie || 'Necunoscut',
                    value: avgDrop,
                    loc_id: r.id
                };
            }).sort((a,b) => b.value - a.value).slice(0, 10); // top 10

            const getDonutOption = (data, titleText) => ({
                title: { text: titleText, left: 'center', top: 'center', textStyle: { color: textColor, fontSize: 13, fontWeight: 'bold' } },
                tooltip: { 
                    trigger: 'item', backgroundColor: 'rgba(15,15,26,0.9)', textStyle: { color: '#fff' }, borderWidth: 1, borderColor: '#eab308', 
                    formatter: (p) => `${p.name}: ${Math.round(p.value).toLocaleString('ro-RO')} RON (${p.percent}%)` 
                },
                color: colorPalette,
                series: [
                    {
                        name: 'Drop Mediu',
                        type: 'pie',
                        radius: ['40%', '70%'],
                        avoidLabelOverlap: true,
                        itemStyle: { borderRadius: 6, borderColor: isDark ? '#0f0f1a' : '#fff', borderWidth: 2 },
                        label: { show: true, formatter: (p) => `${p.name}\n${Math.round(p.value).toLocaleString('ro-RO')} RON`, color: textColor },
                        labelLine: { show: true },
                        data: data,
                        animationType: 'scale',
                        animationEasing: 'elasticOut'
                    }
                ]
            });

            let currentLevel = 1;
            donutChart.setOption(getDonutOption(level1Data, 'Locații\n(Click for Cabinets)'), true);

            donutChart.on('click', async function(params) {
                if (currentLevel === 1 && params.data.loc_id) {
                    donutChart.showLoading({ text: 'Loading...', color: '#eab308', textColor: textColor, maskColor: isDark ? 'rgba(15,15,26,0.8)' : 'rgba(255,255,255,0.8)' });
                    
                    try {
                        const cabData = await api(`/api/cabinets?start=${s}&end=${e}&loc_ids=${params.data.loc_id}`);
                        const level2Data = (cabData || []).map(r => {
                            const totalIn = r.total_in || 0;
                            const machines = r.buc || 1;
                            const avgDrop = totalIn / machines / diffDays;
                            return {
                                name: r.cabinet || 'Necunoscut',
                                value: avgDrop
                            };
                        }).sort((a,b) => b.value - a.value).slice(0, 12);

                        currentLevel = 2;
                        donutChart.hideLoading();
                        donutChart.setOption(getDonutOption(level2Data, params.name + '\n(Click to Back)'), true);
                    } catch (err) {
                        donutChart.hideLoading();
                        console.error(err);
                    }
                } else if (currentLevel === 2) {
                    currentLevel = 1;
                    donutChart.setOption(getDonutOption(level1Data, 'Locații\n(Click for Cabinets)'), true);
                }
            });
        }

        // --- 2. COMBO CHART (BAR + LINE) ---
        const domCombo = document.getElementById('echart-combo');
        if (domCombo) {
            if (!echartsInstances['combo']) echartsInstances['combo'] = echarts.init(domCombo);
            const comboChart = echartsInstances['combo'];
            
            const comboDates = (trendData || []).map(r => r.date || r.zi || '');
            const comboIn = (trendData || []).map(r => r.total_in || 0);
            const comboHold = (trendData || []).map(r => r.hold_pct || 0);

            comboChart.setOption({
                tooltip: { 
                    trigger: 'axis', axisPointer: { type: 'cross' }, backgroundColor: 'rgba(15,15,26,0.9)', textStyle: { color: '#fff' }, borderColor: 'rgba(255,255,255,0.2)',
                    formatter: function(params) {
                        let res = params[0].name + '<br/>';
                        params.forEach(p => {
                            let val = p.seriesName.includes('%') ? Number(p.value).toFixed(2) + '%' : Math.round(p.value).toLocaleString('ro-RO') + ' RON';
                            res += p.marker + ' ' + p.seriesName + ': ' + val + '<br/>';
                        });
                        return res;
                    }
                },
                legend: { data: ['Total IN', 'Hold %'], textStyle: { color: textColor } },
                grid: { left: '5%', right: '5%', bottom: '10%', top: '15%', containLabel: true },
                xAxis: [
                    { type: 'category', data: comboDates, axisPointer: { type: 'shadow' }, axisLabel: { color: textColor }, splitLine: { show: false } }
                ],
                yAxis: [
                    { type: 'value', name: 'RON', axisLabel: { color: textColor, formatter: (val) => Math.round(val).toLocaleString('ro-RO') }, splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } } },
                    { type: 'value', name: 'Procent', min: 0, max: 100, axisLabel: { color: textColor, formatter: '{value} %' }, splitLine: { show: false } }
                ],
                series: [
                    {
                        name: 'Total IN', type: 'bar', barWidth: '40%',
                        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#eab308' }, { offset: 1, color: '#f97316' }]), borderRadius: [6, 6, 0, 0] },
                        data: comboIn
                    },
                    {
                        name: 'Hold %', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 8,
                        itemStyle: { color: '#8b5cf6' }, lineStyle: { width: 3, shadowColor: 'rgba(139, 92, 246, 0.5)', shadowBlur: 10 },
                        data: comboHold
                    }
                ]
            }, true);
        }

        // --- 3. WATERFALL CHART ---
        const domWaterfall = document.getElementById('echart-waterfall');
        if (domWaterfall) {
            if (!echartsInstances['waterfall']) echartsInstances['waterfall'] = echarts.init(domWaterfall);
            const waterfallChart = echartsInstances['waterfall'];

            const totIn = kpiData.total_in || 0;
            const market = (kpiData.jackpot || 0) + (kpiData.hh || 0) + (kpiData.cashback || 0);
            const exp = kpiData.expenses || 0;
            const taxes = kpiData.taxes || 0; // If you have explicit taxes
            const net = kpiData.net_profit || 0;
            
            // Math for waterfall
            // IN - MARKET - EXP - TAXES = NET
            const baseMarket = totIn - market;
            const baseExp = baseMarket - exp;
            const baseTaxes = baseExp - taxes; // Should equal net roughly
            
            const transparentBaseData = [0, baseMarket, baseExp, baseTaxes, 0];
            const visibleBarsData = [totIn, market, exp, taxes, net];

            waterfallChart.setOption({
                tooltip: {
                    trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15,15,26,0.9)', textStyle: { color: '#fff' }, borderColor: 'rgba(255,255,255,0.2)',
                    formatter: function (params) {
                        let tar = params[1]; // The visible bar
                        return tar.name + '<br/>' + tar.seriesName + ' : ' + Math.round(tar.value).toLocaleString('ro-RO') + ' RON';
                    }
                },
                grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
                xAxis: { type: 'category', splitLine: { show: false }, data: ['Total IN', 'Marketing/JP', 'Cheltuieli', 'Taxe', 'Profit Net'], axisLabel: { color: textColor } },
                yAxis: { type: 'value', axisLabel: { color: textColor, formatter: (val) => Math.round(val).toLocaleString('ro-RO') }, splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } } },
                series: [
                    {
                        name: 'Placeholder', type: 'bar', stack: 'Total',
                        itemStyle: { borderColor: 'transparent', color: 'transparent' }, emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
                        data: transparentBaseData
                    },
                    {
                        name: 'Valoare', type: 'bar', stack: 'Total',
                        label: { show: true, position: 'top', color: textColor, formatter: (p) => (p.value/1000).toFixed(0) + 'k' },
                        itemStyle: {
                            color: function(params) {
                                if (params.dataIndex === 0) return '#3b82f6'; // In
                                if (params.dataIndex === 4) return net >= 0 ? '#10b981' : '#ef4444'; // Net
                                return '#ef4444'; // Minus
                            },
                            borderRadius: 4
                        },
                        data: visibleBarsData
                    }
                ]
            }, true);
        }

        // --- 4. TIME-SERIES TIMELINE CHART (ZOOM) ---
        const domTimeline = document.getElementById('echart-timeline');
        if (domTimeline) {
            if (!echartsInstances['timeline']) echartsInstances['timeline'] = echarts.init(domTimeline);
            const timelineChart = echartsInstances['timeline'];

            const tlDates = (timelineData || []).map(r => r.date || r.zi || '');
            const tlGGR = (timelineData || []).map(r => r.ggr || 0);

            timelineChart.setOption({
                tooltip: { 
                    trigger: 'axis', position: function (pt) { return [pt[0], '10%']; }, backgroundColor: 'rgba(15,15,26,0.9)', textStyle: { color: '#fff' }, borderColor: 'rgba(255,255,255,0.2)',
                    formatter: function(params) {
                        let p = params[0];
                        return p.name + '<br/>' + p.marker + ' ' + p.seriesName + ': ' + Math.round(p.value).toLocaleString('ro-RO') + ' RON';
                    }
                },
                title: { left: 'center', text: `Evoluție GGR (90 Zile) ${s90} - ${e}`, textStyle: { color: textColor, fontSize: 13 } },
                grid: { left: '5%', right: '5%', bottom: '20%', top: '20%', containLabel: true },
                xAxis: { type: 'category', boundaryGap: false, data: tlDates, axisLabel: { color: textColor } },
                yAxis: { type: 'value', boundaryGap: [0, '100%'], axisLabel: { color: textColor, formatter: (val) => Math.round(val).toLocaleString('ro-RO') }, splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } } },
                dataZoom: [
                    { type: 'inside', start: 50, end: 100 },
                    { start: 50, end: 100, textStyle: { color: textColor }, borderColor: splitLineColor, fillerColor: 'rgba(234, 179, 8, 0.2)' }
                ],
                series: [
                    {
                        name: 'GGR', type: 'line', symbol: 'none', sampling: 'lttb', itemStyle: { color: '#eab308' },
                        areaStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: 'rgba(234,179,8,0.8)' },
                                { offset: 1, color: 'rgba(234,179,8,0)' }
                            ])
                        },
                        data: tlGGR
                    }
                ]
            }, true);
        }
        
        // Force a resize immediately after init
        setTimeout(() => {
            Object.values(echartsInstances).forEach(chart => {
                if(chart) chart.resize();
            });
        }, 100);

    } catch (e) {
        console.error("[Dashboard2] Initialization error:", e);
        const errDiv = document.getElementById('echart-donut');
        if (errDiv) errDiv.innerHTML = `<div style="color:red; padding:20px;">Error initializing Dashboard 2:<br>${e.message}</div>`;
    }
}

// Ensure charts resize correctly
window.addEventListener('resize', function() {
    Object.values(echartsInstances).forEach(chart => {
        if(chart) chart.resize();
    });
});

// Extindem funcția originală de date-change (dacă există) pentru a da refresh la grafice
const originalApplyPeriod = typeof window.applyPeriod === 'function' ? window.applyPeriod : null;
if (originalApplyPeriod) {
    window.applyPeriod = function(p) {
        originalApplyPeriod(p);
        if (window.location.hash.includes('dashboard2')) {
            initDashboard2();
        }
    };
}

// Hook into the existing app's hash routing
window.addEventListener('hashchange', () => {
    const fullHash = window.location.hash;
    const rawHash = (fullHash.split('?')[0]).replace('#', '') || 'dashboard';
    const mainHash = rawHash.split('/')[0];
    
    if (mainHash === 'dashboard2') {
        const kpi = document.getElementById('kpi-section');
        if (kpi) kpi.style.display = 'none';
        
        setTimeout(() => {
            initDashboard2();
        }, 100);
    }
});

// If loaded directly on #dashboard2
if (window.location.hash.includes('dashboard2')) {
    const kpi = document.getElementById('kpi-section');
    if (kpi) kpi.style.display = 'none';

    setTimeout(() => {
        initDashboard2();
    }, 500);
}
