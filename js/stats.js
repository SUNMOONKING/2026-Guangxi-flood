/**
 * 数据统计模块 - 地图、图表、智能建议
 * 依赖：echarts, guangxi-data.js, data.js
 */
const StatsBoard = {
  mapChart: null,
  barChart: null,
  pieChart: null,
  lineChart: null,

  /** 初始化所有图表 */
  init() {
    this.initMap();
    this.initBar();
    this.initPie();
    this.initLine();
    this.updateTable();
    this.updateSuggestions();
  },

  /** 更新全部 */
  update() {
    this.updateMap();
    this.updateBar();
    this.updatePie();
    this.updateLine();
    this.updateTable();
    this.updateSuggestions();
  },

  /** ===== 广西地图 ===== */
  initMap() {
    const el = document.getElementById('mapChart');
    if (!el) return;
    this.mapChart = echarts.init(el);
    // 注册广西地图（使用 simplified 数据）
    // 由于 ECharts 5 需要加载广西地图 JSON，此处使用散点图模拟热力分布
    this.updateMap();
    window.addEventListener('resize', () => this.mapChart && this.mapChart.resize());
  },

  updateMap() {
    if (!this.mapChart) return;
    const countyStats = DataStore.getCountyStats();
    // 转换为 ECharts 散点图数据（按县经纬度模拟）
    const data = [];
    Object.entries(countyStats).forEach(([county, stats]) => {
      const total = stats.request + stats.offer;
      if (total > 0) {
        data.push({
          name: county,
          value: [this._getLng(county), this._getLat(county), stats.request],
          requestCount: stats.request,
          offerCount: stats.offer,
          total: total
        });
      }
    });

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: params => {
          const d = params.data;
          return `<strong>${d.name}</strong><br/>🆘 求助: ${d.requestCount}<br/>🎁 捐赠: ${d.offerCount}<br/>总计: ${d.total} 条`;
        }
      },
      grid: { show: false },
      xAxis: { show: false, min: 104, max: 112 },
      yAxis: { show: false, min: 21, max: 26.5 },
      series: [{
        type: 'scatter',
        coordinateSystem: 'cartesian2d',
        data: data,
        symbolSize: val => Math.max(12, Math.min(50, val[2] * 8)),
        itemStyle: {
          color: '#e74c3c',
          opacity: 0.7,
          shadowBlur: 8,
          shadowColor: 'rgba(231,76,60,0.3)'
        },
        label: {
          show: true,
          formatter: params => params.data.name,
          fontSize: 10,
          color: '#2c3e50',
          position: 'right'
        },
        emphasis: {
          itemStyle: { opacity: 1, shadowBlur: 12 }
        }
      }]
    };
    this.mapChart.setOption(option, true);
    this.mapChart.resize();
  },

  /** 近似经纬度（广西各市县中心点） */
  _getLng(name) {
    const map = {
      '兴宁区':108.4,'青秀区':108.5,'江南区':108.3,'西乡塘区':108.3,'良庆区':108.4,'邕宁区':108.5,
      '武鸣区':108.3,'隆安县':107.7,'马山县':108.2,'上林县':108.6,'宾阳县':108.8,'横州市':109.3,
      '城中区':109.4,'鱼峰区':109.4,'柳南区':109.4,'柳北区':109.4,'柳江区':109.3,
      '柳城县':109.2,'鹿寨县':109.7,'融安县':109.4,'融水苗族自治县':109.3,'三江侗族自治县':109.6,
      '秀峰区':110.3,'叠彩区':110.3,'象山区':110.3,'七星区':110.3,'雁山区':110.3,'临桂区':110.2,
      '阳朔县':110.5,'灵川县':110.3,'全州县':111.0,'兴安县':110.7,'永福县':110.0,'灌阳县':111.1,
      '龙胜各族自治县':110.0,'资源县':110.6,'平乐县':110.6,'荔浦市':110.4,'恭城瑶族自治县':110.8,
      '万秀区':111.3,'长洲区':111.3,'龙圩区':111.3,'苍梧县':111.2,'藤县':110.9,'蒙山县':110.5,'岑溪市':111.0,
      '海城区':109.1,'银海区':109.1,'铁山港区':109.4,'合浦县':109.2,
      '港口区':108.4,'防城区':108.4,'上思县':107.9,'东兴市':108.0,
      '钦南区':108.6,'钦北区':108.6,'灵山县':109.3,'浦北县':109.6,
      '港北区':109.6,'港南区':109.6,'覃塘区':109.4,'平南县':110.4,'桂平市':110.1,
      '玉州区':110.1,'福绵区':110.1,'容县':110.6,'陆川县':110.3,'博白县':109.9,'兴业县':109.9,'北流市':110.4,
      '右江区':106.6,'田阳区':106.9,'田东县':107.1,'平果市':107.6,'德保县':106.6,'那坡县':105.8,
      '凌云县':106.6,'乐业县':106.6,'田林县':106.2,'西林县':105.1,'隆林各族自治县':105.3,'靖西市':106.4,
      '八步区':111.5,'平桂区':111.5,'昭平县':110.8,'钟山县':111.3,'富川瑶族自治县':111.3,
      '金城江区':108.1,'宜州区':108.6,'南丹县':107.5,'天峨县':107.2,'凤山县':107.0,'东兰县':107.4,
      '罗城仫佬族自治县':108.9,'环江毛南族自治县':108.3,'巴马瑶族自治县':107.2,'都安瑶族自治县':108.1,'大化瑶族自治县':107.9,
      '兴宾区':109.2,'忻城县':108.7,'象州县':109.7,'武宣县':109.7,'金秀瑶族自治县':110.2,'合山市':108.9,
      '江州区':107.4,'扶绥县':107.9,'宁明县':107.1,'龙州县':106.9,'大新县':107.2,'天等县':107.1,'凭祥市':106.8
    };
    return map[name] || 108.0;
  },

  _getLat(name) {
    const map = {
      '兴宁区':22.8,'青秀区':22.8,'江南区':22.8,'西乡塘区':22.8,'良庆区':22.8,'邕宁区':22.8,
      '武鸣区':23.2,'隆安县':23.2,'马山县':23.7,'上林县':23.4,'宾阳县':23.2,'横州市':22.7,
      '城中区':24.3,'鱼峰区':24.3,'柳南区':24.3,'柳北区':24.3,'柳江区':24.3,
      '柳城县':24.7,'鹿寨县':24.5,'融安县':25.2,'融水苗族自治县':25.1,'三江侗族自治县':25.8,
      '秀峰区':25.3,'叠彩区':25.3,'象山区':25.3,'七星区':25.3,'雁山区':25.1,'临桂区':25.3,
      '阳朔县':24.8,'灵川县':25.4,'全州县':25.9,'兴安县':25.6,'永福县':24.9,'灌阳县':25.5,
      '龙胜各族自治县':25.8,'资源县':26.0,'平乐县':24.6,'荔浦市':24.5,'恭城瑶族自治县':24.8,
      '万秀区':23.5,'长洲区':23.5,'龙圩区':23.4,'苍梧县':23.8,'藤县':23.4,'蒙山县':24.2,'岑溪市':22.9,
      '海城区':21.5,'银海区':21.5,'铁山港区':21.5,'合浦县':21.7,
      '港口区':21.6,'防城区':21.8,'上思县':22.2,'东兴市':21.5,
      '钦南区':21.9,'钦北区':21.9,'灵山县':22.4,'浦北县':22.3,
      '港北区':23.1,'港南区':23.1,'覃塘区':23.1,'平南县':23.5,'桂平市':23.4,
      '玉州区':22.6,'福绵区':22.6,'容县':22.9,'陆川县':22.3,'博白县':22.3,'兴业县':22.7,'北流市':22.7,
      '右江区':23.9,'田阳区':23.7,'田东县':23.6,'平果市':23.3,'德保县':23.3,'那坡县':23.4,
      '凌云县':24.3,'乐业县':24.8,'田林县':24.3,'西林县':24.5,'隆林各族自治县':24.8,'靖西市':23.1,
      '八步区':24.4,'平桂区':24.4,'昭平县':24.2,'钟山县':24.5,'富川瑶族自治县':24.8,
      '金城江区':24.7,'宜州区':24.5,'南丹县':24.9,'天峨县':25.0,'凤山县':24.5,'东兰县':24.5,
      '罗城仫佬族自治县':24.8,'环江毛南族自治县':24.8,'巴马瑶族自治县':24.1,'都安瑶族自治县':23.9,'大化瑶族自治县':23.7,
      '兴宾区':23.7,'忻城县':24.1,'象州县':23.9,'武宣县':23.6,'金秀瑶族自治县':24.1,'合山市':23.8,
      '江州区':22.4,'扶绥县':22.6,'宁明县':22.1,'龙州县':22.3,'大新县':22.8,'天等县':23.1,'凭祥市':22.1
    };
    return map[name] || 24.0;
  },

  /** ===== 柱状图：各类物资供需对比 ===== */
  initBar() {
    const el = document.getElementById('barChart');
    if (!el) return;
    this.barChart = echarts.init(el);
    this.updateBar();
    window.addEventListener('resize', () => this.barChart && this.barChart.resize());
  },

  updateBar() {
    if (!this.barChart) return;
    const cats = DataStore.getCategoryStats();
    const names = Object.keys(cats);
    const requests = names.map(n => cats[n].request);
    const offers = names.map(n => cats[n].offer);

    this.barChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['求助', '捐赠'], bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 10, top: 10, bottom: 40 },
      xAxis: { type: 'category', data: names, axisLabel: { fontSize: 10, rotate: 30 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        { name: '求助', type: 'bar', data: requests, itemStyle: { color: '#e74c3c', borderRadius: [3,3,0,0] } },
        { name: '捐赠', type: 'bar', data: offers, itemStyle: { color: '#27ae60', borderRadius: [3,3,0,0] } }
      ]
    }, true);
  },

  /** ===== 饼图：求助物资类别分布 ===== */
  initPie() {
    const el = document.getElementById('pieChart');
    if (!el) return;
    this.pieChart = echarts.init(el);
    this.updatePie();
    window.addEventListener('resize', () => this.pieChart && this.pieChart.resize());
  },

  updatePie() {
    if (!this.pieChart) return;
    const cats = DataStore.getCategoryStats();
    const data = Object.entries(cats)
      .map(([name, v]) => ({ name, value: v.request }))
      .filter(d => d.value > 0);

    const colors = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#95a5a6'];
    this.pieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie', radius: ['35%', '65%'], center: ['50%', '50%'],
        data: data.map((d,i) => ({ ...d, itemStyle: { color: colors[i % colors.length] } })),
        label: { fontSize: 10, formatter: '{b}\n{d}%' },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.2)' } }
      }]
    }, true);
  },

  /** ===== 折线图：近7日趋势 ===== */
  initLine() {
    const el = document.getElementById('lineChart');
    if (!el) return;
    this.lineChart = echarts.init(el);
    this.updateLine();
    window.addEventListener('resize', () => this.lineChart && this.lineChart.resize());
  },

  updateLine() {
    if (!this.lineChart) return;
    const trend = DataStore.getDailyTrend();

    this.lineChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 10, top: 10, bottom: 25 },
      xAxis: { type: 'category', data: trend.map(d => d.date), axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{
        type: 'line', data: trend.map(d => d.count), smooth: true,
        lineStyle: { color: '#e74c3c', width: 2 },
        areaStyle: { color: 'rgba(231,76,60,0.1)' },
        itemStyle: { color: '#e74c3c' },
        symbol: 'circle', symbolSize: 6
      }]
    }, true);
  },

  /** ===== 县级数据表格 ===== */
  updateTable() {
    const tbody = document.getElementById('countyTableBody');
    if (!tbody) return;
    const countyStats = DataStore.getCountyStats();
    const rows = Object.entries(countyStats)
      .map(([county, stats]) => ({ county, ...stats, gap: stats.request - stats.offer }))
      .sort((a, b) => b.gap - a.gap);

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.county}</td>
        <td style="color:var(--primary);font-weight:700;">${r.request}</td>
        <td style="color:var(--success);font-weight:700;">${r.offer}</td>
        <td style="color:${r.gap > 0 ? 'var(--primary)' : 'var(--success)'};font-weight:700;">${r.gap > 0 ? '⚠️ ' + r.gap : '✅ 充足'}</td>
      </tr>
    `).join('');
  },

  /** ===== 智能物资提供建议 ===== */
  updateSuggestions() {
    const box = document.getElementById('suggestionBox');
    if (!box) return;

    const cats = DataStore.getCategoryStats();
    const items = DataStore.getAll();
    if (items.length === 0) {
      box.innerHTML = '<p style="color:var(--text-muted);">暂无数据，发布第一条信息后会自动生成建议</p>';
      return;
    }

    const suggestions = [];

    // 1. 检查缺口最大的类别
    let maxGap = 0, maxGapCat = '';
    Object.entries(cats).forEach(([cat, v]) => {
      const gap = v.request - v.offer;
      if (gap > maxGap) { maxGap = gap; maxGapCat = cat; }
    });
    if (maxGap > 0) {
      suggestions.push(`🔴 <strong>${maxGapCat}</strong>缺口最大（求助${cats[maxGapCat].request}条，捐赠仅${cats[maxGapCat].offer}条），建议优先提供${maxGapCat}物资`);
    }

    // 2. 检查特急未匹配
    const urgentUnmatched = items.filter(i => i.type === 'request' && i.urgency === '特急' && i.matchCount === 0);
    if (urgentUnmatched.length > 0) {
      suggestions.push(`🚨 有 <strong>${urgentUnmatched.length}</strong> 条特急求助尚未匹配，急需关注！`);
    }

    // 3. 需求最多的县
    const countyStats = DataStore.getCountyStats();
    let maxReq = 0, maxReqCounty = '';
    Object.entries(countyStats).forEach(([county, v]) => {
      if (v.request > maxReq) { maxReq = v.request; maxReqCounty = county; }
    });
    if (maxReqCounty) {
      suggestions.push(`📍 <strong>${maxReqCounty}</strong>求助需求最多（${maxReq}条），建议物资优先调配至该地区`);
    }

    // 4. 总体平衡度
    const totalReq = items.filter(i => i.type === 'request').length;
    const totalOff = items.filter(i => i.type === 'offer').length;
    if (totalReq > 0 && totalOff === 0) {
      suggestions.push(`📢 目前只有求助信息，尚无捐赠信息，呼吁有能力的人提供帮助`);
    } else if (totalReq > 0 && totalOff > 0) {
      const ratio = Math.round(totalReq / totalOff * 10) / 10;
      if (ratio > 2) {
        suggestions.push(`📊 求助/捐赠比例约为 <strong>${ratio}:1</strong>，捐赠缺口较大，建议增加物资供给`);
      } else if (ratio < 0.5) {
        suggestions.push(`📊 捐赠多于求助，物资储备相对充足`);
      } else {
        suggestions.push(`📊 求助与捐赠基本平衡（比例约${ratio}:1），继续保持`);
      }
    }

    box.innerHTML = suggestions.map(s => `<p>${s}</p>`).join('');
  },

  /** 销毁 */
  destroy() {
    [this.mapChart, this.barChart, this.pieChart, this.lineChart].forEach(c => {
      if (c) { c.dispose(); }
    });
  }
};