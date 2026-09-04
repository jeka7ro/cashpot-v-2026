import re

with open('dashboard2.js', 'r') as f:
    content = f.read()

# 1. Replace Promise.all
old_promise = """    const [kpiData, trendData, timelineData, expData] = await Promise.all([
        api(`/api/kpi?start=${sFilter}&end=${eFilter}${locPFilter}`),
        api(`/api/daily?res=day&start=${sFilter}&end=${eFilter}${locPFilter}`),
        api(`/api/daily?res=day&start=${s90}&end=${eFilter}${locPFilter}`),
        api(`/api/reports/expenses?start=${sFilter}&end=${eFilter}${locPFilter}`)
    ]);"""

new_promise = """    const [kpiData, trendData, timelineData, expData, locsData, cabsData, provsData, hourlyData] = await Promise.all([
        api(`/api/kpi?start=${sFilter}&end=${eFilter}${locPFilter}`),
        api(`/api/daily?res=day&start=${sFilter}&end=${eFilter}${locPFilter}`),
        api(`/api/daily?res=day&start=${s90}&end=${eFilter}${locPFilter}`),
        api(`/api/reports/expenses?start=${sFilter}&end=${eFilter}${locPFilter}`),
        api(`/api/locations?start=${sFilter}&end=${eFilter}${locPFilter}`),
        api(`/api/cabinets?start=${sFilter}&end=${eFilter}${locPFilter}`),
        api(`/api/providers?start=${sFilter}&end=${eFilter}${locPFilter}`),
        api(`/api/reports/hourly?start=${sFilter}&end=${eFilter}${locPFilter}`)
    ]);"""

content = content.replace(old_promise, new_promise)

# 2. Append charts code before initDashboard2
charts_code = """
    // --- 1. TOP & BOTTOM SĂLI ---
    if (document.getElementById('echart-top-loc') && locsData) {
        let locsSorted = [...locsData].filter(l => l.ggr !== null).sort((a,b) => b.ggr - a.ggr);
        let top10 = locsSorted.slice(0, 10).reverse();
        let bot10 = locsSorted.slice(-10);

        if (!echartsInstances['top-loc']) echartsInstances['top-loc'] = echarts.init(document.getElementById('echart-top-loc'));
        echartsInstances['top-loc'].setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => `${p[0].name}<br/>GGR: ${Math.round(p[0].value).toLocaleString('ro-RO')} RON` },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
            xAxis: { type: 'value', axisLabel: { color: colors.textColor } },
            yAxis: { type: 'category', data: top10.map(l => l.location), axisLabel: { color: colors.textColor, width: 100, overflow: 'truncate' } },
            series: [{ type: 'bar', data: top10.map(l => l.ggr), itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] } }]
        }, true);

        if (!echartsInstances['bot-loc']) echartsInstances['bot-loc'] = echarts.init(document.getElementById('echart-bot-loc'));
        echartsInstances['bot-loc'].setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => `${p[0].name}<br/>GGR: ${Math.round(p[0].value).toLocaleString('ro-RO')} RON` },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
            xAxis: { type: 'value', axisLabel: { color: colors.textColor } },
            yAxis: { type: 'category', data: bot10.map(l => l.location), axisLabel: { color: colors.textColor, width: 100, overflow: 'truncate' } },
            series: [{ type: 'bar', data: bot10.map(l => l.ggr), itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] } }]
        }, true);
    }

    // --- 3. SCATTER GGR vs CHELTUIELI ---
    if (document.getElementById('echart-scatter-loc') && locsData) {
        let scatterData = locsData.filter(l => l.ggr !== null && l.location).map(l => {
            let exp = 0;
            if (expData) {
                let normL = l.location.toLowerCase();
                expData.forEach(e => {
                    if (!e.is_hidden && e.location_name && e.location_name.toLowerCase() === normL) {
                        exp += parseFloat(e.amount) || 0;
                    }
                });
            }
            return [exp, l.ggr, l.total_in, l.location]; // x, y, size, name
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
    if (document.getElementById('echart-cab') && cabsData) {
        let cabChartData = cabsData.slice(0,10).map(c => ({ name: c.cabinet, value: Math.round(c.ggr) }));
        if (!echartsInstances['cab']) echartsInstances['cab'] = echarts.init(document.getElementById('echart-cab'));
        echartsInstances['cab'].setOption({
            tooltip: { trigger: 'item' }, color: colors.colorPalette,
            legend: { type: 'scroll', orient: 'vertical', right: '5%', top: 'middle', textStyle: { color: colors.textColor, fontSize: 11 }, formatter: (name) => { let v = cabChartData.find(d=>d.name===name); return name + ' ' + (v?v.value.toLocaleString('ro-RO'):''); } },
            series: [{ type: 'pie', radius: '65%', center: ['35%', '50%'], data: cabChartData, label: { show: false } }]
        }, true);
    }
    if (document.getElementById('echart-prov') && provsData) {
        let provChartData = provsData.map(p => ({ name: p.provider, value: Math.round(p.total_in) }));
        if (!echartsInstances['prov']) echartsInstances['prov'] = echarts.init(document.getElementById('echart-prov'));
        echartsInstances['prov'].setOption({
            tooltip: { trigger: 'item' }, color: colors.colorPalette.slice(3).concat(colors.colorPalette),
            legend: { type: 'scroll', orient: 'vertical', right: '5%', top: 'middle', textStyle: { color: colors.textColor, fontSize: 11 }, formatter: (name) => { let v = provChartData.find(d=>d.name===name); return name + ' ' + (v?v.value.toLocaleString('ro-RO'):''); } },
            series: [{ type: 'pie', radius: ['40%', '70%'], center: ['35%', '50%'], data: provChartData, label: { show: false } }]
        }, true);
    }

    // --- 6. CALENDAR HEATMAP ---
    if (document.getElementById('echart-cal') && trendData) {
        let calData = trendData.map(t => [t.date, Math.round(t.ggr)]);
        let year = trendData.length ? trendData[0].date.substring(0,4) : new Date().getFullYear();
        if (!echartsInstances['cal']) echartsInstances['cal'] = echarts.init(document.getElementById('echart-cal'));
        echartsInstances['cal'].setOption({
            tooltip: { position: 'top', formatter: (p) => `${p.value[0]}: ${p.value[1].toLocaleString('ro-RO')} RON` },
            visualMap: { min: 0, max: Math.max(1, ...calData.map(d=>d[1])), type: 'piecewise', orient: 'horizontal', left: 'center', top: 0, textStyle: { color: colors.textColor }, inRange: { color: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] } },
            calendar: { top: 60, left: 30, right: 30, range: year, itemStyle: { borderWidth: 1, borderColor: colors.isDark ? '#1a1a2e' : '#fff' }, dayLabel: { color: colors.textColor }, monthLabel: { color: colors.textColor }, yearLabel: { show: false } },
            series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: calData }]
        }, true);
    }

    // --- 7. HOURLY HEATMAP ---
    if (document.getElementById('echart-hourly') && hourlyData && hourlyData.length) {
        // Group by DayOfWeek (0-6, Mon-Sun) and Hour (0-23)
        let matrix = Array(7).fill(0).map(() => Array(24).fill(0));
        hourlyData.forEach(r => {
            let d = new Date(r.dt);
            let day = (d.getDay() + 6) % 7; // Mon=0, Sun=6
            let hr = d.getHours();
            matrix[day][hr] += parseFloat(r.ggr) || 0;
        });
        let heatData = [];
        for(let d=0; d<7; d++) for(let h=0; h<24; h++) heatData.push([h, d, Math.round(matrix[d][h])]);
        
        let days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
        let hours = Array(24).fill(0).map((_,i) => i+'h');
        
        if (!echartsInstances['hourly']) echartsInstances['hourly'] = echarts.init(document.getElementById('echart-hourly'));
        echartsInstances['hourly'].setOption({
            tooltip: { position: 'top', formatter: (p) => `${days[p.value[1]]} ${hours[p.value[0]]}: ${p.value[2].toLocaleString('ro-RO')} RON` },
            grid: { left: '5%', right: '2%', bottom: '5%', top: '5%', containLabel: true },
            xAxis: { type: 'category', data: hours, axisLabel: { color: colors.textColor, interval: 2 } },
            yAxis: { type: 'category', data: days, axisLabel: { color: colors.textColor } },
            visualMap: { min: 0, max: Math.max(1, ...heatData.map(d=>d[2])), show: false, inRange: { color: ['#3b82f622', '#3b82f6', '#1d4ed8'] } },
            series: [{ type: 'heatmap', data: heatData, label: { show: false }, itemStyle: { borderColor: colors.isDark ? '#0f0f1a' : '#fff', borderWidth: 1 } }]
        }, true);
    }

    // --- 8. RADAR ZILE ---
    if (document.getElementById('echart-radar') && trendData) {
        let daysGGR = Array(7).fill(0);
        let daysCount = Array(7).fill(0);
        trendData.forEach(t => {
            let day = (new Date(t.date).getDay() + 6) % 7;
            daysGGR[day] += parseFloat(t.ggr) || 0;
            daysCount[day]++;
        });
        let radarData = daysGGR.map((g,i) => daysCount[i] ? Math.round(g/daysCount[i]) : 0);
        
        if (!echartsInstances['radar']) echartsInstances['radar'] = echarts.init(document.getElementById('echart-radar'));
        echartsInstances['radar'].setOption({
            tooltip: { trigger: 'item' },
            radar: {
                indicator: [
                    { name: 'Luni', max: Math.max(...radarData) }, { name: 'Marți', max: Math.max(...radarData) }, { name: 'Miercuri', max: Math.max(...radarData) },
                    { name: 'Joi', max: Math.max(...radarData) }, { name: 'Vineri', max: Math.max(...radarData) }, { name: 'Sâmbătă', max: Math.max(...radarData) }, { name: 'Duminică', max: Math.max(...radarData) }
                ],
                axisName: { color: colors.textColor }, splitArea: { show: false }
            },
            series: [{ type: 'radar', data: [{ value: radarData, name: 'Medie GGR', areaStyle: { color: 'rgba(59, 130, 246, 0.4)' }, lineStyle: { color: '#3b82f6' } }] }]
        }, true);
    }

    // --- 9. RTP VS HOLD ---
    if (document.getElementById('echart-rtp') && trendData) {
        let rtpData = trendData.map(t => [t.date, t.total_in ? Math.round((t.total_out / t.total_in)*1000)/10 : 0]);
        let holdData = trendData.map(t => [t.date, t.total_in ? Math.round((t.ggr / t.total_in)*1000)/10 : 0]);
        
        if (!echartsInstances['rtp']) echartsInstances['rtp'] = echarts.init(document.getElementById('echart-rtp'));
        echartsInstances['rtp'].setOption({
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '5%', top: '15%', containLabel: true },
            legend: { data: ['RTP %', 'Hold %'], textStyle: { color: colors.textColor } },
            xAxis: { type: 'category', data: trendData.map(t=>t.date.substring(5)), axisLabel: { color: colors.textColor } },
            yAxis: { type: 'value', axisLabel: { color: colors.textColor, formatter: '{value}%' }, splitLine: { lineStyle: { color: colors.splitLineColor } } },
            series: [
                { name: 'RTP %', type: 'line', smooth: true, data: rtpData.map(d=>d[1]), itemStyle: { color: '#ef4444' } },
                { name: 'Hold %', type: 'line', smooth: true, data: holdData.map(d=>d[1]), itemStyle: { color: '#10b981' } }
            ]
        }, true);
    }

    // --- 10. IMPACT JACKPOTS ---
    if (document.getElementById('echart-jackpot') && trendData) {
        let dates = trendData.map(t => t.date.substring(5));
        let ggrSeries = trendData.map(t => Math.round(t.ggr));
        let jpSeries = trendData.map(t => Math.round(t.jackpot || 0));
        let taxSeries = trendData.map(t => Math.round((t.ggr || 0) * 0.1)); // Approximation if no taxes API
        
        if (!echartsInstances['jackpot']) echartsInstances['jackpot'] = echarts.init(document.getElementById('echart-jackpot'));
        echartsInstances['jackpot'].setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } } },
            grid: { left: '3%', right: '4%', bottom: '5%', top: '15%', containLabel: true },
            legend: { data: ['GGR', 'Jackpots', 'Taxe Estimative'], textStyle: { color: colors.textColor } },
            xAxis: { type: 'category', boundaryGap: false, data: dates, axisLabel: { color: colors.textColor } },
            yAxis: { type: 'value', axisLabel: { color: colors.textColor }, splitLine: { lineStyle: { color: colors.splitLineColor } } },
            series: [
                { name: 'Jackpots', type: 'line', stack: 'Total', areaStyle: {}, emphasis: { focus: 'series' }, data: jpSeries, itemStyle: { color: '#eab308' } },
                { name: 'Taxe Estimative', type: 'line', stack: 'Total', areaStyle: {}, emphasis: { focus: 'series' }, data: taxSeries, itemStyle: { color: '#ef4444' } },
                { name: 'GGR', type: 'line', stack: 'Total', areaStyle: {}, emphasis: { focus: 'series' }, data: ggrSeries, itemStyle: { color: '#10b981' } }
            ]
        }, true);
    }

"""

content = content.replace("async function initDashboard2() {", charts_code + "\nasync function initDashboard2() {")

with open('dashboard2.js', 'w') as f:
    f.write(content)
