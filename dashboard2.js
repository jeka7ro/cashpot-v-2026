// dashboard2.js - ECharts implementation cu Cross-Filtering
let echartsInstances = {};
let currentLocId = null;
let currentDate = null;
let currentDonutLevel = 1;
let currentLevel1Data = []; // stocăm pentru reset

function getCommonColors() {
    const isDark = document.body.classList.contains('dark') || getComputedStyle(document.body).getPropertyValue('--bg').trim() === '#0f0f1a';
    return {
        textColor: isDark ? '#e2e8f0' : '#1e293b',
        splitLineColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        colorPalette: ['#eab308', '#f97316', '#ef4444', '#8b5cf6', '#3b82f6', '#10b981', '#14b8a6', '#f43f5e'],
        isDark
    };
}

const getDonutOption = (data, titleText, colors) => ({
    title: { text: titleText, left: 'center', top: 'center', textStyle: { color: colors.textColor, fontSize: 13, fontWeight: 'bold' } },
    tooltip: { 
        trigger: 'item', backgroundColor: 'rgba(15,15,26,0.9)', textStyle: { color: '#fff' }, borderWidth: 1, borderColor: '#eab308', 
        formatter: (p) => `${p.name}: ${Math.round(p.value).toLocaleString('ro-RO')} RON (${p.percent}%)` 
    },
    color: colors.colorPalette,
    series: [
        {
            name: 'Drop Mediu', type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: true,
            itemStyle: { borderRadius: 6, borderColor: colors.isDark ? '#0f0f1a' : '#fff', borderWidth: 2 },
            label: { show: true, formatter: (p) => `${p.name}\n${Math.round(p.value).toLocaleString('ro-RO')} RON`, color: colors.textColor },
            labelLine: { show: true },
            data: data, animationType: 'scale', animationEasing: 'elasticOut'
        }
    ]
});

async function fetchAndRenderDonut(dateFilter) {
    const domDonut = document.getElementById('echart-donut');
    if (!domDonut) return;
    if (!echartsInstances['donut']) echartsInstances['donut'] = echarts.init(domDonut);
    const donutChart = echartsInstances['donut'];
    const colors = getCommonColors();

    const { s, e } = getPeriod();
    const sFilter = dateFilter || s;
    const eFilter = dateFilter || e;
    const locP = typeof locParam === 'function' ? locParam() : '';

    let diffDays = 1;
    if (sFilter && eFilter) {
        const sDate = new Date(sFilter);
        const eDate = new Date(eFilter);
        diffDays = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1);
    }

    try {
        donutChart.showLoading({ text: 'Loading...', color: '#eab308', textColor: colors.textColor, maskColor: colors.isDark ? 'rgba(15,15,26,0.8)' : 'rgba(255,255,255,0.8)' });
        const locData = await api(`/api/locations?start=${sFilter}&end=${eFilter}${locP}`);
        
        currentLevel1Data = (locData || []).map(r => {
            const totalIn = r.total_in || 0;
            const machines = r.buc || 1; 
            const avgDrop = totalIn / machines / diffDays;
            return {
                name: r.locatie || 'Necunoscut',
                value: Math.round(avgDrop),
                loc_id: r.id,
                machines: machines,
                diffDays: diffDays
            };
        }).sort((a,b) => b.value - a.value).slice(0, 10);

        currentDonutLevel = 1;
        donutChart.hideLoading();
        
        let title = dateFilter ? `Locații\n(${dateFilter})` : 'Locații\n(Click for Cabinets)';
        donutChart.setOption(getDonutOption(currentLevel1Data, title, colors), true);

        donutChart.off('click');
        donutChart.on('click', async function(params) {
            if (currentDonutLevel === 1 && params.data.loc_id) {
                currentLocId = params.data.loc_id;
                currentDonutLevel = 2;
                donutChart.showLoading({ text: 'Loading Cabinets...', color: '#eab308', textColor: colors.textColor, maskColor: colors.isDark ? 'rgba(15,15,26,0.8)' : 'rgba(255,255,255,0.8)' });
                
                try {
                    const cabData = await api(`/api/cabinets?start=${sFilter}&end=${eFilter}&loc_ids=${currentLocId}`);
                    const level2Data = (cabData || []).map(r => {
                        const totalIn = r.total_in || 0;
                        const machines = r.buc || 1;
                        const avgDrop = totalIn / machines / params.data.diffDays;
                        return {
                            name: r.cabinet || 'Necunoscut',
                            value: Math.round(avgDrop)
                        };
                    }).sort((a,b) => b.value - a.value).slice(0, 12);
                    
                    donutChart.hideLoading();
                    donutChart.setOption(getDonutOption(level2Data, params.name + '\n(Click to Back)', colors), true);
                    
                    // Cross-filter celelalte grafice
                    fetchAndRenderSecondary(currentLocId, currentDate);
                } catch (e) {
                    donutChart.hideLoading();
                    console.error(e);
                }
            } else if (currentDonutLevel === 2) {
                currentLocId = null;
                currentDonutLevel = 1;
                let title = dateFilter ? `Locații\n(${dateFilter})` : 'Locații\n(Click for Cabinets)';
                donutChart.setOption(getDonutOption(currentLevel1Data, title, colors), true);
                
                // Cross-filter reset
                fetchAndRenderSecondary(currentLocId, currentDate);
            }
        });
    } catch (e) {
        console.error(e);
        donutChart.hideLoading();
    }
}

async function fetchAndRenderSecondary(locId, dateFilter) {
    const colors = getCommonColors();
    const { s, e } = getPeriod();
    const sFilter = dateFilter || s;
    const eFilter = dateFilter || e;
    
    let locPFilter = typeof locParam === 'function' ? locParam() : '';
    if (locId) {
        locPFilter = `&loc_ids=${locId}`;
    }

    let dEnd = new Date(eFilter);
    let d90Start = new Date(dEnd);
    d90Start.setDate(d90Start.getDate() - 90);
    let s90 = d90Start.toISOString().split('T')[0];

    const [kpiData, trendData, timelineData, expData] = await Promise.all([
        api(`/api/kpi?start=${sFilter}&end=${eFilter}${locPFilter}`),
        api(`/api/daily?res=day&start=${sFilter}&end=${eFilter}${locPFilter}`),
        api(`/api/daily?res=day&start=${s90}&end=${eFilter}${locPFilter}`),
        api(`/api/reports/expenses?start=${sFilter}&end=${eFilter}${locPFilter}`)
    ]);

    // --- 2. COMBO CHART ---
    const domCombo = document.getElementById('echart-combo');
    if (domCombo) {
        if (!echartsInstances['combo']) echartsInstances['combo'] = echarts.init(domCombo);
        const comboChart = echartsInstances['combo'];
        
        const comboDates = (trendData || []).map(r => r.date || r.zi || '');
        const comboIn = (trendData || []).map(r => Math.round(r.total_in || 0));
        const comboHold = (trendData || []).map(r => Number((r.hold_pct || 0).toFixed(2)));

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
            legend: { data: ['Total IN', 'Hold %'], textStyle: { color: colors.textColor } },
            grid: { left: '5%', right: '5%', bottom: '10%', top: '15%', containLabel: true },
            xAxis: [
                { type: 'category', data: comboDates, axisPointer: { type: 'shadow' }, axisLabel: { color: colors.textColor }, splitLine: { show: false } }
            ],
            yAxis: [
                { type: 'value', name: 'RON', axisLabel: { color: colors.textColor, formatter: (val) => Math.round(val).toLocaleString('ro-RO') }, splitLine: { lineStyle: { color: colors.splitLineColor, type: 'dashed' } } },
                { type: 'value', name: 'Procent', min: 0, max: 100, axisLabel: { color: colors.textColor, formatter: '{value} %' }, splitLine: { show: false } }
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
        
        // Cross-filter logic for Combo
        comboChart.off('click');
        comboChart.on('click', function(params) {
            const clickedDate = params.name;
            if (currentDate === clickedDate) {
                currentDate = null; // deselect
            } else {
                currentDate = clickedDate;
            }
            // Update other charts
            fetchAndRenderDonut(currentDate);
            fetchAndRenderSecondary(currentLocId, currentDate);
        });
    }

    // --- 3. WATERFALL CHART ---
    const domWaterfall = document.getElementById('echart-waterfall');
    if (domWaterfall) {
        if (!echartsInstances['waterfall']) echartsInstances['waterfall'] = echarts.init(domWaterfall);
        const waterfallChart = echartsInstances['waterfall'];

        const totIn = kpiData.total_in || 0;
        const market = (kpiData.jackpot || 0) + (kpiData.hh || 0) + (kpiData.cashback || 0);
        const exp = kpiData.expenses || 0;
        const taxes = kpiData.taxes || 0;
        const net = kpiData.net_profit || 0;
        
        const baseMarket = totIn - market;
        const baseExp = baseMarket - exp;
        const baseTaxes = baseExp - taxes;
        
        const transparentBaseData = [0, baseMarket, baseExp, baseTaxes, 0];
        const visibleBarsData = [totIn, market, exp, taxes, net];

        waterfallChart.setOption({
            title: { text: dateFilter ? `Analiză Profit (${dateFilter})` : '', textStyle: { color: colors.textColor, fontSize: 13 }, top: 0, left: 'center' },
            tooltip: {
                trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15,15,26,0.9)', textStyle: { color: '#fff' }, borderColor: 'rgba(255,255,255,0.2)',
                formatter: function (params) {
                    let tar = params[1]; 
                    return tar.name + '<br/>' + tar.seriesName + ' : ' + Math.round(tar.value).toLocaleString('ro-RO') + ' RON';
                }
            },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
            xAxis: { type: 'category', splitLine: { show: false }, data: ['Total IN', 'Marketing/JP', 'Cheltuieli', 'Taxe', 'Profit Net'], axisLabel: { color: colors.textColor } },
            yAxis: { type: 'value', axisLabel: { color: colors.textColor, formatter: (val) => Math.round(val).toLocaleString('ro-RO') }, splitLine: { lineStyle: { color: colors.splitLineColor, type: 'dashed' } } },
            series: [
                {
                    name: 'Placeholder', type: 'bar', stack: 'Total',
                    itemStyle: { borderColor: 'transparent', color: 'transparent' }, emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
                    data: transparentBaseData
                },
                {
                    name: 'Valoare', type: 'bar', stack: 'Total',
                    label: { show: true, position: 'top', color: colors.textColor, formatter: (p) => (p.value/1000).toFixed(0) + 'k' },
                    itemStyle: {
                        color: function(params) {
                            if (params.dataIndex === 0) return '#3b82f6';
                            if (params.dataIndex === 4) return net >= 0 ? '#10b981' : '#ef4444';
                            return '#ef4444';
                        },
                        borderRadius: 4
                    },
                    data: visibleBarsData
                }
            ]
        }, true);
    }

    // --- 4. TIMELINE CHART ---
    const domTimeline = document.getElementById('echart-timeline');
    if (domTimeline) {
        if (!echartsInstances['timeline']) echartsInstances['timeline'] = echarts.init(domTimeline);
        const timelineChart = echartsInstances['timeline'];

        const tlDates = (timelineData || []).map(r => r.date || r.zi || '');
        const tlGGR = (timelineData || []).map(r => Math.round(r.ggr || 0));

        let tlTitle = `Evoluție GGR (90 Zile) ${s90} - ${eFilter}`;
        if (locId) {
            const activeLoc = currentLevel1Data.find(l => l.loc_id == locId);
            if (activeLoc) tlTitle += ` - ${activeLoc.name}`;
        }

        timelineChart.setOption({
            tooltip: { 
                trigger: 'axis', position: function (pt) { return [pt[0], '10%']; }, backgroundColor: 'rgba(15,15,26,0.9)', textStyle: { color: '#fff' }, borderColor: 'rgba(255,255,255,0.2)',
                formatter: function(params) {
                    let p = params[0];
                    return p.name + '<br/>' + p.marker + ' ' + p.seriesName + ': ' + Math.round(p.value).toLocaleString('ro-RO') + ' RON';
                }
            },
            title: { left: 'center', text: tlTitle, textStyle: { color: colors.textColor, fontSize: 13 } },
            grid: { left: '5%', right: '5%', bottom: '20%', top: '20%', containLabel: true },
            xAxis: { type: 'category', boundaryGap: false, data: tlDates, axisLabel: { color: colors.textColor } },
            yAxis: { type: 'value', boundaryGap: [0, '100%'], axisLabel: { color: colors.textColor, formatter: (val) => Math.round(val).toLocaleString('ro-RO') }, splitLine: { lineStyle: { color: colors.splitLineColor, type: 'dashed' } } },
            dataZoom: [
                { type: 'inside', start: 50, end: 100 },
                { start: 50, end: 100, textStyle: { color: colors.textColor }, borderColor: colors.splitLineColor, fillerColor: 'rgba(234, 179, 8, 0.2)' }
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

        // Click pe timeline filtreaza dupa data (la fel ca la combo)
        timelineChart.off('click');
        timelineChart.on('click', function(params) {
            const clickedDate = params.name;
            if (currentDate === clickedDate) {
                currentDate = null;
            } else {
                currentDate = clickedDate;
            }
            fetchAndRenderDonut(currentDate);
            fetchAndRenderSecondary(currentLocId, currentDate);
        });
    }

    // --- 5. EXPENSES BY DEPARTMENT ---
    const domExpDep = document.getElementById('echart-exp-dep');
    if (domExpDep) {
        if (!echartsInstances['exp-dep']) echartsInstances['exp-dep'] = echarts.init(domExpDep);
        const expDepChart = echartsInstances['exp-dep'];

        const depMap = {};
        (expData || []).forEach(r => {
            if (!r.is_hidden) {
                const d = r.department_name || 'Necunoscut';
                depMap[d] = (depMap[d] || 0) + (parseFloat(r.amount) || 0);
            }
        });
        const depChartData = Object.keys(depMap).map(k => ({ name: k, value: Math.round(depMap[k]) })).sort((a,b) => b.value - a.value).slice(0, 15);

        expDepChart.setOption({
            tooltip: { trigger: 'item', backgroundColor: 'rgba(15,15,26,0.9)', textStyle: { color: '#fff' }, borderColor: '#f97316', formatter: (p) => `${p.name}: ${Math.round(p.value).toLocaleString('ro-RO')} RON (${p.percent}%)` },
            color: colors.colorPalette,
            series: [{
                name: 'Cheltuieli Dep', type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: true,
                itemStyle: { borderRadius: 6, borderColor: colors.isDark ? '#0f0f1a' : '#fff', borderWidth: 2 },
                label: { show: true, formatter: (p) => `${p.name}\n${Math.round(p.value).toLocaleString('ro-RO')} RON`, color: colors.textColor },
                data: depChartData, animationType: 'scale', animationEasing: 'elasticOut'
            }]
        }, true);
    }

    // --- 6. EXPENSES BY LOCATION ---
    const domExpLoc = document.getElementById('echart-exp-loc');
    if (domExpLoc) {
        if (!echartsInstances['exp-loc']) echartsInstances['exp-loc'] = echarts.init(domExpLoc);
        const expLocChart = echartsInstances['exp-loc'];

        const locMap = {};
        (expData || []).forEach(r => {
            if (!r.is_hidden) {
                const l = r.location_name || 'Central / Necunoscut';
                locMap[l] = (locMap[l] || 0) + (parseFloat(r.amount) || 0);
            }
        });
        const locChartData = Object.keys(locMap).map(k => ({ name: k, value: Math.round(locMap[k]) })).sort((a,b) => b.value - a.value).slice(0, 15);

        expLocChart.setOption({
            tooltip: { trigger: 'item', backgroundColor: 'rgba(15,15,26,0.9)', textStyle: { color: '#fff' }, borderColor: '#3b82f6', formatter: (p) => `${p.name}: ${Math.round(p.value).toLocaleString('ro-RO')} RON (${p.percent}%)` },
            color: colors.colorPalette.slice(2).concat(colors.colorPalette.slice(0,2)),
            series: [{
                name: 'Cheltuieli Loc', type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: true,
                itemStyle: { borderRadius: 6, borderColor: colors.isDark ? '#0f0f1a' : '#fff', borderWidth: 2 },
                label: { show: true, formatter: (p) => `${p.name}\n${Math.round(p.value).toLocaleString('ro-RO')} RON`, color: colors.textColor },
                data: locChartData, animationType: 'scale', animationEasing: 'elasticOut'
            }]
        }, true);
    }
}

async function initDashboard2() {
    console.log("[Dashboard2] initDashboard2 called");
    currentLocId = null;
    currentDate = null;
    currentDonutLevel = 1;

    try {
        if (typeof echarts === 'undefined') throw new Error("ECharts missing");
        
        await Promise.all([
            fetchAndRenderDonut(null),
            fetchAndRenderSecondary(null, null)
        ]);
        
        setTimeout(() => {
            Object.values(echartsInstances).forEach(chart => {
                if(chart) chart.resize();
            });
        }, 100);
    } catch (e) {
        console.error(e);
    }
}

window.addEventListener('resize', function() {
    Object.values(echartsInstances).forEach(chart => {
        if(chart) chart.resize();
    });
});

const originalApplyPeriod = typeof window.applyPeriod === 'function' ? window.applyPeriod : null;
if (originalApplyPeriod) {
    window.applyPeriod = function(p) {
        originalApplyPeriod(p);
        if (window.location.hash.includes('dashboard2')) {
            initDashboard2();
        }
    };
}

window.addEventListener('hashchange', () => {
    const fullHash = window.location.hash;
    const rawHash = (fullHash.split('?')[0]).replace('#', '') || 'dashboard';
    const mainHash = rawHash.split('/')[0];
    
    if (mainHash === 'dashboard2') {
        const kpi = document.getElementById('kpi-section');
        if (kpi) kpi.style.display = 'none';
        
        setTimeout(() => { initDashboard2(); }, 100);
    }
});

if (window.location.hash.includes('dashboard2')) {
    const kpi = document.getElementById('kpi-section');
    if (kpi) kpi.style.display = 'none';
    setTimeout(() => { initDashboard2(); }, 500);
}
