export interface ParsedUserAgent {
  browser: string
  browserVersion: string
  os: string
  osVersion: string
  device: string
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown'
}

const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|oppo|vivo|samsung|huawei|xiaomi/i
const TABLET_REGEX = /iPad|Android(?!.*Mobile)|Tablet|Kindle|Silk|PlayBook/i

const BROWSER_PATTERNS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Edge'],
  [/OPR\/([\d.]+)/, 'Opera'],
  [/Brave\/([\d.]+)/, 'Brave'],
  [/Vivaldi\/([\d.]+)/, 'Vivaldi'],
  [/SamsungBrowser\/([\d.]+)/, 'Samsung Browser'],
  [/UCBrowser\/([\d.]+)/, 'UC Browser'],
  [/MiuiBrowser\/([\d.]+)/, 'Mi Browser'],
  [/Baiduboxapp\/([\d.]+)/, 'Baidu Browser'],
  [/Iron\/([\d.]+)/, 'Iron'],
  [/PhantomJS\/([\d.]+)/, 'PhantomJS'],
  [/FacebookApp/i, 'Facebook App'],
  [/Instagram\/([\d.]+)/, 'Instagram'],
  [/Telegram[\/-]([\d.]+)/, 'Telegram'],
  [/WhatsApp\/([\d.]+)/, 'WhatsApp'],
  [/Pinterest\/([\d.]+)/, 'Pinterest'],
  [/Twitter/i, 'Twitter'],
  [/Line\/([\d.]+)/, 'LINE'],
  [/WeChat/i, 'WeChat'],
  [/WebView/i, 'WebView'],
  [/CriOS\/([\d.]+)/, 'Chrome iOS'],
  [/FxiOS\/([\d.]+)/, 'Firefox iOS'],
  [/Chrome\/([\d.]+)/, 'Chrome'],
  [/Firefox\/([\d.]+)/, 'Firefox'],
  [/Safari\/([\d.]+)/, 'Safari'],
  [/Version\/([\d.]+).*Safari/, 'Safari'],
  [/Opera[\s/]([\d.]+)/, 'Opera'],
  [/MSIE ([\d.]+);/, 'IE'],
  [/Trident\/.*rv:([\d.]+)/, 'IE'],
]

const OS_PATTERNS: [RegExp, string, string][] = [
  [/Windows NT 10\.0/, 'Windows', '10'],
  [/Windows NT 6\.3/, 'Windows', '8.1'],
  [/Windows NT 6\.2/, 'Windows', '8'],
  [/Windows NT 6\.1/, 'Windows', '7'],
  [/Windows NT 6\.0/, 'Windows', 'Vista'],
  [/Windows NT 5\.1|Windows XP/, 'Windows', 'XP'],
  [/Windows/, 'Windows', ''],
  [/Mac OS X ([\d_]+)/, 'macOS', ''],
  [/CrOS \w+ ([\d._]+)/, 'Chrome OS', ''],
  [/Android ([\d.]+)/, 'Android', ''],
  [/Linux(?![\s_]Android)/, 'Linux', ''],
  [/iPhone OS ([\d_]+)/, 'iOS', ''],
  [/iPad.*OS ([\d_]+)/, 'iOS', ''],
  [/iPhone|iPad/, 'iOS', ''],
  [/BlackBerry/, 'BlackBerry', ''],
  [/Windows Phone ([\d.]+)/, 'Windows Phone', ''],
]

const DEVICE_PATTERNS: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/iPod/, 'iPod'],
  [/Samsung[/-] ?(.*?)(?:;|\))/, 'Samsung'],
  [/Huawei[/-] ?(.*?)(?:;|\))/, 'Huawei'],
  [/Xiaomi[/-] ?(.*?)(?:;|\))/, 'Xiaomi'],
  [/OPPO[/-] ?(.*?)(?:;|\))/, 'OPPO'],
  [/Vivo[/-] ?(.*?)(?:;|\))/, 'Vivo'],
  [/OnePlus[/-] ?(.*?)(?:;|\))/, 'OnePlus'],
  [/Pixel[ _](\d+)/, 'Google Pixel'],
  [/Nexus[ _](\w+)/, 'Google Nexus'],
  [/LG[/-] ?(.*?)(?:;|\))/, 'LG'],
  [/Sony[/-] ?(.*?)(?:;|\))/, 'Sony'],
  [/Nokia[/-] ?(.*?)(?:;|\))/, 'Nokia'],
  [/Motorola[/-] ?(.*?)(?:;|\))/, 'Motorola'],
  [/Lenovo[/-] ?(.*?)(?:;|\))/, 'Lenovo'],
  [/HTC[/-] ?(.*?)(?:;|\))/, 'HTC'],
  [/Surface[ -](Pro|Go|Laptop|Book|Studio)/, 'Microsoft Surface'],
  [/MacBook/, 'MacBook'],
  [/ThinkPad/, 'ThinkPad'],
]

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) {
    return { browser: 'Unknown', browserVersion: '', os: 'Unknown', osVersion: '', device: 'Unknown', deviceType: 'unknown' }
  }

  let browser = 'Unknown'
  let browserVersion = ''
  for (const [regex, name] of BROWSER_PATTERNS) {
    const match = ua.match(regex)
    if (match) {
      browser = name
      browserVersion = match[1] || ''
      break
    }
  }

  let os = 'Unknown'
  let osVersion = ''
  for (const [regex, name, fallbackVersion] of OS_PATTERNS) {
    const match = ua.match(regex)
    if (match) {
      os = name
      if (match[1]) {
        osVersion = match[1].replace(/_/g, '.')
      } else {
        osVersion = fallbackVersion
      }
      break
    }
  }

  let device = 'Unknown'
  for (const [regex, name] of DEVICE_PATTERNS) {
    const match = ua.match(regex)
    if (match) {
      device = name
      break
    }
  }

  let deviceType: ParsedUserAgent['deviceType'] = 'desktop'
  if (TABLET_REGEX.test(ua)) {
    deviceType = 'tablet'
  } else if (MOBILE_REGEX.test(ua)) {
    deviceType = 'mobile'
  } else if (os === 'Unknown' && device === 'Unknown' && browser !== 'Unknown') {
    deviceType = 'desktop'
  }

  if (device === 'Unknown') {
    if (deviceType === 'mobile') device = 'Mobile Device'
    else if (deviceType === 'tablet') device = 'Tablet'
    else device = 'Desktop'
  }

  return { browser, browserVersion, os, osVersion, device, deviceType }
}
