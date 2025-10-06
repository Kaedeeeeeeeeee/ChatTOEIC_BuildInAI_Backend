/**
 * 应用版本号配置
 * 自动从 package.json 读取，确保版本号一致性
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取 package.json
let APP_VERSION = '3.1.0-PASSAGE-FIX-20251006'; // 默认版本

try {
  const packagePath = join(__dirname, '../../package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
  APP_VERSION = packageJson.version;
} catch (error) {
  console.warn('⚠️ Could not read version from package.json, using default:', APP_VERSION);
}

export { APP_VERSION };
