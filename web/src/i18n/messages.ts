/**
 * Internationalization messages
 * Supports Japanese (ja) and English (en)
 */

const messages = {
  // Header
  'header.title': { ja: 'VMM Tracker', en: 'VMM Tracker' },

  // Preview controls
  'label.preview': { ja: 'プレビュー:', en: 'Preview:' },
  'preview.dataOnly': { ja: '表示なし', en: 'Data only' },
  'preview.landmarks': { ja: 'ランドマーク', en: 'Landmarks' },
  'preview.camera': { ja: '映像', en: 'Camera' },
  'btn.restart': { ja: 'カメラを再起動', en: 'Restart Camera' },

  // Footer
  'footer.sourceGithub': { ja: 'Source (GitHub)', en: 'Source (GitHub)' },
  'footer.licenses': { ja: 'Licenses', en: 'Licenses' },
  'footer.privacyPolicy': { ja: 'Privacy Policy', en: 'Privacy Policy' },

  // Connection status
  'status.noQr': { ja: 'QRコードから開いてください', en: 'Open via QR code' },
  'status.connected': { ja: '接続済み', en: 'Connected' },
  'status.connectionFailed': { ja: '接続失敗', en: 'Connection failed' },
  'status.connectionPrefix': { ja: '接続: ', en: 'Connection: ' },

  // Connection modal
  'modal.connecting': { ja: '接続中...', en: 'Connecting...' },
  'modal.connectionReady': { ja: '接続の準備ができました。', en: 'Connection ready.' },
  'modal.sendingAnswer': { ja: '応答を送信中...', en: 'Sending response...' },
  'modal.connectionFailed': {
    ja: '接続に失敗しました: {error}\n\nQRコードを再スキャンするか、閉じてローカルプレビューを使用してください。',
    en: 'Connection failed: {error}\n\nPlease re-scan the QR code or close to use local preview.'
  },
  'modal.initialInfo': {
    ja: 'PCのQRコードをスキャンして接続してください。\nこのまま続けるとローカルプレビューのみ使用できます。',
    en: 'Scan the QR code on your PC to connect.\nContinue without scanning to use local preview only.'
  },
  'btn.setupConnection': { ja: '接続先をセットアップ', en: 'Set up connection' },
  'consent.message': {
    ja: '接続先をセットアップすると <a href="privacy-policy.html" target="_blank" rel="noopener noreferrer" style="color: #007bff;">プライバシーポリシー (Privacy Policy)</a> に同意したことになります',
    en: 'By setting up a connection, you agree to the <a href="privacy-policy.html" target="_blank" rel="noopener noreferrer" style="color: #007bff;">Privacy Policy</a>'
  },

  // Camera errors
  'error.cameraNotAllowed': {
    ja: 'カメラの使用が許可されていません。ブラウザの設定からカメラへのアクセスを許可してください。',
    en: 'Camera access was denied. Please allow camera access in your browser settings.'
  },

  // Tracking status
  'tracking.success': { ja: 'トラッキング中', en: 'Tracking' },
  'tracking.noFace': { ja: '顔未検出', en: 'No face detected' },

  // Data labels
  'data.position': { ja: '位置 (cm):', en: 'Pos (cm):' },
  'data.rotation': { ja: '姿勢(deg):', en: 'Rot(deg):' },

  // Modal button
  'btn.ok': { ja: 'OK', en: 'OK' },
} satisfies Record<string, { ja: string; en: string }>;

type MessageKey = keyof typeof messages;

let currentLang: 'ja' | 'en' = 'en';

/**
 * Detect language from browser settings
 */
function detectLanguage(): 'ja' | 'en' {
  const lang = navigator.language;
  return lang.startsWith('ja') ? 'ja' : 'en';
}

// Initialize language on module load
currentLang = detectLanguage();

/**
 * Get current language
 */
export function getLanguage(): 'ja' | 'en' {
  return currentLang;
}

/**
 * Set language explicitly
 */
export function setLanguage(lang: 'ja' | 'en'): void {
  currentLang = lang;
}

/**
 * Get translated message
 * Supports {placeholder} replacement via params
 */
export function t(key: MessageKey, params?: Record<string, string>): string {
  const entry = messages[key];
  let text = entry[currentLang];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}
