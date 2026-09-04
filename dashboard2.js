// dashboard2.js - ECharts implementation cu Cross-Filtering
let echartsInstances = {};
try {
    window.chartDateOverrides = JSON.parse(localStorage.getItem('chartDateOverrides')) || {};
} catch(e) {
    window.chartDateOverrides = {};
}
let currentLocId = null;
let currentDate = null;
let currentDonutLevel = 1;
let currentLevel1Data = []; // stocăm pentru reset

function getCommonColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
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

async function fetchAndRenderSecondary(locId, dateFilter, targetChartId = null) {
    if (targetChartId && window.echartsInstances[targetChartId]) window.echartsInstances[targetChartId].showLoading({text: "Se descarcă datele...", color: "#3b82f6", textColor: "#fff", maskColor: "rgba(15, 15, 26, 0.8)"});
    const colors = getCommonColors();
    const { s, e } = getPeriod();
    let sFilter = dateFilter || s;
    let eFilter = dateFilter || e;
    
    if (!eFilter) eFilter = new Date().toISOString().split('T')[0];
    if (!sFilter) {
        let d = new Date(eFilter);
        d.setDate(1);
        sFilter = d.toISOString().split('T')[0];
    }
    
    let locPFilter = typeof locParam === 'function' ? locParam() : '';
    if (locId) {
        locPFilter = `&loc_ids=${locId}`;
    }

    let dEnd = new Date(eFilter);
    let d90Start = new Date(dEnd);
    d90Start.setDate(d90Start.getDate() - 90);
    let s90 = d90Start.toISOString().split('T')[0];

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

    window._latestRawData = { kpiData, trendData, timelineData, expData, locsData, cabsData, provsData, hourlyData };

    // --- 2. COMBO CHART ---
    const domCombo = document.getElementById('echart-combo');
    if (domCombo && (!window.chartDateOverrides['echart-combo'] || targetChartId === 'echart-combo')) {
        if (!echartsInstances['combo']) echartsInstances['combo'] = echarts.init(domCombo);
        const comboChart = echartsInstances['combo'];
        
        const comboDates = (trendData || []).map(r => r.date || r.zi || '');
        const comboIn = (trendData || []).map(r => Math.round(r.total_in || 0));
        const comboHold = (trendData || []).map(r => r.total_in ? Number(((r.ggr / r.total_in) * 100).toFixed(2)) : 0);

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
    if (domWaterfall && (!window.chartDateOverrides['echart-waterfall'] || targetChartId === 'echart-waterfall')) {
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
            xAxis: { 
                type: 'category', 
                splitLine: { show: false }, 
                data: ['Total IN', 'Marketing/JP', 'Cheltuieli', 'Taxe', 'Profit Net'], 
                axisLabel: { color: colors.textColor, interval: 0, fontSize: 11, width: 80, overflow: 'break' } 
            },
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

    // --- 1. TOP & BOTTOM SĂLI ---
    if (document.getElementById('echart-top-loc') && locsData && (!window.chartDateOverrides['echart-top-loc'] || targetChartId === 'echart-top-loc' || targetChartId === 'echart-bot-loc')) {
        let locsSorted = [...locsData].filter(l => l.ggr !== null).sort((a,b) => b.ggr - a.ggr);
        let top10 = locsSorted.slice(0, 10).reverse();
        let bot10 = locsSorted.slice(-10);

        if (!echartsInstances['top-loc']) echartsInstances['top-loc'] = echarts.init(document.getElementById('echart-top-loc'));
        echartsInstances['top-loc'].setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => `${p[0].name}<br/>GGR: ${Math.round(p[0].value).toLocaleString('ro-RO')} RON` },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
            xAxis: { type: 'value', axisLabel: { color: colors.textColor } },
            yAxis: { type: 'category', data: top10.map(l => l.locatie || l.location), axisLabel: { color: colors.textColor, width: 100, overflow: 'truncate' } },
            series: [{ type: 'bar', data: top10.map(l => l.ggr), itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] } }]
        }, true);

        if (!echartsInstances['bot-loc']) echartsInstances['bot-loc'] = echarts.init(document.getElementById('echart-bot-loc'));
        echartsInstances['bot-loc'].setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => `${p[0].name}<br/>GGR: ${Math.round(p[0].value).toLocaleString('ro-RO')} RON` },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
            xAxis: { type: 'value', axisLabel: { color: colors.textColor } },
            yAxis: { type: 'category', data: bot10.map(l => l.locatie || l.location), axisLabel: { color: colors.textColor, width: 100, overflow: 'truncate' } },
            series: [{ type: 'bar', data: bot10.map(l => l.ggr), itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] } }]
        }, true);
    }

    // --- 3. SCATTER GGR vs CHELTUIELI ---
    if (document.getElementById('echart-scatter-loc') && locsData && (!window.chartDateOverrides['echart-scatter-loc'] || targetChartId === 'echart-scatter-loc')) {
        let scatterData = locsData.filter(l => l.ggr !== null && l.location).map(l => {
            let exp = 0;
            if (expData) {
                let normL = (l.locatie || l.location || '').toLowerCase();
                expData.forEach(e => {
                    if (!e.is_hidden && e.location_name && e.location_name.toLowerCase() === normL) {
                        exp += parseFloat(e.amount) || 0;
                    }
                });
            }
            return [exp, l.ggr, l.total_in, l.locatie || l.location]; // x, y, size, name
        });
        
        if (!echartsInstances['scatter-loc']) echartsInstances['scatter-loc'] = echarts.init(document.getElementById('echart-scatter-loc'));
        echartsInstances['scatter-loc'].setOption({
            tooltip: { 
                formatter: function (p) { return `${p.value[3]}<br/>Exp: ${Math.round(p.value[0]).toLocaleString('ro-RO')}<br/>GGR: ${Math.round(p.value[1]).toLocaleString('ro-RO')}<br/>Drop: ${Math.round(p.value[2]).toLocaleString('ro-RO')}`; }
            },
            grid: { left: '5%', right: '5%', bottom: '10%', top: '5%', containLabel: true },
            xAxis: { name: 'Cheltuieli (RON)', nameLocation: 'middle', nameGap: 30, type: 'value', axisLabel: { color: colors.textColor }, splitLine: { lineStyle: { color: colors.splitLineColor } } },
            yAxis: { name: 'GGR (RON)', type: 'value', axisLabel: { color: colors.textColor }, splitLine: { lineStyle: { color: colors.splitLineColor } } },
            series: [{
                type: 'scatter', data: scatterData,
                symbolSize: function (data) { return Math.max(10, Math.min(50, Math.sqrt(data[2]) / 20)); },
                itemStyle: { color: '#3b82f6', opacity: 0.7, borderColor: '#60a5fa', borderWidth: 1 }
            }]
        }, true);
    }

    // --- 4. CABINETE & 5. PROVIDERI ---
    if (document.getElementById('echart-cab') && cabsData && (!window.chartDateOverrides['echart-cab'] || targetChartId === 'echart-cab')) {
        let cabChartData = cabsData.slice(0,10).map(c => ({ name: c.cabinet, value: Math.round(c.ggr) }));
        if (!echartsInstances['cab']) echartsInstances['cab'] = echarts.init(document.getElementById('echart-cab'));
        echartsInstances['cab'].setOption({
            tooltip: { trigger: 'item' }, color: colors.colorPalette,
            legend: { type: 'scroll', orient: 'vertical', right: '5%', top: 'middle', textStyle: { color: colors.textColor, fontSize: 11 }, formatter: (name) => { let v = cabChartData.find(d=>d.name===name); return name + ' ' + (v?v.value.toLocaleString('ro-RO'):''); } },
            series: [{ type: 'pie', radius: '65%', center: ['35%', '50%'], data: cabChartData, label: { show: false } }]
        }, true);
    }
    if (document.getElementById('echart-prov') && provsData && (!window.chartDateOverrides['echart-prov'] || targetChartId === 'echart-prov')) {
        let provChartData = provsData.map(p => ({ name: p.provider, value: Math.round(p.total_in) }));
        if (!echartsInstances['prov']) echartsInstances['prov'] = echarts.init(document.getElementById('echart-prov'));
        echartsInstances['prov'].setOption({
            tooltip: { trigger: 'item' }, color: colors.colorPalette.slice(3).concat(colors.colorPalette),
            legend: { type: 'scroll', orient: 'vertical', right: '5%', top: 'middle', textStyle: { color: colors.textColor, fontSize: 11 }, formatter: (name) => { let v = provChartData.find(d=>d.name===name); return name + ' ' + (v?v.value.toLocaleString('ro-RO'):''); } },
            series: [{ type: 'pie', radius: ['40%', '70%'], center: ['35%', '50%'], data: provChartData, label: { show: false } }]
        }, true);
    }

    // --- 6. CALENDAR HEATMAP ---
    if (document.getElementById('echart-cal') && trendData && (!window.chartDateOverrides['echart-cal'] || targetChartId === 'echart-cal')) {
        let calData = trendData.map(t => [t.date || t.zi, Math.round(t.total_in || 0)]);
        let year = trendData.length ? (trendData[0].date || trendData[0].zi || String(new Date().getFullYear())).substring(0,4) : new Date().getFullYear();
        if (!echartsInstances['cal']) echartsInstances['cal'] = echarts.init(document.getElementById('echart-cal'));
        echartsInstances['cal'].setOption({
            tooltip: { position: 'top', formatter: (p) => `${p.value[0]}: ${p.value[1].toLocaleString('ro-RO')} RON` },
            visualMap: { min: 0, max: Math.max(1, ...calData.map(d=>d[1])), type: 'piecewise', orient: 'horizontal', left: 'center', top: 0, textStyle: { color: colors.textColor }, inRange: { color: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] } },
            calendar: { top: 60, left: 30, right: 30, range: year, itemStyle: { borderWidth: 1, borderColor: colors.isDark ? '#1a1a2e' : '#fff' }, dayLabel: { color: colors.textColor }, monthLabel: { color: colors.textColor }, yearLabel: { show: false } },
            series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: calData }]
        }, true);
    }

    // --- 7. HOURLY HEATMAP ---
    if (document.getElementById('echart-hourly') && hourlyData && hourlyData.length && (!window.chartDateOverrides['echart-hourly'] || targetChartId === 'echart-hourly')) {
        // Group by DayOfWeek (0-6, Mon-Sun) and Hour (0-23)
        let matrix = Array(7).fill(0).map(() => Array(24).fill(0));
        hourlyData.forEach(r => {
            let d = new Date(r.dt);
            let day = (d.getDay() + 6) % 7; // Mon=0, Sun=6
            let hr = d.getHours();
            matrix[day][hr] += parseFloat(r.in) || 0;
        });
        let heatData = [];
        for(let d=0; d<7; d++) for(let h=0; h<24; h++) heatData.push([h, d, Math.round(matrix[d][h])]);
        
        let days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
        let hours = Array(24).fill(0).map((_,i) => i+'h');
        
        if (!echartsInstances['hourly']) echartsInstances['hourly'] = echarts.init(document.getElementById('echart-hourly'));
        echartsInstances['hourly'].setOption({
            tooltip: { position: 'top', formatter: (p) => `Total IN<br/>${days[p.value[1]]} ${hours[p.value[0]]}: ${p.value[2].toLocaleString('ro-RO')} RON` },
            grid: { left: '5%', right: '2%', bottom: '5%', top: '5%', containLabel: true },
            xAxis: { type: 'category', data: hours, axisLabel: { color: colors.textColor, interval: 2 } },
            yAxis: { type: 'category', data: days, axisLabel: { color: colors.textColor } },
            visualMap: { min: 0, max: Math.max(1, ...heatData.map(d=>d[2])), show: false, inRange: { color: ['#10b98122', '#10b981', '#047857'] } },
            series: [{ type: 'heatmap', data: heatData, label: { show: false }, itemStyle: { borderColor: colors.isDark ? '#0f0f1a' : '#fff', borderWidth: 1 } }]
        }, true);
    }

    // --- 8. RADAR ZILE (Now Bar Chart) ---
    if (document.getElementById('echart-radar') && trendData && (!window.chartDateOverrides['echart-radar'] || targetChartId === 'echart-radar')) {
        let daysRaw = [
            { name: 'Luni', ggr: 0, bet: 0, count: 0 },
            { name: 'Marți', ggr: 0, bet: 0, count: 0 },
            { name: 'Miercuri', ggr: 0, bet: 0, count: 0 },
            { name: 'Joi', ggr: 0, bet: 0, count: 0 },
            { name: 'Vineri', ggr: 0, bet: 0, count: 0 },
            { name: 'Sâmbătă', ggr: 0, bet: 0, count: 0 },
            { name: 'Duminică', ggr: 0, bet: 0, count: 0 }
        ];
        
        trendData.forEach(t => {
            let day = (new Date(t.date || t.zi).getDay() + 6) % 7;
            daysRaw[day].ggr += parseFloat(t.ggr) || 0;
            daysRaw[day].bet += parseFloat(t.total_in) || 0;
            daysRaw[day].count++;
        });
        
        daysRaw.forEach(d => {
            d.avgGgr = d.count ? Math.round(d.ggr / d.count) : 0;
            d.avgBet = d.count ? Math.round(d.bet / d.count) : 0;
        });
        
        // Sort descending by BET
        daysRaw.sort((a, b) => b.avgBet - a.avgBet);
        
        let categories = daysRaw.map(d => d.name);
        let dataBET = daysRaw.map(d => d.avgBet);
        let dataGGR = daysRaw.map(d => d.avgGgr);

        if (!echartsInstances['radar']) echartsInstances['radar'] = echarts.init(document.getElementById('echart-radar'));
        echartsInstances['radar'].setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function(params) {
                let res = params[0].name + '<br/>';
                params.forEach(p => {
                    res += p.marker + ' ' + p.seriesName + ': ' + p.value.toLocaleString('ro-RO') + ' RON<br/>';
                });
                return res;
            } },
            legend: { data: ['Medie BET', 'Medie GGR'], textStyle: { color: colors.textColor } },
            grid: { left: '5%', right: '5%', bottom: '5%', top: '15%', containLabel: true },
            xAxis: [{ type: 'category', data: categories, axisLabel: { color: colors.textColor } }],
            yAxis: [{ type: 'value', axisLabel: { color: colors.textColor, formatter: (v) => (v/1000).toFixed(0) + 'k' }, splitLine: { show: false } }],
            series: [
                { name: 'Medie BET', type: 'bar', data: dataBET, itemStyle: { color: '#10b981', borderRadius: 4 } },
                { name: 'Medie GGR', type: 'bar', data: dataGGR, itemStyle: { color: '#3b82f6', borderRadius: 4 } }
            ]
        }, true);
    }

    // --- 9. RTP VS HOLD ---
    if (document.getElementById('echart-rtp') && trendData && (!window.chartDateOverrides['echart-rtp'] || targetChartId === 'echart-rtp')) {
        let rtpData = trendData.map(t => [t.date || t.zi, t.total_in ? Math.round((t.total_out / t.total_in)*1000)/10 : 0]);
        let holdData = trendData.map(t => [t.date || t.zi, t.total_in ? Math.round((t.ggr / t.total_in)*1000)/10 : 0]);
        
        if (!echartsInstances['rtp']) echartsInstances['rtp'] = echarts.init(document.getElementById('echart-rtp'));
        echartsInstances['rtp'].setOption({
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '5%', top: '15%', containLabel: true },
            legend: { data: ['RTP %', 'Hold %'], textStyle: { color: colors.textColor } },
            xAxis: { type: 'category', data: trendData.map(t=>(t.date || t.zi || '').substring(5)), axisLabel: { color: colors.textColor } },
            yAxis: { type: 'value', axisLabel: { color: colors.textColor, formatter: '{value}%' }, splitLine: { lineStyle: { color: colors.splitLineColor } } },
            series: [
                { name: 'RTP %', type: 'line', smooth: true, data: rtpData.map(d=>d[1]), itemStyle: { color: '#ef4444' } },
                { name: 'Hold %', type: 'line', smooth: true, data: holdData.map(d=>d[1]), itemStyle: { color: '#10b981' } }
            ]
        }, true);
    }

    // --- 10. IMPACT MARKETING ---
    if (document.getElementById('echart-jackpot') && trendData && (!window.chartDateOverrides['echart-jackpot'] || targetChartId === 'echart-jackpot')) {
        let dates = trendData.map(t => (t.date || t.zi || '').substring(5));
        let ggrSeries = trendData.map(t => Math.round(t.ggr));
        let mktSeries = trendData.map(t => Math.round(t.marketing || 0));
        let taxSeries = trendData.map(t => Math.round((t.ggr || 0) * 0.1)); // Approximation if no taxes API
        
        if (!echartsInstances['jackpot']) echartsInstances['jackpot'] = echarts.init(document.getElementById('echart-jackpot'));
        echartsInstances['jackpot'].setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } } },
            grid: { left: '3%', right: '4%', bottom: '5%', top: '15%', containLabel: true },
            legend: { data: ['GGR', 'Marketing', 'Taxe Estimative'], textStyle: { color: colors.textColor } },
            xAxis: { type: 'category', boundaryGap: false, data: dates, axisLabel: { color: colors.textColor } },
            yAxis: { type: 'value', axisLabel: { color: colors.textColor }, splitLine: { lineStyle: { color: colors.splitLineColor } } },
            series: [
                { name: 'Marketing', type: 'line', stack: 'Total', areaStyle: {}, emphasis: { focus: 'series' }, data: mktSeries, itemStyle: { color: '#eab308' } },
                { name: 'Taxe Estimative', type: 'line', stack: 'Total', areaStyle: {}, emphasis: { focus: 'series' }, data: taxSeries, itemStyle: { color: '#ef4444' } },
                { name: 'GGR', type: 'line', stack: 'Total', areaStyle: {}, emphasis: { focus: 'series' }, data: ggrSeries, itemStyle: { color: '#10b981' } }
            ]
        }, true);
    }



    // --- 4. TIMELINE CHART ---
    const domTimeline = document.getElementById('echart-timeline');
    if (domTimeline && (!window.chartDateOverrides['echart-timeline'] || targetChartId === 'echart-timeline')) {
        if (!echartsInstances['timeline']) echartsInstances['timeline'] = echarts.init(domTimeline);
        const timelineChart = echartsInstances['timeline'];

        const tlDates = (timelineData || []).map(r => r.date || r.zi || '');
        const tlGGR = (timelineData || []).map(r => Math.round(r.ggr || 0));
        const tlBET = (timelineData || []).map(r => Math.round(r.total_in || 0));
        const tlMarketing = (timelineData || []).map(r => Math.round(r.marketing || 0));

        let tlTitle = `Evoluție GGR, BET & MKT (90 Zile) ${s90} - ${eFilter}`;
        if (locId) {
            const activeLoc = currentLevel1Data.find(l => l.loc_id == locId);
            if (activeLoc) tlTitle += ` - ${activeLoc.name}`;
        }

        timelineChart.setOption({
            tooltip: { 
                trigger: 'axis', position: function (pt) { return [pt[0], '10%']; }, backgroundColor: 'rgba(15,15,26,0.9)', textStyle: { color: '#fff' }, borderColor: 'rgba(255,255,255,0.2)',
                formatter: function(params) {
                    let s = `<b>${params[0].name}</b><br/>`;
                    params.forEach(p => {
                        s += `${p.marker} ${p.seriesName}: ${Math.round(p.value).toLocaleString('ro-RO')} RON<br/>`;
                    });
                    return s;
                }
            },
            title: { left: 'center', text: tlTitle, textStyle: { color: colors.textColor, fontSize: 13 } },
            legend: { data: ['GGR', 'BET', 'Marketing'], textStyle: { color: colors.textColor }, top: 30 },
            grid: { left: '5%', right: '5%', bottom: '20%', top: '20%', containLabel: true },
            xAxis: { type: 'category', boundaryGap: false, data: tlDates, axisLabel: { color: colors.textColor } },
            yAxis: { type: 'value', boundaryGap: [0, '100%'], axisLabel: { color: colors.textColor, formatter: (val) => Math.round(val).toLocaleString('ro-RO') }, splitLine: { lineStyle: { color: colors.splitLineColor, type: 'dashed' } } },
            dataZoom: [
                { type: 'inside', start: 50, end: 100 },
                { start: 50, end: 100, textStyle: { color: colors.textColor }, borderColor: colors.splitLineColor, fillerColor: 'rgba(234, 179, 8, 0.2)' }
            ],
            series: [
                {
                    name: 'BET', type: 'line', symbol: 'none', sampling: 'lttb', itemStyle: { color: '#3b82f6' },
                    data: tlBET
                },
                {
                    name: 'GGR', type: 'line', symbol: 'none', sampling: 'lttb', itemStyle: { color: '#eab308' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(234,179,8,0.8)' },
                            { offset: 1, color: 'rgba(234,179,8,0)' }
                        ])
                    },
                    data: tlGGR
                },
                {
                    name: 'Marketing', type: 'line', symbol: 'none', sampling: 'lttb', itemStyle: { color: '#ef4444' },
                    data: tlMarketing
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
            legend: { 
                type: 'scroll', orient: 'vertical', right: '5%', top: 'middle', textStyle: { color: colors.textColor, fontSize: 11 },
                formatter: function(name) {
                    let val = 0;
                    depChartData.forEach(d => { if (d.name === name) val = d.value; });
                    return name + '  ' + Math.round(val).toLocaleString('ro-RO') + ' RON';
                }
            },
            series: [{
                name: 'Cheltuieli Dep', type: 'pie', radius: ['40%', '75%'], center: ['35%', '50%'], avoidLabelOverlap: false,
                itemStyle: { borderRadius: 6, borderColor: colors.isDark ? '#0f0f1a' : '#fff', borderWidth: 2 },
                label: { show: false },
                labelLine: { show: false },
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
            legend: { 
                type: 'scroll', orient: 'vertical', right: '5%', top: 'middle', textStyle: { color: colors.textColor, fontSize: 11 },
                formatter: function(name) {
                    let val = 0;
                    locChartData.forEach(d => { if (d.name === name) val = d.value; });
                    return name + '  ' + Math.round(val).toLocaleString('ro-RO') + ' RON';
                }
            },
            series: [{
                name: 'Cheltuieli Loc', type: 'pie', radius: ['40%', '75%'], center: ['35%', '50%'], avoidLabelOverlap: false,
                itemStyle: { borderRadius: 6, borderColor: colors.isDark ? '#0f0f1a' : '#fff', borderWidth: 2 },
                label: { show: false },
                labelLine: { show: false },
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
            setTimeout(() => { 
                injectAiButtons(); 
                
                // Trigger overrides on load for charts that were saved as toggled in localStorage
                Object.keys(window.chartDateOverrides).forEach(chartId => {
                    if (window.chartDateOverrides[chartId] && document.getElementById(chartId)) {
                        let newStart = new Date().getFullYear() + '-01-01';
                        let newEnd = new Date().getFullYear() + '-12-31';
                        let activeLoc = typeof currentLocId !== 'undefined' ? currentLocId : null;
                        // Execute it async without blocking
                        fetchAndRenderChartWithOverride(chartId, activeLoc, newStart, newEnd);
                    }
                });
            }, 300);
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
            
            const controlsDiv = document.createElement('div');
            controlsDiv.style.display = 'flex';
            controlsDiv.style.alignItems = 'center';
            controlsDiv.style.gap = '12px';

            // Find the chart container inside this card to get its ID
            const chartDiv = card.querySelector('div[id^="echart-"]');
            
            if (chartDiv) {
                const chartId = chartDiv.id;
                
                // Tot Anul Toggle
                const toggleContainer = document.createElement('div');
                toggleContainer.style.display = 'flex';
                toggleContainer.style.alignItems = 'center';
                toggleContainer.style.gap = '8px';

                const toggleLabel = document.createElement('label');
                toggleLabel.className = 'toggle-switch';
                
                const toggleInput = document.createElement('input');
                toggleInput.type = 'checkbox';
                toggleInput.checked = window.chartDateOverrides[chartId] || false;
                
                const toggleSlider = document.createElement('span');
                toggleSlider.className = 'slider';
                
                toggleLabel.appendChild(toggleInput);
                toggleLabel.appendChild(toggleSlider);
                
                toggleInput.onchange = (e) => {
                    const isFullYear = e.target.checked;
                    window.chartDateOverrides[chartId] = isFullYear;
                    localStorage.setItem('chartDateOverrides', JSON.stringify(window.chartDateOverrides));
                    
                    let finalStart = null;
                    let finalEnd = null;
                    if (isFullYear) {
                        finalStart = new Date().getFullYear() + '-01-01';
                        finalEnd = new Date().getFullYear() + '-12-31';
                    } else {
                        finalStart = typeof getPeriod === 'function' ? getPeriod().s : new Date().getFullYear() + '-01-01';
                        finalEnd = typeof getPeriod === 'function' ? getPeriod().e : new Date().toISOString().split('T')[0];
                        if (!finalEnd) finalEnd = new Date().toISOString().split('T')[0];
                    }
                    
                    let activeLoc = typeof currentLocId !== 'undefined' ? currentLocId : null;
                    fetchAndRenderChartWithOverride(chartId, activeLoc, finalStart, finalEnd);
                };
                
                const toggleText = document.createElement('span');
                toggleText.innerText = 'Tot Anul';
                toggleText.style.fontSize = '11px';
                toggleText.style.color = 'var(--text, #fff)';
                toggleText.style.cursor = 'pointer';
                toggleText.onclick = () => { toggleInput.click(); };
                
                toggleContainer.appendChild(toggleLabel);
                toggleContainer.appendChild(toggleText);
                controlsDiv.appendChild(toggleContainer);
            
                // AI Button
                const btn = document.createElement('button');
                btn.className = 'btn-ghost ai-analyze-btn';
                btn.innerText = 'Analiză AI';
                btn.style.height = '24px';
                btn.style.padding = '0 12px';
                btn.style.fontSize = '11px';
                btn.style.cursor = 'pointer';
                btn.style.display = 'inline-flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.onclick = () => runAiAnalysis(chartId, titleEl.innerText);
                
                controlsDiv.appendChild(btn);
                wrapper.appendChild(controlsDiv);
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
    modal.classList.add('show');
    
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
    
    let rawDataToAnalyze = null;
    if (window._latestRawData) {
        if (chartId.includes('donut') || chartId.includes('loc')) rawDataToAnalyze = window._latestRawData.locsData;
        else if (chartId.includes('cab')) rawDataToAnalyze = window._latestRawData.cabsData;
        else if (chartId.includes('prov')) rawDataToAnalyze = window._latestRawData.provsData;
        else if (chartId.includes('combo') || chartId.includes('cal') || chartId.includes('timeline')) rawDataToAnalyze = window._latestRawData.trendData;
        else if (chartId.includes('hourly')) rawDataToAnalyze = window._latestRawData.hourlyData;
        else if (chartId.includes('exp') || chartId.includes('waterfall')) rawDataToAnalyze = window._latestRawData.expData;
    }
    
    try {
        const res = await fetch('/api/ai/analyze-chart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, data: chartData, rawData: rawDataToAnalyze })
        });
        const data = await res.json();
        
        if (data.success) {
            let htmlText = data.analysis
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            content.innerHTML = htmlText;
        } else {
            content.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 24px;">
                    <div style="font-size: 32px; margin-bottom: 16px;">⚠️</div>
                    <div style="color:var(--danger); font-size: 15px; font-weight: 600; margin-bottom: 8px;">Analiza indisponibilă</div>
                    <div style="color:var(--muted); font-size: 13px;">${data.error || 'A apărut o problemă la procesarea datelor.'}</div>
                </div>
            `;
        }
    } catch(e) {
        content.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 24px;">
                <div style="font-size: 32px; margin-bottom: 16px;">🔌</div>
                <div style="color:var(--danger); font-size: 15px; font-weight: 600; margin-bottom: 8px;">Eroare de conexiune</div>
                <div style="color:var(--muted); font-size: 13px;">Verifică conexiunea la internet sau statusul serverului.</div>
            </div>
        `;
    }
}

async function fetchAndRenderChartWithOverride(chartId, locId, start, end) {
    if (echartsInstances[chartId]) {
        echartsInstances[chartId].showLoading({text: 'Se descarcă...', color: '#3b82f6', textColor: '#fff', maskColor: 'rgba(15, 15, 26, 0.8)'});
    }

    try {
        let locPFilter = typeof locParam === 'function' ? locParam() : '';
        if (locId) locPFilter = `&loc_ids=${locId}`;
        
        let sFilter = start;
        let eFilter = end;
        if (!eFilter) eFilter = new Date().toISOString().split('T')[0];
        
        const colors = getCommonColors();
        
        if (chartId === 'echart-cal') {
            const trendData = await api(`/api/daily?res=day&start=${sFilter}&end=${eFilter}${locPFilter}`);
            let calData = trendData.map(t => [t.date || t.zi, Math.round(t.total_in || 0)]);
            let year = sFilter.split('-')[0];
            if (!echartsInstances['cal']) echartsInstances['cal'] = echarts.init(document.getElementById('echart-cal'));
            echartsInstances['cal'].setOption({
                tooltip: { position: 'top', formatter: (p) => `${p.value[0]}: ${p.value[1].toLocaleString('ro-RO')} RON` },
                visualMap: { min: 0, max: Math.max(1, ...calData.map(d=>d[1])), type: 'piecewise', orient: 'horizontal', left: 'center', top: 0, textStyle: { color: colors.textColor }, inRange: { color: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] } },
                calendar: { top: 60, left: 30, right: 30, range: year, itemStyle: { borderWidth: 1, borderColor: colors.isDark ? '#1a1a2e' : '#fff' }, dayLabel: { color: colors.textColor }, monthLabel: { color: colors.textColor }, yearLabel: { show: false } },
                series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: calData }]
            }, true);
        } else if (chartId === 'echart-hourly') {
            const hourlyData = await api(`/api/reports/hourly?start=${sFilter}&end=${eFilter}${locPFilter}`);
            let matrix = Array(7).fill(0).map(() => Array(24).fill(0));
            hourlyData.forEach(r => {
                let d = new Date(r.dt);
                let day = (d.getDay() + 6) % 7;
                let hr = d.getHours();
                matrix[day][hr] += (parseFloat(r.in) || 0);
            });
            let heatData = [];
            for (let d = 0; d < 7; d++) {
                for (let h = 0; h < 24; h++) {
                    heatData.push([h, d, Math.round(matrix[d][h])]);
                }
            }
            if (!echartsInstances['hourly']) echartsInstances['hourly'] = echarts.init(document.getElementById('echart-hourly'));
            echartsInstances['hourly'].setOption({
                tooltip: { position: 'top', formatter: (p) => `Total IN: ${p.value[2].toLocaleString('ro-RO')} RON` },
                visualMap: { show: false, min: 0, max: Math.max(1, ...heatData.map(d=>d[2])), inRange: { color: ['#ebedf0', '#3b82f6', '#1d4ed8'] } },
                xAxis: { type: 'category', data: Array.from({length:24}, (_,i)=>i+'h'), splitArea: { show: true }, axisLabel: { color: colors.textColor } },
                yAxis: { type: 'category', data: ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'], splitArea: { show: true }, axisLabel: { color: colors.textColor } },
                series: [{ type: 'heatmap', data: heatData, label: { show: false }, itemStyle: { borderColor: colors.isDark ? '#0f0f1a' : '#fff', borderWidth: 1 } }]
            }, true);
        } else if (chartId === 'echart-rtp') {
            const trendData = await api(`/api/daily?res=day&start=${sFilter}&end=${eFilter}${locPFilter}`);
            let rtpData = trendData.map(t => [t.date || t.zi, t.total_in ? Math.round((t.total_out / t.total_in)*1000)/10 : 0]);
            let holdData = trendData.map(t => [t.date || t.zi, t.total_in ? Math.round((t.ggr / t.total_in)*1000)/10 : 0]);
            if (!echartsInstances['rtp']) echartsInstances['rtp'] = echarts.init(document.getElementById('echart-rtp'));
            echartsInstances['rtp'].setOption({
                tooltip: { trigger: 'axis', formatter: (params) => { let s=`<b>${params[0].axisValue}</b><br/>`; params.forEach(p=>{s+=`${p.marker}${p.seriesName}: ${p.value[1]}%<br/>`;}); return s; } },
                color: ['#ef4444', '#10b981'],
                legend: { data: ['RTP %', 'Hold %'], textStyle: { color: colors.textColor } },
                xAxis: { type: 'category', boundaryGap: false, axisLabel: { color: colors.textColor } },
                yAxis: { type: 'value', axisLabel: { formatter: '{value} %', color: colors.textColor } },
                series: [{ name: 'RTP %', type: 'line', data: rtpData, showSymbol: false }, { name: 'Hold %', type: 'line', data: holdData, showSymbol: false }]
            }, true);
        } else if (chartId === 'echart-dow') {
            const trendData = await api(`/api/daily?res=day&start=${sFilter}&end=${eFilter}${locPFilter}`);
            let daysRaw = [ { name: 'Luni', ggr: 0, bet: 0, count: 0 }, { name: 'Marți', ggr: 0, bet: 0, count: 0 }, { name: 'Miercuri', ggr: 0, bet: 0, count: 0 }, { name: 'Joi', ggr: 0, bet: 0, count: 0 }, { name: 'Vineri', ggr: 0, bet: 0, count: 0 }, { name: 'Sâmbătă', ggr: 0, bet: 0, count: 0 }, { name: 'Duminică', ggr: 0, bet: 0, count: 0 } ];
            trendData.forEach(t => { let d = new Date(t.date || t.zi); let day = (d.getDay() + 6) % 7; daysRaw[day].ggr += (t.ggr || 0); daysRaw[day].bet += (t.total_in || 0); daysRaw[day].count++; });
            daysRaw.forEach(d => { if(d.count > 0) { d.ggr = Math.round(d.ggr/d.count); d.bet = Math.round(d.bet/d.count); } });
            daysRaw.sort((a,b) => b.bet - a.bet);
            let sortedNames = daysRaw.map(d => d.name); let sortedBet = daysRaw.map(d => d.bet); let sortedGgr = daysRaw.map(d => d.ggr);
            if (!echartsInstances['radar']) echartsInstances['radar'] = echarts.init(document.getElementById('echart-radar'));
            echartsInstances['radar'].setOption({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                color: ['#10b981', '#3b82f6'],
                legend: { data: ['Medie BET', 'Medie GGR'], textStyle: { color: colors.textColor } },
                xAxis: { type: 'category', data: sortedNames, axisLabel: { color: colors.textColor } },
                yAxis: { type: 'value', axisLabel: { formatter: (val) => val >= 1000 ? (val/1000)+'k' : val, color: colors.textColor } },
                series: [{ name: 'Medie BET', type: 'bar', data: sortedBet, itemStyle: { borderRadius: [4, 4, 0, 0] } }, { name: 'Medie GGR', type: 'bar', data: sortedGgr, itemStyle: { borderRadius: [4, 4, 0, 0] } }]
            }, true);
        } else if (chartId === 'echart-jackpot') {
            const trendData = await api(`/api/daily?res=day&start=${sFilter}&end=${eFilter}${locPFilter}`);
            let dates = trendData.map(t => (t.date || t.zi || '').substring(5));
            let mktSeries = trendData.map(t => Math.round(t.marketing || 0));
            let ggrSeries = trendData.map(t => Math.round(t.ggr || 0));
            let taxSeries = trendData.map(t => Math.round((t.ggr || 0) * 0.1));
            if (!echartsInstances['jackpot']) echartsInstances['jackpot'] = echarts.init(document.getElementById('echart-jackpot'));
            echartsInstances['jackpot'].setOption({
                tooltip: { trigger: 'axis' },
                color: ['#10b981', '#f59e0b', '#ef4444'],
                legend: { data: ['GGR', 'Marketing', 'Taxe Estimative'], textStyle: { color: colors.textColor } },
                xAxis: { type: 'category', data: dates, boundaryGap: false, axisLabel: { color: colors.textColor } },
                yAxis: { type: 'value', axisLabel: { color: colors.textColor } },
                series: [
                    { name: 'Marketing', type: 'line', stack: 'Total', areaStyle: {}, emphasis: { focus: 'series' }, data: mktSeries, itemStyle: { color: '#eab308' }, showSymbol: false },
                    { name: 'Taxe Estimative', type: 'line', stack: 'Total', areaStyle: {}, emphasis: { focus: 'series' }, data: taxSeries, itemStyle: { color: '#ef4444' }, showSymbol: false },
                    { name: 'GGR', type: 'line', stack: 'Total', areaStyle: {}, emphasis: { focus: 'series' }, data: ggrSeries, itemStyle: { color: '#10b981' }, showSymbol: false }
                ]
            }, true);
        } else if (chartId === 'echart-scatter-loc') {
            const [locsData, expDataRaw] = await Promise.all([
                api(`/api/reports/locations?start=${sFilter}&end=${eFilter}${locPFilter}`),
                api(`/api/expenses/list?start=${sFilter}&end=${eFilter}`)
            ]);
            let expData = (expDataRaw && expDataRaw.expenses) ? expDataRaw.expenses : expDataRaw;
            let scatterData = locsData.filter(l => l.ggr !== null && l.location).map(l => {
                let exp = 0;
                if (expData) {
                    let normL = (l.locatie || l.location || '').toLowerCase();
                    expData.forEach(e => {
                        if (!e.is_hidden && e.location_name && e.location_name.toLowerCase() === normL) {
                            exp += parseFloat(e.amount) || 0;
                        }
                    });
                }
                return [exp, l.ggr, l.total_in, l.locatie || l.location];
            });
            if (!echartsInstances['scatter-loc']) echartsInstances['scatter-loc'] = echarts.init(document.getElementById('echart-scatter-loc'));
            echartsInstances['scatter-loc'].setOption({
                tooltip: { 
                    formatter: function (p) { return `${p.value[3]}<br/>Exp: ${Math.round(p.value[0]).toLocaleString('ro-RO')}<br/>GGR: ${Math.round(p.value[1]).toLocaleString('ro-RO')}<br/>Drop: ${Math.round(p.value[2]).toLocaleString('ro-RO')}`; }
                },
                grid: { left: '5%', right: '5%', bottom: '10%', top: '5%', containLabel: true },
                xAxis: { name: 'Cheltuieli (RON)', nameLocation: 'middle', nameGap: 30, type: 'value', axisLabel: { color: colors.textColor }, splitLine: { lineStyle: { color: colors.splitLineColor } } },
                yAxis: { name: 'GGR (RON)', type: 'value', axisLabel: { color: colors.textColor }, splitLine: { lineStyle: { color: colors.splitLineColor } } },
                series: [{
                    type: 'scatter', data: scatterData,
                    symbolSize: function (data) { return Math.max(10, Math.min(50, Math.sqrt(data[2]) / 20)); },
                    itemStyle: { color: '#3b82f6', opacity: 0.7, borderColor: '#60a5fa', borderWidth: 1 }
                }]
            }, true);
        }
        
        // Hide loading
        let realChartId = chartId.replace('echart-', '');
        if (realChartId === 'dow') realChartId = 'radar';
        if (echartsInstances[realChartId]) echartsInstances[realChartId].hideLoading();
        if (echartsInstances[chartId]) echartsInstances[chartId].hideLoading();
        
    } catch (e) {
        console.error("fetchAndRenderChartWithOverride error:", e);
        let realChartId = chartId.replace('echart-', '');
        if (realChartId === 'dow') realChartId = 'radar';
        if (echartsInstances[realChartId]) echartsInstances[realChartId].hideLoading();
        if (echartsInstances[chartId]) echartsInstances[chartId].hideLoading();
    }
}

