/**
 * Supabase 客户端 - 使用 REST API 直接调用
 */
const SB = {
  // 使用正确的 anon key（非 publishable key）
  url: 'https://sgkquotyoykbceztlveg.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNna3F1b3R5b3lrYmNlenRsdmVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMjU2NDAsImV4cCI6MjA5OTkwMTY0MH0.g-zVc_8ewKvpaMEd9wGRcd--538BpADe8zxqVXhH5zg',

  headers() {
    return {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  /** 查询 */
  async select(table, options = {}) {
    let query = `${this.url}/rest/v1/${table}?select=*`;
    if (options.order) query += `&order=${options.order}`;
    if (options.limit) query += `&limit=${options.limit}`;
    const res = await fetch(query, { headers: this.headers() });
    if (!res.ok) throw new Error(`查询失败: ${res.status}`);
    return res.json();
  },

  /** 按条件查询 */
  async selectBy(table, field, value, options = {}) {
    let query = `${this.url}/rest/v1/${table}?${field}=eq.${encodeURIComponent(value)}&select=*`;
    if (options.order) query += `&order=${options.order}`;
    const res = await fetch(query, { headers: this.headers() });
    if (!res.ok) throw new Error(`查询失败: ${res.status}`);
    return res.json();
  },

  /** 插入 */
  async insert(table, data) {
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`插入失败: ${res.status} - ${errText}`);
    }
    return res.json();
  },

  /** 删除 */
  async delete(table, field, value) {
    const res = await fetch(`${this.url}/rest/v1/${table}?${field}=eq.${encodeURIComponent(value)}`, {
      method: 'DELETE',
      headers: { 'apikey': this.key, 'Authorization': `Bearer ${this.key}` }
    });
    if (!res.ok && res.status !== 204) throw new Error(`删除失败: ${res.status}`);
    return true;
  },

  /** 更新 */
  async update(table, field, value, data) {
    const res = await fetch(`${this.url}/rest/v1/${table}?${field}=eq.${encodeURIComponent(value)}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`更新失败: ${res.status}`);
    return res.json();
  }
};
