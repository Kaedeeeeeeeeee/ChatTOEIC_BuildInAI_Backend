/**
 * 设备检测工具函数
 * 从 User-Agent 字符串中提取设备、浏览器和操作系统信息
 */

export interface DeviceInfo {
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browserType: string;
  osType: string;
}

/**
 * 解析 User-Agent 字符串，提取设备信息
 */
export function parseUserAgent(userAgent: string | undefined): DeviceInfo {
  if (!userAgent) {
    return {
      deviceType: 'unknown',
      browserType: 'unknown',
      osType: 'unknown'
    };
  }

  const ua = userAgent.toLowerCase();

  // 检测设备类型
  const deviceType = detectDeviceType(ua);

  // 检测浏览器类型
  const browserType = detectBrowser(ua);

  // 检测操作系统
  const osType = detectOS(ua);

  return {
    deviceType,
    browserType,
    osType
  };
}

/**
 * 检测设备类型（移动端、平板、桌面）
 */
function detectDeviceType(ua: string): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  // iPad 特殊处理（iOS 13+ 可能伪装成 Mac）
  if (ua.includes('ipad') || (ua.includes('macintosh') && 'ontouchend' in document)) {
    return 'tablet';
  }

  // 平板设备（Android tablets, Surface, Kindle）
  if (ua.includes('tablet') || ua.includes('kindle') || ua.includes('playbook') || ua.includes('silk')) {
    return 'tablet';
  }

  // 移动设备（iPhone, Android phones, Windows Phone）
  if (
    ua.includes('mobile') ||
    ua.includes('iphone') ||
    ua.includes('ipod') ||
    ua.includes('android') ||
    ua.includes('blackberry') ||
    ua.includes('windows phone') ||
    ua.includes('webos')
  ) {
    return 'mobile';
  }

  // 桌面设备（默认）
  if (ua.includes('win') || ua.includes('mac') || ua.includes('linux') || ua.includes('x11')) {
    return 'desktop';
  }

  return 'unknown';
}

/**
 * 检测浏览器类型
 */
function detectBrowser(ua: string): string {
  // Edge (Chromium-based)
  if (ua.includes('edg/')) {
    return 'edge';
  }

  // Chrome (检查顺序很重要，因为很多浏览器都包含 'chrome')
  if (ua.includes('chrome') && !ua.includes('edg')) {
    return 'chrome';
  }

  // Safari (必须在 Chrome 之后检测)
  if (ua.includes('safari') && !ua.includes('chrome')) {
    return 'safari';
  }

  // Firefox
  if (ua.includes('firefox')) {
    return 'firefox';
  }

  // Opera
  if (ua.includes('opera') || ua.includes('opr/')) {
    return 'opera';
  }

  // Internet Explorer
  if (ua.includes('trident') || ua.includes('msie')) {
    return 'ie';
  }

  // Samsung Internet
  if (ua.includes('samsungbrowser')) {
    return 'samsung';
  }

  // UC Browser
  if (ua.includes('ucbrowser')) {
    return 'uc';
  }

  return 'unknown';
}

/**
 * 检测操作系统类型
 */
function detectOS(ua: string): string {
  // iOS (iPhone, iPad, iPod)
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    return 'ios';
  }

  // Android
  if (ua.includes('android')) {
    return 'android';
  }

  // Windows
  if (ua.includes('win')) {
    if (ua.includes('windows phone')) {
      return 'windows_phone';
    }
    return 'windows';
  }

  // macOS
  if (ua.includes('mac')) {
    return 'macos';
  }

  // Linux
  if (ua.includes('linux')) {
    return 'linux';
  }

  // Chrome OS
  if (ua.includes('cros')) {
    return 'chromeos';
  }

  return 'unknown';
}

/**
 * 从请求对象中提取设备信息
 * 适配 Express Request 对象
 */
export function getDeviceInfoFromRequest(req: any): DeviceInfo {
  const userAgent = req.get('User-Agent');
  return parseUserAgent(userAgent);
}

/**
 * 获取客户端 IP 地址
 * 支持代理、负载均衡等场景
 */
export function getClientIP(req: any): string | undefined {
  // 优先从 X-Forwarded-For 获取（适用于代理/负载均衡）
  const forwarded = req.get('X-Forwarded-For');
  if (forwarded) {
    // X-Forwarded-For 可能包含多个 IP，取第一个
    return forwarded.split(',')[0].trim();
  }

  // 其他代理头
  const realIP = req.get('X-Real-IP');
  if (realIP) {
    return realIP;
  }

  // Cloudflare
  const cfConnectingIP = req.get('CF-Connecting-IP');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // 直接连接的 IP
  return req.ip || req.connection?.remoteAddress;
}

/**
 * 生成完整的登录历史记录数据
 * 用于创建 UserLoginHistory 记录
 */
export interface LoginHistoryData {
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  browserType?: string;
  osType?: string;
}

export function generateLoginHistoryData(req: any): LoginHistoryData {
  const deviceInfo = getDeviceInfoFromRequest(req);
  const ipAddress = getClientIP(req);
  const userAgent = req.get('User-Agent');

  return {
    ipAddress,
    userAgent,
    deviceType: deviceInfo.deviceType,
    browserType: deviceInfo.browserType,
    osType: deviceInfo.osType
  };
}
