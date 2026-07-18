# Supabase 数据库初始化

请按以下步骤操作：

1. 打开 https://supabase.com → 登录 → 进入你的项目
2. 点击左侧菜单 **SQL Editor**（SQL编辑器）
3. 点击 **New Query**（新建查询）
4. 复制粘贴下面的 SQL 代码
5. 点击 **Run**（运行）

```sql
-- 创建用户身份表
CREATE TABLE IF NOT EXISTS identities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  real_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  id_card_last6 TEXT NOT NULL,
  personal_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建供需信息表
CREATE TABLE IF NOT EXISTS items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  personal_id TEXT NOT NULL,
  serial TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  supplies TEXT NOT NULL,
  location TEXT NOT NULL,
  phone TEXT NOT NULL,
  category TEXT DEFAULT '其他',
  quantity TEXT DEFAULT '',
  urgency TEXT DEFAULT '一般',
  situation TEXT DEFAULT '',
  note TEXT DEFAULT '',
  source TEXT DEFAULT '自发布',
  match_count INTEGER DEFAULT 0,
  match_ids TEXT DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 允许匿名用户读写
ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允许所有人读 identities" ON identities FOR SELECT USING (true);
CREATE POLICY "允许所有人插 identities" ON identities FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人读 items" ON items FOR SELECT USING (true);
CREATE POLICY "允许所有人插 items" ON items FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人删 items" ON items FOR DELETE USING (true);
```

运行成功后，告诉我结果，我开始改造代码。