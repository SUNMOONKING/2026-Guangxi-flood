/**
 * 数据存储 - Supabase 云端（替代 localStorage）
 * 所有数据存到云端，手机和电脑数据互通
 */
const DataStore = {
  items: [],
  _nextSerial: 1,
  _allItemsLoaded: false,

  /** 初始化：从云端加载全部数据 */
  async init() {
    try {
      const items = await SB.select('items', { order: 'created_at.desc' });
      this.items = items.map(item => this._formatItem(item));
      this._allItemsLoaded = true;
      // 计算下一个编号（兼容 #001 和 A001/B001 两种格式）
      if (this.items.length > 0) {
        const maxSerial = Math.max(...this.items.map(i => {
          const num = parseInt(i.serial.replace(/^[A-B]#?/, ''));
          return isNaN(num) ? 0 : num;
        }));
        this._nextSerial = maxSerial + 1;
      }
      return this.items;
    } catch (e) {
      console.error('数据加载失败:', e);
      this.items = [];
      return [];
    }
  },

  _formatItem(item) {
    return {
      id: String(item.id),
      serial: item.serial || '#000',
      personal_id: item.personal_id || '',
      type: item.type,
      name: item.name,
      supplies: item.supplies,
      location: item.location,
      phone: item.phone,
      category: item.category || '其他',
      quantity: item.quantity || '',
      urgency: item.urgency || '一般',
      situation: item.situation || '',
      note: item.note || '',
      source: item.source || '自发布',
      matchCount: item.match_count || 0,
      matchIds: this._parseMatchIds(item.match_ids),
      createdAt: item.created_at
    };
  },

  _parseMatchIds(str) {
    if (!str) return [];
    try { return JSON.parse(str); } catch { return []; }
  },

  _makeMatchIds(arr) {
    return JSON.stringify(arr || []);
  },

  /** 生成编号：求助 A001, A002... 捐赠 B001, B002... */
  _genSerial(type) {
    const n = this._nextSerial++;
    const prefix = type === 'request' ? 'A' : 'B';
    return prefix + String(n).padStart(3, '0');
  },

  /** 获取全部 */
  getAll() { return [...this.items]; },

  /** 按类型获取 */
  getByType(type) { return this.items.filter(i => i.type === type); },

  /** 添加一条（云端） */
  async add(item) {
    item.serial = this._genSerial(item.type);
    const record = {
      personal_id: item.personal_id || '',
      serial: item.serial,
      type: item.type,
      name: item.name || '匿名',
      supplies: item.supplies,
      location: item.location,
      phone: item.phone,
      category: item.category || '其他',
      quantity: item.quantity || '',
      urgency: item.urgency || '一般',
      situation: item.situation || '',
      note: item.note || '',
      source: item.source || '自发布',
      match_count: 0,
      match_ids: '[]'
    };
    try {
      const result = await SB.insert('items', record);
      const newItem = this._formatItem(result[0] || result);
      this.items.unshift(newItem);
      return newItem;
    } catch (e) {
      console.error('发布失败:', e);
      throw e;
    }
  },

  /** 更新（修改） */
  async update(id, updates) {
    try {
      await SB.update('items', 'id', id, updates);
      const item = this.items.find(i => i.id === id);
      if (item) {
        if (updates.category !== undefined) item.category = updates.category;
        if (updates.supplies !== undefined) item.supplies = updates.supplies;
        if (updates.quantity !== undefined) item.quantity = updates.quantity;
        if (updates.urgency !== undefined) item.urgency = updates.urgency;
        if (updates.situation !== undefined) item.situation = updates.situation;
        if (updates.note !== undefined) item.note = updates.note;
      }
      return true;
    } catch(e) { throw e; }
  },

  /** 删除 */
  async delete(id) {
    try {
      await SB.delete('items', 'id', id);
      this.items = this.items.filter(i => i.id !== id);
    } catch (e) {
      console.error('删除失败:', e);
      throw e;
    }
  },

  /** 按个人ID查找发布 */
  findByPersonalId(personalId) {
    return this.items.filter(i => i.personal_id === personalId);
  },

  /** 更新匹配数据（本地 + 云端） */
  async updateAllMatches(matchMap) {
    this.items.forEach(item => {
      if (matchMap[item.id]) {
        item.matchCount = matchMap[item.id].count || 0;
        item.matchIds = matchMap[item.id].ids || [];
      } else {
        item.matchCount = 0;
        item.matchIds = [];
      }
    });
    // 异步更新云端（不阻塞）
    for (const [id, data] of Object.entries(matchMap)) {
      try {
        await SB.update('items', 'id', id, {
          match_count: data.count || 0,
          match_ids: JSON.stringify(data.ids || [])
        });
      } catch(e) {}
    }
  },

  /** 统计 */
  getStats() {
    const r = this.items.filter(i => i.type === 'request').length;
    const o = this.items.filter(i => i.type === 'offer').length;
    const m = this.items.filter(i => i.matchCount > 0).length;
    const p = this.items.filter(i => i.matchCount === 0).length;
    return { requests: r, offers: o, matched: m, pending: p, total: this.items.length };
  },

  /** 地区列表 */
  getRegions() {
    const s = new Set();
    this.items.forEach(i => {
      const r = i.location.split(/[·•·\s]/)[0].trim();
      if (r) s.add(r);
    });
    return Array.from(s).sort((a,b) => {
      const ag = a.startsWith('广西') ? 0 : 1;
      const bg = b.startsWith('广西') ? 0 : 1;
      return ag !== bg ? ag - bg : a.localeCompare(b, 'zh-CN');
    });
  },

  /** 分类统计 */
  getCategoryStats() {
    const cats = {};
    const allCats = ['消毒类','食品类','救援类','住宿类','排水类','医疗类','生活类','其他'];
    allCats.forEach(c => cats[c] = { request: 0, offer: 0 });
    this.items.forEach(i => {
      const c = i.category || '其他';
      if (!cats[c]) cats[c] = { request: 0, offer: 0 };
      cats[c][i.type]++;
    });
    return cats;
  },

  /** 按县统计 */
  getCountyStats() {
    const map = {};
    this.items.forEach(i => {
      const county = extractCounty(i.location);
      if (!county) return;
      if (!map[county]) map[county] = { request: 0, offer: 0, items: [] };
      map[county][i.type]++;
      map[county].items.push(i);
    });
    return map;
  },

  /** 近7天趋势 */
  getDailyTrend() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const count = this.items.filter(item => {
        const c = item.createdAt ? item.createdAt.slice(0,10) : '';
        return c === key;
      }).length;
      days.push({ date: key.slice(5), count });
    }
    return days;
  }
};

// ====== 身份系统（Supabase） ======
const IdentityStore = {
  /** 注册身份 */
  async register(realName, phone, idCardLast6) {
    // 检查手机号是否已注册
    const existing = await SB.selectBy('identities', 'phone', phone);
    if (existing && existing.length > 0) {
      throw new Error('该手机号已注册，请使用个人ID登录或找回');
    }
    // 生成个人ID：手机尾号后4位 + 身份证后4位
    const phoneSuffix = phone.slice(-4);
    const idSuffix = idCardLast6.slice(-4);
    const personalId = phoneSuffix + idSuffix;
    
    const record = {
      real_name: realName,
      phone: phone,
      id_card_last6: idCardLast6,
      personal_id: personalId
    };
    await SB.insert('identities', record);
    return { personalId, realName, phone };
  },

  /** 通过个人ID查找身份 */
  async findByPersonalId(personalId) {
    const result = await SB.selectBy('identities', 'personal_id', personalId);
    return result && result.length > 0 ? result[0] : null;
  },

  /** 找回个人ID：验证 姓名+手机+身份证后6位 */
  async recover(realName, phone, idCardLast6) {
    const result = await SB.selectBy('identities', 'phone', phone);
    if (!result || result.length === 0) {
      throw new Error('未找到该手机号的注册信息');
    }
    const identity = result[0];
    if (identity.real_name !== realName || identity.id_card_last6 !== idCardLast6) {
      throw new Error('姓名或身份证信息不匹配');
    }
    return {
      personalId: identity.personal_id,
      realName: identity.real_name,
      phone: identity.phone
    };
  }
};
