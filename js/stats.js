/**
 * 数据统计模块 - 需求板、捐赠板、图表、智能建议
 */
const StatsBoard = {
  barChart: null,
  pieChart: null,
  lineChart: null,

  init() {
    this.initBar();
    this.initPie();
    this.initLine();
    this.updateTables();
    this.updateSuggestions();
  },

  update() {
    this.updateBar();
    this.updatePie();
    this.updateLine();
    this.updateTables();
    this.updateSuggestions();
  },

  /** ===== 需求板 + 捐赠板（替换地图） ===== */
  updateTables() {
    const reqBody = document.getElementById('requestBoardBody');
    const offBody = document.getElementById('offerBoardBody');
    if (!reqBody || !offBody) return;

    const countyStats = DataStore.getCountyStats();
    const rows = Object.entries(countyStats).map(([county, stats]) => ({ county, ...stats }));

    // 需求板：按求助数排序
    const reqRows = rows.filter(r => r.request > 0).sort((a, b) => b.request - a.request);
    reqBody.innerHTML = reqRows.map(r => `
      <tr>
        <td>${r.county}</td>
        <td style="color:var(--primary);font-weight:700;">${r.request}</td>
        <td style="color:${r.offer > 0 ? 'var(--success)' : 'var(--text-muted)'};">${r.offer || 0}</td>
        <td style="color:${r.request - r.offer > 0 ? 'var(--primary)' : 'var(--success)'};font-weight:700;">${r.request - r.offer > 0 ? '⚠️ ' + (r.request - r.offer) : '✅'}</td>
      </tr>
    `).join('');

    // 捐赠板：按捐赠数排序
    const offRows = rows.filter(r => r.offer > 0).sort((a, b) => b.offer - a.offer);
    offBody.innerHTML = offRows.map(r => `
      <tr>
        <td>${r.county}</td>
        <td style="color:var(--success);font-weight:700;">${r.offer}</td>
        <td style="color:${r.request > 0 ? 'var(--primary)' : 'var(--text-muted)'};">${r.request || 0}</td>
        <td style="color:var(--text-light);">${r.offer - r.request > 0 ? '余 ' + (r.offer - r.request) : '紧'}</td>
      </tr>
    `).join('');
  },

  /** ===== 柱状图 ===== */
  initBar() {
    const el = document.getElementById('barChart');
    if (!el) return;
    this.barChart = echarts.init(el);
    this.barChart.setOption(this._barOption());
    window.addEventListener('resize', () => this.barChart && this.barChart.resize());
  },

  _barOption() {
    const cats = DataStore.getCategoryStats();
    const names = Object.keys(cats);
    const requests = names.map(n => cats[n].request);
    const offers = names.map(n => cats[n].offer);

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['求助', '捐赠'], bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 40, right: 10, top: 15, bottom: 45 },
      xAxis: { type: 'category', data: names, axisLabel: { fontSize: 10, rotate: 25, interval: 0 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        { name: '求助', type: 'bar', data: requests, itemStyle: { color: '#e74c3c', borderRadius: [3,3,0,0] }, barWidth: '35%' },
        { name: '捐赠', type: 'bar', data: offers, itemStyle: { color: '#27ae60', borderRadius: [3,3,0,0] }, barWidth: '35%' }
      ]
    };
  },

  updateBar() {
    if (!this.barChart) return;
    this.barChart.setOption(this._barOption(), true);
    this.barChart.resize();
  },

  /** ===== 饼图 ===== */
  initPie() {
    const el = document.getElementById('pieChart');
    if (!el) return;
    this.pieChart = echarts.init(el);
    this.pieChart.setOption(this._pieOption());
    window.addEventListener('resize', () => this.pieChart && this.pieChart.resize());
  },

  _pieOption() {
    const cats = DataStore.getCategoryStats();
    const data = Object.entries(cats).map(([name, v]) => ({ name, value: v.request })).filter(d => d.value > 0);
    const colors = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#95a5a6'];

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['30%', '60%'],
        center: ['50%', '50%'],
        data: data.map((d, i) => ({ ...d, itemStyle: { color: colors[i % colors.length] } })),
        label: { fontSize: 11, formatter: '{b}\n{d}%', fontWeight: 600 },
        labelLine: { showAbove: true, length2: 10 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.2)' } }
      }]
    };
  },

  updatePie() {
    if (!this.pieChart) return;
    this.pieChart.setOption(this._pieOption(), true);
    this.pieChart.resize();
  },

  /** ===== 折线图 ===== */
  initLine() {
    const el = document.getElementById('lineChart');
    if (!el) return;
    this.lineChart = echarts.init(el);
    this.lineChart.setOption(this._lineOption());
    window.addEventListener('resize', () => this.lineChart && this.lineChart.resize());
  },

  _lineOption() {
    const trend = DataStore.getDailyTrend();
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 35, right: 10, top: 10, bottom: 25 },
      xAxis: { type: 'category', data: trend.map(d => d.date), axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{
        type: 'line', data: trend.map(d => d.count), smooth: true,
        lineStyle: { color: '#e74c3c', width: 2 },
        areaStyle: { color: 'rgba(231,76,60,0.1)' },
        itemStyle: { color: '#e74c3c' },
        symbol: 'circle', symbolSize: 6
      }]
    };
  },

  updateLine() {
    if (!this.lineChart) return;
    this.lineChart.setOption(this._lineOption(), true);
    this.lineChart.resize();
  },

  /** ===== 智能建议 ===== */
  updateSuggestions() {
    const box = document.getElementById('suggestionBox');
    if (!box) return;
    const cats = DataStore.getCategoryStats();
    const items = DataStore.getAll();
    if (items.length === 0) {
      box.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">暂无数据</p>';
      return;
    }

    const suggestions = [];
    let maxGap = 0, maxGapCat = '';
    Object.entries(cats).forEach(([cat, v]) => {
      const gap = v.request - v.offer;
      if (gap > maxGap) { maxGap = gap; maxGapCat = cat; }
    });
    if (maxGap > 0) suggestions.push(`🔴 <strong>${maxGapCat}</strong>缺口最大（求助${cats[maxGapCat].request}条，捐赠${cats[maxGapCat].offer}条），建议优先提供${maxGapCat}物资`);

    const urgentUnmatched = items.filter(i => i.type === 'request' && i.urgency === '特急' && i.matchCount === 0);
    if (urgentUnmatched.length > 0) suggestions.push(`🚨 有 <strong>${urgentUnmatched.length}</strong> 条特急求助尚未匹配！`);

    const countyStats = DataStore.getCountyStats();
    let maxReq = 0, maxReqCounty = '';
    Object.entries(countyStats).forEach(([county, v]) => { if (v.request > maxReq) { maxReq = v.request; maxReqCounty = county; } });
    if (maxReqCounty) suggestions.push(`📍 <strong>${maxReqCounty}</strong>求助需求最多（${maxReq}条），建议优先调配`);

    const totalReq = items.filter(i => i.type === 'request').length;
    const totalOff = items.filter(i => i.type === 'offer').length;
    if (totalReq > 0 && totalOff === 0) suggestions.push(`📢 目前只有求助信息，尚无捐赠信息，呼吁提供帮助`);
    else if (totalReq > 0 && totalOff > 0) {
      const ratio = Math.round(totalReq / totalOff * 10) / 10;
      if (ratio > 2) suggestions.push(`📊 求助/捐赠比例约为 <strong>${ratio}:1</strong>，捐赠缺口较大`);
      else if (ratio < 0.5) suggestions.push(`📊 捐赠多于求助，物资储备相对充足`);
      else suggestions.push(`📊 求助与捐赠基本平衡（比例约${ratio}:1）`);
    }

    box.innerHTML = suggestions.map(s => `<p>${s}</p>`).join('');
  },

  destroy() {
    [this.barChart, this.pieChart, this.lineChart].forEach(c => { if (c) c.dispose(); });
  }
};
