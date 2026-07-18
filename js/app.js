/**
 * 主应用 - Supabase 云存储 + 身份系统
 */
const app = {
  activeTab: 'all',
  currentPage: 1,
  pageSize: 10,
  currentIdentity: null,

  warmMessages: [
    '🧡 每一份帮助都弥足珍贵，感谢每一个善良的你',
    '💪 风雨同舟，守望相助，我们在一起',
    '🌧️ 洪水无情人有情，众志成城渡难关',
    '🤝 你的一份爱心，可能是别人的一束光',
    '🌈 风雨过后见彩虹，我们一起加油',
    '🙏 感谢每一个伸出援手的人，世界因你更温暖',
    '❤️ 一方有难八方支援，这就是我们的力量',
    '☀️ 天总会晴，一切都会好起来的'
  ],

  async init() {
    await DataStore.init();
    this.populateProvince();
    this.populateRegion();
    MatchEngine.matchAll();
    this.render();
    this.updateStats();
    this.updateShare();
    this.startWarmRotation();
    setTimeout(() => StatsBoard.init(), 500);
    setInterval(async () => {
      await DataStore.init();
      MatchEngine.matchAll();
      this.render();
      this.updateStats();
      StatsBoard.update();
      this.updateShare();
    }, 30000);
  },

  startWarmRotation() {
    const el = document.getElementById('warmText');
    if (!el) return;
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % this.warmMessages.length;
      el.style.opacity = '0';
      setTimeout(() => { el.textContent = this.warmMessages[idx]; el.style.opacity = '1'; }, 400);
    }, 6000);
  },

  // ====== 省份 ======
  populateProvince() {
    const sel = document.getElementById('formProvince');
    sel.innerHTML = '<option value="">请选省</option>';
    PROVINCES.forEach(p => {
      const o = document.createElement('option');
      o.value = p; o.textContent = p;
      if (p === '广西壮族自治区') o.selected = true;
      sel.appendChild(o);
    });
    this.onProvinceChange();
  },
  onProvinceChange() {
    const p = document.getElementById('formProvince').value;
    const citySel = document.getElementById('formCity');
    citySel.innerHTML = '<option value="">请选市</option>';
    document.getElementById('formCounty').innerHTML = '<option value="">请选县/区</option>';
    if (!p) return;
    getCities(p).forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; citySel.appendChild(o); });
    this.onCityChange();
  },
  onCityChange() {
    const p = document.getElementById('formProvince').value;
    const c = document.getElementById('formCity').value;
    const countySel = document.getElementById('formCounty');
    countySel.innerHTML = '<option value="">请选县/区</option>';
    if (!p || !c) return;
    getCounties(p, c).forEach(ct => { const o = document.createElement('option'); o.value = ct; o.textContent = ct; countySel.appendChild(o); });
  },

  // ====== 发布 ======
  openPublish(type) {
    document.getElementById('publishTitle').textContent = type === 'request' ? '📢 发布求助信息' : '🎁 发布捐赠信息';
    document.getElementById('publishModal').dataset.type = type;
    const sel = document.getElementById('formProvince');
    sel.innerHTML = '<option value="">请选省</option>';
    // 全国所有省份
    const provinces = PROVINCES;
    provinces.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p; if (p === '广西壮族自治区') o.selected = true; sel.appendChild(o); });
    this.onProvinceChange();
    document.getElementById('publishModal').classList.add('show');
    document.body.style.overflow = 'hidden';
  },
  closePublish(e) {
    if (e && e.target !== document.getElementById('publishModal')) return;
    document.getElementById('publishModal').classList.remove('show');
    document.body.style.overflow = '';
    ['formName','formSupplies','formPhone','formNote','formQuantity','formSituation','formAddress'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  },
  async submitPublish() {
    const type = document.getElementById('publishModal').dataset.type;
    const name = document.getElementById('formName').value.trim() || '匿名';
    const supplies = document.getElementById('formSupplies').value.trim();
    const phone = document.getElementById('formPhone').value.trim();
    const note = document.getElementById('formNote').value.trim();
    const category = document.getElementById('formCategory').value;
    const quantity = document.getElementById('formQuantity').value.trim();
    const urgency = document.getElementById('formUrgency').value;
    const situation = document.getElementById('formSituation').value.trim();
    const province = document.getElementById('formProvince').value;
    const city = document.getElementById('formCity').value;
    const county = document.getElementById('formCounty').value;
    const address = document.getElementById('formAddress').value.trim();

    let location = '';
    if (province) location += province;
    if (city) location += city;
    if (county) location += county;
    if (address) location += '·' + address;
    if (!supplies) { this._toast('请填写物资名称'); return; }
    if (!location) { this._toast('请选择所在地区'); return; }
    if (!phone) { this._toast('请填写联系电话'); return; }

    const personalId = this.currentIdentity ? this.currentIdentity.personalId : '';
    try {
      await DataStore.add({ type, name, supplies, location, phone, note, category, quantity, urgency, situation, source: '自发布', personal_id: personalId });
      MatchEngine.matchAll();
      this.populateRegion();
      this.render();
      this.updateStats();
      StatsBoard.update();
      this.closePublish();
      this.updateShare();
      if (!this.currentIdentity) {
        this._toast('✅ 发布成功！建议点击「📋 我的」注册身份，方便管理您的发布');
      } else {
        this._toast('✅ 发布成功！可在「我的中心」查看管理');
      }
    } catch(e) {
      this._toast('发布失败，请检查网络后重试');
    }
  },

  populateRegion() {
    const sel = document.getElementById('filterRegion');
    while (sel.options.length > 1) sel.remove(1);
    DataStore.getRegions().forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = '📍 ' + r; sel.appendChild(o); });
  },

  // ====== 渲染 ======
  render() {
    const grid = document.getElementById('cardGrid');
    const items = DataStore.getAll();
    if (items.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🤝</div><h3>暂无信息</h3><p>点击上方按钮发布第一条信息</p></div>';
      document.getElementById('tabCount').textContent = '共 0 条';
      return;
    }
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    let html = '';
    items.forEach(item => {
      const isReq = item.type === 'request';
      const hasMatch = item.matchCount > 0;
      const urg = item.urgency || '一般';
      html += `<div class="card ${item.type}" data-id="${item.id}"><div class="card-header"><span class="card-badge ${isReq ? 'request' : 'offer'}">${isReq ? '🆘 求助' : '🎁 捐赠'}</span><span class="card-id">${item.serial || '---'}</span><span class="card-time">${this._timeAgo(item.createdAt)}</span></div><span class="card-urgency urgency-${urg}">${urg === '特急' ? '🔴' : urg === '紧急' ? '🟡' : '🟢'} ${urg}</span><div class="card-location">${item.location}</div><div class="card-supplies">${isReq ? '急需' : '可提供'}：${item.supplies}</div><div class="card-category">📂 ${item.category || '其他'} ${item.quantity ? '· ' + item.quantity : ''}</div>${item.situation ? `<div class="card-situation">${item.situation}</div>` : ''}<div class="card-contact-row"><span class="card-name">${item.name}</span><span class="card-phone"><a href="tel:${item.phone.replace(/\s/g,'')}">${item.phone}</a></span></div>${item.note ? `<div style="font-size:.82rem;color:var(--text-light);margin-top:3px;">${item.note}</div>` : ''}<div class="card-match"><span class="match-badge ${hasMatch ? 'matched' : 'unmatched'}">${hasMatch ? '✅ 已匹配 ' + item.matchCount + ' 条' : '⏳ 待匹配'}</span>${hasMatch ? `<button class="match-btn" onclick="app.showMatch('${item.id}')">🎯 查看匹配</button>` : ''}</div></div>`;
    });
    grid.innerHTML = html;
    document.getElementById('tabCount').textContent = `共 ${items.length} 条`;
    this.filter();
    this.updateStats();
    this.currentPage = 1;
    this.updatePagination();
  },

  updateStats() {
    const s = DataStore.getStats();
    document.getElementById('statRequests').textContent = s.requests;
    document.getElementById('statOffers').textContent = s.offers;
    document.getElementById('statMatched').textContent = s.matched;
    document.getElementById('statPending').textContent = s.pending;
    document.getElementById('statTotalItems').textContent = s.total;
  },

  // ====== 筛选 ======
  filter() {
    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    const region = document.getElementById('filterRegion').value;
    const typeFilter = document.getElementById('filterType').value;
    const matchFilter = document.getElementById('filterMatch').value;
    requestAnimationFrame(() => {
      const cards = document.querySelectorAll('.card');
      let visible = 0;
      cards.forEach(card => {
        const id = card.dataset.id;
        const item = DataStore.getAll().find(i => i.id === id);
        if (!item) { card.style.display = 'none'; return; }
        let show = true;
        if (this.activeTab === 'request' && item.type !== 'request') show = false;
        if (this.activeTab === 'offer' && item.type !== 'offer') show = false;
        if (typeFilter === 'request' && item.type !== 'request') show = false;
        if (typeFilter === 'offer' && item.type !== 'offer') show = false;
        if (show && search) { const txt = `${item.supplies} ${item.location} ${item.name} ${item.phone} ${item.serial} ${item.category}`.toLowerCase(); if (!txt.includes(search)) show = false; }
        if (show && region) { const r = item.location.split(/[·•·\s]/)[0].trim(); if (!r.includes(region) && !region.includes(r)) show = false; }
        if (show && matchFilter === 'matched' && item.matchCount === 0) show = false;
        if (show && matchFilter === 'unmatched' && item.matchCount > 0) show = false;
        card.style.display = show ? 'block' : 'none';
        if (show) visible++;
      });
      const grid = document.getElementById('cardGrid');
      let empty = grid.querySelector('.empty-result');
      if (visible === 0 && DataStore.getAll().length > 0) {
        if (!empty) { const d = document.createElement('div'); d.className = 'empty-result'; d.style.cssText = 'grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light);'; d.textContent = '😕 没有匹配到结果'; grid.appendChild(d); }
      } else if (empty) empty.remove();
    });
  },
  switchTab(tab) { this.activeTab = tab; document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); this.currentPage = 1; this.filter(); },

  // ====== 匹配 ======
  showMatch(itemId) {
    const item = DataStore.getAll().find(i => i.id === itemId);
    if (!item) return;
    const related = MatchEngine.findMatchesFor(itemId);
    const body = document.getElementById('matchModalBody');
    if (related.length === 0) { body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">暂无匹配结果</p>'; }
    else {
      let html = `<p style="margin-bottom:10px;font-weight:600;font-size:.9rem;">为 <strong>${item.name}</strong>（${item.location}）找到以下匹配：</p>`;
      related.forEach((m, i) => {
        const mc = m.matchedItem;
        html += `<div class="match-item"><div class="match-dir">${m.direction} #${i+1}${m.sameRegion ? ' · 📍 同地区' : ''}</div><div class="match-content"><p><strong>${mc.type === 'request' ? '急需' : '可提供'}</strong>：${mc.supplies}</p><p>📍 ${mc.location} · ${mc.category || '其他'}</p>${mc.situation ? `<p style="color:var(--text-light);font-size:.78rem;">${mc.situation}</p>` : ''}</div><div class="match-contact">👤 ${mc.name} &nbsp; 📞 <a href="tel:${mc.phone.replace(/\s/g,'')}">${mc.phone}</a></div></div>`;
      });
      body.innerHTML = html;
    }
    document.getElementById('matchModal').classList.add('show');
    document.body.style.overflow = 'hidden';
  },
  closeModal(e) { if (e && e.target !== document.getElementById('matchModal')) return; document.getElementById('matchModal').classList.remove('show'); document.body.style.overflow = ''; },

  // ====== 看板 ======
  toggleDashboard() {
    const panel = document.getElementById('dashboardPanel');
    const btn = document.querySelector('.btn-pub-dashboard');
    const arrow = document.getElementById('dashArrow');
    const isOpen = panel.classList.toggle('show');
    arrow.textContent = isOpen ? '▴' : '▾';
    btn.classList.toggle('active', isOpen);
    if (isOpen) setTimeout(() => StatsBoard.update(), 100);
  },

  // ====== 分页 ======
  updatePagination() {
    const allItems = DataStore.getAll().filter(item => { const card = document.querySelector(`.card[data-id="${item.id}"]`); return card && card.style.display !== 'none'; });
    const totalItems = allItems.length;
    const totalPages = Math.ceil(totalItems / this.pageSize);
    const pagination = document.getElementById('pagination');
    if (totalItems <= this.pageSize) { pagination.classList.remove('show'); return; }
    pagination.classList.add('show');
    document.getElementById('prevPage').disabled = this.currentPage <= 1;
    document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    const numbers = document.getElementById('pageNumbers');
    numbers.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.className = 'page-num' + (i === this.currentPage ? ' active' : '');
      btn.textContent = i;
      btn.onclick = () => { this.currentPage = i; this.applyPagination(); };
      numbers.appendChild(btn);
    }
    this.applyPagination();
  },
  applyPagination() {
    const items = DataStore.getAll().filter(item => { const card = document.querySelector(`.card[data-id="${item.id}"]`); return card && card.style.display !== 'none'; });
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageItems = items.slice(start, end);
    document.querySelectorAll('.card').forEach(card => {
      const id = card.dataset.id;
      const inPage = pageItems.some(i => i.id === id);
      if (card.style.display !== 'none' && !inPage) card.style.display = 'none';
    });
    document.querySelectorAll('.page-num').forEach(b => b.classList.toggle('active', parseInt(b.textContent) === this.currentPage));
  },
  goPage(dir) {
    const totalItems = DataStore.getAll().filter(item => { const card = document.querySelector(`.card[data-id="${item.id}"]`); return card && card.style.display !== 'none'; }).length;
    const totalPages = Math.ceil(totalItems / this.pageSize);
    if (dir === 'prev' && this.currentPage > 1) this.currentPage--;
    if (dir === 'next' && this.currentPage < totalPages) this.currentPage++;
    this.updatePagination();
  },

  // ====== 导出 ======
  exportExcel() {
    const items = DataStore.getAll();
    if (items.length === 0) { this._toast('暂无数据可导出'); return; }
    const data = items.map(i => ({ '编号': i.serial, '类型': i.type === 'request' ? '求助' : '捐赠', '物资分类': i.category || '其他', '物资名称': i.supplies, '数量': i.quantity || '', '紧急程度': i.urgency || '一般', '现状说明': i.situation || '', '地点': i.location, '联系人': i.name, '电话': i.phone, '备注': i.note || '', '匹配数': i.matchCount || 0, '发布时间': new Date(i.createdAt).toLocaleString('zh-CN') }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:8},{wch:6},{wch:10},{wch:24},{wch:10},{wch:8},{wch:30},{wch:20},{wch:10},{wch:14},{wch:20},{wch:6},{wch:18}];
    XLSX.utils.book_append_sheet(wb, ws, '供需信息');
    XLSX.writeFile(wb, `供需对接_${new Date().toISOString().slice(0,10)}.xlsx`);
    this._toast('✅ Excel 已导出');
  },

  // ====== 我的中心 ======
  openMyCenter() {
    document.getElementById('myCenterModal').classList.add('show');
    document.body.style.overflow = 'hidden';
    document.getElementById('myCenterError').style.display = 'none';
    if (this.currentIdentity) {
      this.showLoggedIn();
    } else {
      document.getElementById('myCenterLogin').style.display = 'block';
      document.getElementById('myCenterRegister').style.display = 'none';
      document.getElementById('myCenterRecover').style.display = 'none';
      document.getElementById('myCenterLoggedIn').style.display = 'none';
    }
  },
  closeMyCenter(e) { if (e && e.target !== document.getElementById('myCenterModal')) return; document.getElementById('myCenterModal').classList.remove('show'); document.body.style.overflow = ''; },

  showRegisterForm() {
    document.getElementById('myCenterLogin').style.display = 'none';
    document.getElementById('myCenterRegister').style.display = 'block';
    document.getElementById('myCenterRecover').style.display = 'none';
    document.getElementById('myCenterLoggedIn').style.display = 'none';
  },
  showRecoverForm() {
    document.getElementById('myCenterLogin').style.display = 'none';
    document.getElementById('myCenterRegister').style.display = 'none';
    document.getElementById('myCenterRecover').style.display = 'block';
    document.getElementById('myCenterLoggedIn').style.display = 'none';
  },
  backToMyCenterLogin() {
    document.getElementById('myCenterLogin').style.display = 'block';
    document.getElementById('myCenterRegister').style.display = 'none';
    document.getElementById('myCenterRecover').style.display = 'none';
    document.getElementById('myCenterLoggedIn').style.display = 'none';
  },

  async registerIdentity() {
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const idCard = document.getElementById('regIdCard').value.trim();
    if (!name) { this._toast('请输入真实姓名'); return; }
    if (!phone || phone.length !== 11) { this._toast('请输入11位手机号'); return; }
    if (!idCard || idCard.length !== 6) { this._toast('请输入身份证后6位'); return; }
    try {
      const result = await IdentityStore.register(name, phone, idCard);
      this.currentIdentity = result;
      // 弹窗提醒截图保存
      alert(`✅ 注册成功！\n\n您的个人ID：${result.personalId}\n姓名：${result.realName}\n手机：${result.phone}\n\n请截图保存此信息！\n后续可通过「📋 我的」→ 输入个人ID管理您的发布。`);
      // 自动返回主界面
      this.closeMyCenter();
    } catch(e) {
      document.getElementById('myCenterError').textContent = e.message;
      document.getElementById('myCenterError').style.display = 'block';
    }
  },

  async loginMyCenter() {
    const pid = document.getElementById('myCenterPid').value.trim();
    if (!pid || pid.length !== 8) { this._toast('请输入8位个人ID'); return; }
    try {
      const identity = await IdentityStore.findByPersonalId(pid);
      if (!identity) {
        document.getElementById('myCenterError').textContent = '未找到该个人ID，请检查或点击「注册身份」';
        document.getElementById('myCenterError').style.display = 'block';
        return;
      }
      this.currentIdentity = {
        personalId: identity.personal_id,
        realName: identity.real_name,
        phone: identity.phone
      };
      this.showLoggedIn();
    } catch(e) {
      this._toast('查询失败，请重试');
    }
  },

  async recoverIdentity() {
    const name = document.getElementById('recName').value.trim();
    const phone = document.getElementById('recPhone').value.trim();
    const idCard = document.getElementById('recIdCard').value.trim();
    if (!name || !phone || !idCard) { this._toast('请填写所有信息'); return; }
    try {
      const result = await IdentityStore.recover(name, phone, idCard);
      this.currentIdentity = result;
      this._toast(`✅ 找回成功！您的个人ID：${result.personalId}`);
      this.showLoggedIn();
    } catch(e) {
      document.getElementById('myCenterError').textContent = e.message;
      document.getElementById('myCenterError').style.display = 'block';
    }
  },

  showLoggedIn() {
    document.getElementById('myCenterLogin').style.display = 'none';
    document.getElementById('myCenterRegister').style.display = 'none';
    document.getElementById('myCenterRecover').style.display = 'none';
    document.getElementById('myCenterLoggedIn').style.display = 'block';
    document.getElementById('myProfileName').textContent = `👤 姓名：${this.currentIdentity.realName}`;
    document.getElementById('myProfilePhone').textContent = `📞 手机：${this.currentIdentity.phone}`;
    document.getElementById('myProfilePid').textContent = `🆔 个人ID：${this.currentIdentity.personalId}`;

    const posts = DataStore.findByPersonalId(this.currentIdentity.personalId);
    const list = document.getElementById('myPostsList');
    if (posts.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">暂无发布记录</p>';
    } else {
      let html = '';
      posts.forEach(p => {
        html += `<div class="my-post-card"><p><strong>${p.serial} ${p.type === 'request' ? '🆘 求助' : '🎁 捐赠'}</strong> · ${p.supplies}</p><p>📍 ${p.location} · 👤 ${p.name} · 📞 ${p.phone}</p><p style="color:var(--text-light);font-size:.8rem;">${p.category || ''} ${p.quantity || ''} · ${p.urgency || '一般'} · 匹配${p.matchCount}条</p><div class="my-post-actions"><button class="my-post-delete" onclick="app.deleteMyPost('${p.id}')">🗑 删除</button><button class="my-post-delete" style="border-color:var(--warm-primary);color:var(--warm-primary);" onclick="app.openEditPost('${p.id}')">✏️ 修改</button></div></div>`;
      });
      list.innerHTML = html;
    }
  },

  async deleteMyPost(id) {
    if (!confirm('确定删除这条发布吗？')) return;
    try {
      await DataStore.delete(id);
      this._toast('✅ 已删除');
      this.showLoggedIn();
      this.render();
      this.updateStats();
      this.populateRegion();
    } catch(e) {
      this._toast('删除失败');
    }
  },

  // ====== 编辑发布 ======
  _editingPostId: null,

  openEditPost(id) {
    // 先关闭我的中心，再打开编辑弹窗
    this.closeMyCenter();
    const item = DataStore.getAll().find(i => i.id === id);
    if (!item) return;
    this._editingPostId = id;
    document.getElementById('editCategory').value = item.category || '其他';
    document.getElementById('editSupplies').value = item.supplies || '';
    document.getElementById('editQuantity').value = item.quantity || '';
    document.getElementById('editUrgency').value = item.urgency || '一般';
    document.getElementById('editSituation').value = item.situation || '';
    document.getElementById('editNote').value = item.note || '';
    document.getElementById('editModal').classList.add('show');
    document.body.style.overflow = 'hidden';
  },

  closeEdit(e) {
    if (e && e.target !== document.getElementById('editModal')) return;
    document.getElementById('editModal').classList.remove('show');
    document.body.style.overflow = '';
  },

  async saveEdit() {
    const id = this._editingPostId;
    if (!id) return;
    const updates = {
      category: document.getElementById('editCategory').value,
      supplies: document.getElementById('editSupplies').value.trim(),
      quantity: document.getElementById('editQuantity').value.trim(),
      urgency: document.getElementById('editUrgency').value,
      situation: document.getElementById('editSituation').value.trim(),
      note: document.getElementById('editNote').value.trim()
    };
    if (!updates.supplies) { this._toast('物资名称不能为空'); return; }
    try {
      await DataStore.update(id, updates);
      this._toast('✅ 修改成功');
      this.closeEdit();
      this.render();
      this.updateStats();
      if (this.currentIdentity) this.showLoggedIn();
    } catch(e) {
      this._toast('修改失败，请重试');
    }
  },

  // ====== 刷新 ======
  async refresh() {
    await DataStore.init();
    this.populateProvince();
    this.populateRegion();
    MatchEngine.matchAll();
    this.render();
    this.updateStats();
    StatsBoard.update();
    this.updateShare();
    this._toast('🔄 已刷新');
  },

  // ====== 分享 ======
  updateShare() {
    const ta = document.getElementById('shareText');
    if (!ta) return;
    const siteUrl = 'https://sunmoonking.github.io/2026-Guangxi-flood/';
    const items = DataStore.getAll();
    const req = items.filter(i => i.type === 'request').length;
    const off = items.filter(i => i.type === 'offer').length;
    const matched = items.filter(i => i.matchCount > 0).length;
    ta.value = `🤝 守望相助 · 灾害供需对接平台\n\n这是一个物资信息共享平台，受灾地区（全国）和捐赠方（全国）均可自行发布物资供需信息，系统自动匹配供需双方，帮助受灾地区尽快获得所需物资。\n\n📊 当前已有 ${req} 条求助、${off} 条捐赠、${matched} 对已匹配\n\n🔗 ${siteUrl}\n\n请转发给需要的人，一起打破信息差 🙏`;
  },
  copyShare() { const ta = document.getElementById('shareText'); ta.select(); navigator.clipboard.writeText(ta.value).then(() => this._toast('📋 已复制')).catch(() => {}); },

  _toast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    Object.assign(t.style, { position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', background:'#2c3e50', color:'#fff', padding:'10px 22px', borderRadius:'8px', fontSize:'.85rem', zIndex:'2000', boxShadow:'0 4px 20px rgba(0,0,0,.2)', animation:'fadeIn .3s ease', maxWidth:'90%', textAlign:'center' });
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },

  _timeAgo(iso) {
    if (!iso) return '';
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.floor(d / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return m + '分钟前';
    const h = Math.floor(m / 60);
    if (h < 24) return h + '小时前';
    return Math.floor(h / 24) + '天前';
  }
};

document.addEventListener('keydown', e => { if (e.key === 'Escape') { app.closeModal(); app.closePublish(); app.closeMyCenter(); } });
document.addEventListener('DOMContentLoaded', () => app.init());
