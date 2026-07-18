/**
 * 匹配引擎 - 供需自动匹配
 * 关键词 + 同义词 + 地区 + 紧急程度加权
 */

const MatchEngine = {
  synonyms: {
    '消毒液': ['84消毒液','消毒水','漂白水','含氯消毒剂'],
    '漂白粉': ['漂白精','消毒粉'],
    '口罩': ['医用口罩','N95','防护口罩'],
    '饮用水': ['矿泉水','纯净水','瓶装水','水'],
    '方便面': ['泡面','速食面','方便面'],
    '蜡烛': ['应急灯','照明'],
    '救生衣': ['救生圈','浮力衣'],
    '帐篷': ['帐篷','遮阳棚'],
    '睡袋': ['被褥','被子','棉被'],
    '药品': ['药','感冒药','消炎药','退烧药','药物'],
    '发电机': ['发电机组','柴油发电机','汽油发电机'],
    '水泵': ['抽水机','排水泵','潜水泵'],
    '棉被': ['被子','毛毯','被褥','毯子'],
    '衣物': ['衣服','外套','裤子','鞋子','雨鞋'],
    '大米': ['米','粮食','大米'],
    '食用油': ['油','菜籽油','花生油'],
  },

  categories: {
    '消毒': ['消毒液','漂白粉','酒精','84'],
    '食品': ['饮用水','方便面','大米','食用油','食盐','食品','食物'],
    '救援': ['救生衣','安全绳','手电筒','救生圈'],
    '住宿': ['帐篷','睡袋','防潮垫','棉被','被褥'],
    '排水': ['发电机','水泵','排水管','排水泵'],
    '医疗': ['药品','感冒药','消炎药','创可贴','口罩'],
    '生活': ['衣物','棉被','雨鞋','蜡烛'],
  },

  urgencyWeight: { '特急': 20, '紧急': 10, '一般': 0 },

  /** 执行全量匹配 */
  matchAll() {
    const requests = DataStore.getByType('request');
    const offers = DataStore.getByType('offer');
    const matches = [];

    requests.forEach(req => {
      const reqKw = this._extractKw(req.supplies);
      offers.forEach(off => {
        const offKw = this._extractKw(off.supplies);
        const score = this._calcScore(reqKw, offKw, req.location, off.location, req.urgency);
        if (score > 0) {
          matches.push({
            requestId: req.id,
            offerId: off.id,
            score,
            requestSupplies: req.supplies,
            offerSupplies: off.supplies,
            requestLocation: req.location,
            offerLocation: off.location,
            requestContact: req.name,
            requestPhone: req.phone,
            offerContact: off.name,
            offerPhone: off.phone,
            sameRegion: req.location.split(/[·•·\s]/)[0] === off.location.split(/[·•·\s]/)[0]
          });
        }
      });
    });

    matches.sort((a, b) => b.score - a.score);

    // 构建 matchMap
    const matchMap = {};
    DataStore.getAll().forEach(item => { matchMap[item.id] = { count: 0, ids: [] }; });
    matches.forEach(m => {
      if (matchMap[m.requestId]) {
        matchMap[m.requestId].count++;
        matchMap[m.requestId].ids.push(m.offerId);
      }
      if (matchMap[m.offerId]) {
        matchMap[m.offerId].count++;
        matchMap[m.offerId].ids.push(m.requestId);
      }
    });

    DataStore.updateAllMatches(matchMap);
    return matches;
  },

  /** 为指定项查找匹配 */
  findMatchesFor(itemId) {
    const item = DataStore.getAll().find(i => i.id === itemId);
    if (!item) return [];
    const isReq = item.type === 'request';
    const candidates = DataStore.getAll().filter(i => i.type !== item.type && i.id !== itemId);
    const itemKw = this._extractKw(item.supplies);
    const results = [];

    candidates.forEach(c => {
      const cKw = this._extractKw(c.supplies);
      const score = this._calcScore(itemKw, cKw, item.location, c.location, item.urgency);
      if (score > 0) {
        results.push({
          matchedItem: c,
          score,
          direction: isReq ? '🎁 可提供帮助的' : '🆘 需要帮助的',
          sameRegion: item.location.split(/[·•·\s]/)[0] === c.location.split(/[·•·\s]/)[0]
        });
      }
    });
    return results.sort((a, b) => b.score - a.score);
  },

  _extractKw(str) {
    if (!str) return [];
    const tokens = str.split(/[、，,、/\s]+/);
    const kws = [];
    tokens.forEach(t => {
      const trimmed = t.trim();
      if (!trimmed) return;
      kws.push(trimmed);
      const paren = trimmed.match(/[（(](.+?)[）)]/);
      if (paren) paren[1].split(/[、,，]/).forEach(k => kws.push(k.trim()));
    });
    return [...new Set(kws.map(k => k.toLowerCase()))];
  },

  _calcScore(reqKw, offKw, reqLoc, offLoc, urgency) {
    let score = 0;

    // 1. 直接匹配
    reqKw.forEach(rk => offKw.forEach(ok => {
      if (rk.includes(ok) || ok.includes(rk)) score += 10;
    }));

    // 2. 同义词
    reqKw.forEach(rk => offKw.forEach(ok => {
      const rks = this.synonyms[rk] || [];
      const oks = this.synonyms[ok] || [];
      if (rks.includes(ok) || oks.includes(rk)) score += 8;
      if (rks.filter(s => oks.includes(s)).length > 0) score += 6;
    }));

    // 3. 类别匹配
    reqKw.forEach(rk => offKw.forEach(ok => {
      for (const [, items] of Object.entries(this.categories)) {
        if (items.some(item => rk.includes(item) || item.includes(rk)) &&
            items.some(item => ok.includes(item) || item.includes(ok)) && rk !== ok) {
          score += 5; break;
        }
      }
    }));

    // 4. 地区加分
    if (reqLoc && offLoc) {
      const rr = reqLoc.split(/[·•·\s]/)[0].trim();
      const or = offLoc.split(/[·•·\s]/)[0].trim();
      if (rr === or) score += 15;
      else if (rr.slice(0,2) === or.slice(0,2)) score += 8;
    }

    // 5. 紧急程度加权
    if (urgency && this.urgencyWeight[urgency]) {
      score += this.urgencyWeight[urgency];
    }

    return score;
  }
};