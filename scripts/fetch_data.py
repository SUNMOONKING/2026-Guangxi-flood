"""
广西洪灾物资供需数据采集脚本
=================================
功能：从公开信息源（小红书话题、在线文档等）抓取物资供需信息，
      用 AI 提取结构化数据，写入 Airtable / Supabase / JSON 文件。

使用方式：
  python scripts/fetch_data.py                     # 默认运行
  python scripts/fetch_data.py --dry-run           # 仅预览，不写入
  python scripts/fetch_data.py --source xiaohongshu # 指定来源

部署：可配置 GitHub Actions 定时运行（见 .github/workflows/fetch.yml）
"""

import os
import json
import hashlib
import argparse
import re
from datetime import datetime, timezone
from typing import List, Dict, Optional

# ==================== 配置 ====================
# 输出文件路径（前端 data.js 可直接读取的 JSON）
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'latest.json')

# 数据存储模式：'json' | 'airtable' | 'supabase'
STORAGE_MODE = 'json'

# Airtable 配置（使用时可填写）
AIRTABLE_API_KEY = os.environ.get('AIRTABLE_API_KEY', '')
AIRTABLE_BASE_ID = os.environ.get('AIRTABLE_BASE_ID', '')
AIRTABLE_TABLE_NAME = 'Items'

# ==================== LLM 信息提取 ====================

SYSTEM_PROMPT = """你是一个专门从中文社交媒体帖子中提取物资信息的AI助手。
请从给定文本中提取以下信息，以JSON格式输出：

{
  "type": "request" 或 "offer",
  "supplies": "物资名称列表，用顿号分隔",
  "quantity": "数量描述（如没有则填null）",
  "location": "地点（省/市/县/乡）",
  "contact": "联系人名称",
  "phone": "联系电话",
  "note": "补充说明（如没有则填null）",
  "source_url": "帖子链接（如没有则填null）"
}

规则：
- type: 如果对方在求助/需要物资，填"request"；如果对方在提供/捐赠，填"offer"
- supplies: 提取所有提到的物资，用中文顿号分隔
- quantity: 如果有数量信息请提取，没有则null
- location: 尽可能精确到乡镇级别
- contact: 提取联系人名字
- phone: 提取完整电话号码
- note: 保留其他重要信息
- 如果文本中没有某字段信息，对应字段填null
- 只输出JSON，不要其他文字"""


def extract_with_llm(text: str) -> Optional[Dict]:
    """
    调用 LLM API 从文本中提取结构化信息。
    默认使用 DeepSeek API，也可替换为 OpenAI/Claude。
    """
    api_key = os.environ.get('DEEPSEEK_API_KEY', '')
    if not api_key:
        # 没有 API key 时使用正则回退
        return extract_with_regex(text)
    
    try:
        import requests
        resp = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'deepseek-chat',
                'messages': [
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    {'role': 'user', 'content': text}
                ],
                'temperature': 0.1,
                'max_tokens': 500
            },
            timeout=30
        )
        data = resp.json()
        content = data['choices'][0]['message']['content']
        # 提取 JSON 部分
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"[WARN] LLM 调用失败: {e}，使用正则回退")
    
    return extract_with_regex(text)


def extract_with_regex(text: str) -> Optional[Dict]:
    """使用正则表达式提取信息（无需 API key 的回退方案）"""
    result = {
        'type': None,
        'supplies': None,
        'quantity': None,
        'location': None,
        'contact': None,
        'phone': None,
        'note': None,
        'source_url': None
    }
    
    # 判断类型：求助 vs 捐赠
    request_patterns = ['急需', '求助', '需要', '求帮忙', '谁能提供', '救急', '缺']
    offer_patterns = ['捐赠', '提供', '可捐', '有货', '余货', '能帮', '可以送', '免费']
    
    for p in request_patterns:
        if p in text:
            result['type'] = 'request'
            break
    
    if not result['type']:
        for p in offer_patterns:
            if p in text:
                result['type'] = 'offer'
                break
    
    # 提取联系电话
    phone_patterns = [
        r'1[3-9]\d{9}',           # 11位手机号
        r'1[3-9]\d{4}.*?\d{4}',   # 带空格的手机号
        r'\d{3,4}[-]?\d{7,8}',    # 座机
    ]
    for pattern in phone_patterns:
        match = re.search(pattern, text)
        if match:
            result['phone'] = match.group().replace(' ', '').replace('-', '')
            break
    
    # 提取联系人
    contact_patterns = [
        r'联系人[：:]\s*(\S{2,4})',
        r'(\S{2,4})(?:先生|女士|小姐|大哥|大姐|同学)',
    ]
    for pattern in contact_patterns:
        match = re.search(pattern, text)
        if match:
            result['contact'] = match.group(1)
            break
    
    # 提取物资关键词
    supply_keywords = [
        '漂白粉', '消毒液', '84', '口罩', '饮用水', '矿泉水', '方便面',
        '蜡烛', '救生衣', '安全绳', '手电筒', '帐篷', '睡袋', '防潮垫',
        '发电机', '水泵', '排水管', '药品', '感冒药', '消炎药', '创可贴',
        '棉被', '衣物', '雨鞋', '大米', '食用油', '食盐', '面包', '饼干'
    ]
    found_supplies = []
    for kw in supply_keywords:
        if kw in text:
            found_supplies.append(kw)
    if found_supplies:
        result['supplies'] = '、'.join(found_supplies[:8])  # 最多8种
    
    # 提取地点
    location_patterns = [
        r'(广西[^，\s]{2,10}(?:市|县|区|乡|镇|村))',
        r'([\u4e00-\u9fff]{2,4}(?:市|县|区)[\u4e00-\u9fff]{1,4}(?:乡|镇|村))',
    ]
    for pattern in location_patterns:
        match = re.search(pattern, text)
        if match:
            result['location'] = match.group(1)
            break
    
    # 提取数量
    qty_pattern = r'(\d+)\s*(?:箱|件|袋|瓶|台|顶|床|只|条|桶)'
    qty_matches = re.findall(qty_pattern, text)
    if qty_matches:
        total = sum(int(x) for x in qty_matches)
        result['quantity'] = f'约{total}件'
    
    # 保留原文本作为备注
    result['note'] = text[:200] if len(text) > 200 else text
    
    # 验证必要字段
    if result['type'] and result['supplies']:
        return result
    
    return None


# ==================== 信息源采集 ====================

class XiaoHongShuScraper:
    """小红书帖子采集器（模拟）"""
    
    SEARCH_TOPICS = [
        '广西洪水求助',
        '广西物资求助',
        '广西洪灾捐赠',
    ]
    
    def fetch_posts(self, topic: str, limit: int = 10) -> List[str]:
        """
        采集指定话题下的帖子。
        实际使用时需要替换为真实的爬虫或 RSSHub 调用。
        """
        # TODO: 替换为真实的小红书数据源
        # 方案A：用 RSSHub 的小红书路由
        # url = f'https://rsshub.app/xiaohongshu/search/{topic}'
        # resp = requests.get(url)
        # ...
        
        # 方案B：用浏览器自动化（Playwright/Selenium）
        # ...
        
        # 方案C：手动维护的共享文档
        # ...
        
        print(f"[INFO] 正在采集话题: {topic}")
        return []


def fetch_from_shared_doc() -> List[str]:
    """
    从共享文档（腾讯文档/金山文档）获取数据。
    实际使用时替换为文档的导出 API 或截图 OCR。
    """
    # TODO: 对接共享文档
    return []


def fetch_mock_data() -> List[Dict]:
    """生成模拟测试数据（开发阶段使用）"""
    posts = [
        "急需漂白粉和84消毒液，村里水井被淹了，横州市镇龙乡，联系人黄先生，电话13812345678",
        "求助：饮用水和方便面，贵港市港北区，家中被淹，三口人急需食物，李女士13987654321",
        "我有84消毒液50箱和口罩2000只可以捐赠，在南宁市青秀区，王先生13711112222",
        "可以提供饮用水100箱和方便面80箱，南宁市兴宁区，张女士13633334444",
        "救生衣30件安全绳20条，户外俱乐部库存，贵港市港南区，赵女士18855556666",
        "求助：发电机水泵排水管，村子积水严重急需排水设备，梧州市苍梧县，周先生15577778888",
        "家里被淹急需棉被衣物雨鞋，贺州市昭平县，林先生13899990000",
        "求助：帐篷睡袋防潮垫，房屋倒塌一家五口住安置点，桂林市阳朔县，刘女士13600001111",
        "我有大米100袋食用油50桶可以捐赠，南宁市西乡塘区，郑先生13722223333",
        "求助：药品感冒药消炎药创可贴，安置点很多人感冒，柳州市融安县，杨先生15044445555",
    ]
    results = []
    for post in posts:
        extracted = extract_with_regex(post)
        if extracted:
            extracted['source'] = '小红书'
            extracted['source_url'] = 'https://www.xiaohongshu.com/mock'
            results.append(extracted)
    return results


# ==================== 数据存储 ====================

class DataStorage:
    """数据存储接口"""
    
    @staticmethod
    def save_to_json(items: List[Dict], filepath: str):
        """保存为 JSON 文件"""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        output = {
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'count': len(items),
            'items': items
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"[OK] 已保存 {len(items)} 条数据到 {filepath}")
    
    @staticmethod
    def save_to_airtable(items: List[Dict]):
        """保存到 Airtable"""
        if not AIRTABLE_API_KEY or not AIRTABLE_BASE_ID:
            print("[WARN] Airtable 未配置，跳过")
            return
        
        try:
            import requests
            url = f'https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE_NAME}'
            headers = {
                'Authorization': f'Bearer {AIRTABLE_API_KEY}',
                'Content-Type': 'application/json'
            }
            
            # 批量写入，每批10条
            for i in range(0, len(items), 10):
                batch = items[i:i+10]
                records = {
                    'records': [{
                        'fields': {
                            'Type': item.get('type'),
                            'Supplies': item.get('supplies'),
                            'Quantity': item.get('quantity'),
                            'Location': item.get('location'),
                            'Contact': item.get('contact'),
                            'Phone': item.get('phone'),
                            'Note': item.get('note'),
                            'Source': item.get('source'),
                            'SourceUrl': item.get('source_url'),
                        }
                    } for item in batch]
                }
                resp = requests.post(url, headers=headers, json=records)
                print(f"[OK] Airtable 写入 {len(batch)} 条: {resp.status_code}")
        except Exception as e:
            print(f"[ERROR] Airtable 写入失败: {e}")


# ==================== 主流程 ====================

def generate_item_id(item: Dict) -> str:
    """生成唯一 ID"""
    key = f"{item.get('type')}|{item.get('supplies')}|{item.get('phone')}|{item.get('location')}"
    return 'fm_' + hashlib.md5(key.encode()).hexdigest()[:12]


def process_pipeline(items: List[Dict]) -> List[Dict]:
    """处理管线：去重、格式化、生成 ID"""
    seen = set()
    processed = []
    
    for item in items:
        if not item or not item.get('type') or not item.get('supplies'):
            continue
        
        item['id'] = generate_item_id(item)
        item['matchCount'] = 0
        item['matchIds'] = []
        
        # 去重
        dedup_key = f"{item['type']}|{item['supplies']}|{item.get('phone')}"
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        
        processed.append(item)
    
    return processed


def main():
    parser = argparse.ArgumentParser(description='广西洪灾物资供需数据采集脚本')
    parser.add_argument('--dry-run', action='store_true', help='仅预览，不写入存储')
    parser.add_argument('--source', choices=['xiaohongshu', 'mock', 'doc'], default='mock',
                       help='数据来源')
    args = parser.parse_args()
    
    print("=" * 50)
    print("广西洪灾 · 物资供需数据采集")
    print(f"模式: {'🧪 预览模式 (dry-run)' if args.dry_run else '🚀 正式运行'}")
    print(f"来源: {args.source}")
    print("=" * 50)
    
    # 1. 采集原始数据
    items = []
    if args.source == 'mock':
        print("[INFO] 使用模拟数据（开发测试用）")
        items = fetch_mock_data()
    elif args.source == 'xiaohongshu':
        scraper = XiaoHongShuScraper()
        for topic in scraper.SEARCH_TOPICS:
            posts = scraper.fetch_posts(topic)
            for post in posts:
                extracted = extract_with_llm(post)
                if extracted:
                    extracted['source'] = '小红书'
                    items.append(extracted)
    
    # 2. 处理数据
    processed = process_pipeline(items)
    
    # 3. 输出统计
    requests = [i for i in processed if i['type'] == 'request']
    offers = [i for i in processed if i['type'] == 'offer']
    print(f"\n📊 采集结果:")
    print(f"   总计: {len(processed)} 条")
    print(f"   求助: {len(requests)} 条")
    print(f"   捐赠: {len(offers)} 条")
    
    # 4. 保存
    if not args.dry_run:
        if STORAGE_MODE == 'json':
            DataStorage.save_to_json(processed, OUTPUT_FILE)
        elif STORAGE_MODE == 'airtable':
            DataStorage.save_to_airtable(processed)
        # 同时也保存为 JSON（前端兼容）
        DataStorage.save_to_json(processed, OUTPUT_FILE)
    else:
        print(f"\n预览前 {min(5, len(processed))} 条:")
        for item in processed[:5]:
            print(f"  [{item['type']}] {item['supplies']} | {item.get('location')} | {item.get('contact')} {item.get('phone')}")
    
    print("\n✅ 完成!")


if __name__ == '__main__':
    main()