/**
 * 1. 數量清洗器 (The Parser)
 * 解決：50*23R+30Y=1180Y -> 提取 1180
 */
const parseEveriseQuantity = (input: string): number => {
  if (!input) return 0;
  let str = String(input).toUpperCase().replace(/\s+/g, '');
  
  // 如果有等號，只拿等號後面的結果
  if (str.includes('=')) {
    const parts = str.split('=');
    str = parts[parts.length - 1];
  }
  
  // 移除所有 Y, R, B/Y 等單位，只留數字與小數點
  const cleanNum = str.replace(/[^0-9.-]/g, '');
  return parseFloat(cleanNum) || 0;
};

/**
 * 2. 品名翻譯機 (The Mapper)
 * 解決：Sandwich270 -> Sandwich Mesh 270G
 */
const ITEM_MAP: Record<string, string> = {
  'SANDWICH270': 'Sandwich Mesh 270G',
  'SANDWICH320': 'Sandwich Mesh 320G',
  '600D(CSK)': '600x600D 0.6MM (CSK)',
  // 系統會在這裡自動學習並記憶妳的選擇
};

const getStandardName = (rawName: string): string => {
  const key = rawName.toUpperCase().replace(/\s+/g, '');
  return ITEM_MAP[key] || rawName;
};