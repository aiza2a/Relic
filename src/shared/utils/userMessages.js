function rawErrorMessage(error) {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  try {
    return String(error);
  } catch {
    return '';
  }
}

function hasAny(text, values) {
  return values.some((value) => text.includes(value));
}

function matchHttpStatus(raw) {
  const lower = raw.toLowerCase();
  const hasStatusContext = hasAny(lower, [
    'webdav',
    'http',
    'status',
    'unauthorized',
    'forbidden',
    'not found',
    'conflict',
    'server error',
  ]);
  if (!hasStatusContext) return 0;
  const match = raw.match(/\b(40\d|50\d)\b/);
  return match ? Number(match[1]) : 0;
}

function reasonAfterPrefix(raw) {
  const match = raw.match(/^[^:：]+[:：]\s*(.+)$/);
  return match ? match[1].trim() : '';
}

const PREFIX_RULES = [
  { patterns: ['剪贴板历史推送失败'], key: 'errors.webdav.pushClipboardFailed', fallbackKey: 'errors.webdav.operationFailed' },
  { patterns: ['收藏推送失败'], key: 'errors.webdav.pushFavoritesFailed', fallbackKey: 'errors.webdav.operationFailed' },
  { patterns: ['分组推送失败'], key: 'errors.webdav.pushGroupsFailed', fallbackKey: 'errors.webdav.operationFailed' },
  { patterns: ['删除记录推送失败', '删除状态推送失败', '删除墓碑推送失败'], key: 'errors.webdav.pushTombstonesFailed', fallbackKey: 'errors.webdav.operationFailed' },
  { patterns: ['删除记录拉取失败', '删除状态拉取失败', '删除墓碑拉取失败'], key: 'errors.webdav.pullTombstonesFailed', fallbackKey: 'errors.webdav.operationFailed' },
  { patterns: ['上传图片失败'], key: 'errors.webdav.uploadImagesFailed', fallbackKey: 'errors.webdav.operationFailed' },
  { patterns: ['文件发送任务异常'], key: 'errors.transferShelf.sendTaskFailed', fallbackKey: 'errors.transferShelf.sendFailed' },
  { patterns: ['云端上传任务异常'], key: 'errors.transferShelf.uploadTaskFailed', fallbackKey: 'errors.transferShelf.uploadFailed' },
];

const EXACT_RULES = [
  { patterns: ['WebDAV 地址不能为空'], key: 'errors.webdav.urlRequired' },
  { patterns: ['请先在设置中保存 WebDAV 密码'], key: 'errors.webdav.passwordRequired' },
  { patterns: ['请先设置 WebDAV 云端加密密码'], key: 'errors.webdav.encryptionPasswordRequired' },
  { patterns: ['WebDAV 云端加密未启用'], key: 'errors.webdav.encryptionPasswordRequired' },
  { patterns: ['WebDAV 数据解密失败', 'WebDAV 云端文件解密失败'], key: 'errors.webdav.decryptFailed' },
  { patterns: ['WebDAV 数据不是 QuickClipboard 加密格式'], key: 'errors.webdav.notEncrypted' },
  { patterns: ['WebDAV 数据加密格式不兼容', '云端文件加密格式不兼容'], key: 'errors.webdav.encryptionFormatUnsupported' },
  { patterns: ['WebDAV 云端加密配置格式不兼容', 'WebDAV 云端加密 KDF 不受支持', 'WebDAV 云端加密 KDF 参数无效'], key: 'errors.webdav.encryptionConfigInvalid' },
  { patterns: ['解析 WebDAV JSON 失败', '解析 WebDAV 加密数据失败', '编码 WebDAV 加密信封失败'], key: 'errors.webdav.cloudDataInvalid' },
  { patterns: ['云端文件不存在'], key: 'errors.webdav.cloudFileNotFound' },
  { patterns: ['云端文件 ID 无效'], key: 'errors.webdav.cloudFileInvalid' },
  { patterns: ['下载文件校验失败', '局域网文件内容校验失败', '局域网文件大小校验失败'], key: 'errors.file.checksumFailed' },
  { patterns: ['云端文件过大', '云端加密文件大小溢出'], key: 'errors.file.tooLarge' },
  { patterns: ['待上传文件大小发生变化'], key: 'errors.file.changedDuringTransfer' },
  { patterns: ['只能上传普通文件', '只能传输普通文件', '只能操作收件盒内的普通文件'], key: 'errors.file.onlyRegularFile' },
  { patterns: ['文件不存在或无法访问', '文件不存在'], key: 'errors.file.notFound' },
  { patterns: ['文件名无效', '文件名包含非法字符', '文件名编码无效'], key: 'errors.file.invalidName' },
  { patterns: ['没有可发送的文件'], key: 'errors.transferShelf.noFilesToSend' },
  { patterns: ['没有可上传的文件'], key: 'errors.transferShelf.noFilesToUpload' },
  { patterns: ['云端上传状态异常', '局域网文件校验状态异常'], key: 'errors.transferShelf.stateInvalid' },
  { patterns: ['局域网文件传输连接提前关闭'], key: 'errors.lan.connectionClosed' },
  { patterns: ['局域网接收已关闭'], key: 'errors.lan.receiveDisabled' },
  { patterns: ['未授权的局域网同步请求'], key: 'errors.lan.unauthorized' },
  { patterns: ['对方不是兼容的 QuickClipboard 同步/传输服务'], key: 'errors.lan.incompatiblePeer' },
  { patterns: ['不能配对当前设备自身'], key: 'errors.lan.selfPairing' },
  { patterns: ['配对码已刷新', '配对码已过期', '配对码尝试次数过多', '配对码不正确'], key: 'errors.lan.pairingCodeInvalid' },
  { patterns: ['只能操作收件盒管理的文件'], key: 'errors.receiveBox.unmanagedFile' },
];

const CONTAINS_RULES = [
  { patterns: ['打开待上传文件失败', '读取待上传文件信息失败'], key: 'errors.file.readFailed' },
  { patterns: ['计算文件校验值失败'], key: 'errors.file.hashFailed' },
  { patterns: ['创建下载目录失败', '创建本地下载文件失败', '保存本地下载文件失败', '替换本地下载文件失败'], key: 'errors.file.saveFailed' },
  { patterns: ['读取云端下载状态失败', '解析云端下载状态失败', '保存云端下载状态失败'], key: 'errors.webdav.localDownloadStateFailed' },
  { patterns: ['打开文件失败'], key: 'errors.file.openFailed' },
  { patterns: ['打开文件位置失败'], key: 'errors.file.revealFailed' },
  { patterns: ['删除本地文件失败'], key: 'errors.file.deleteFailed' },
  { patterns: ['读取局域网接收文件目录失败', '读取接收文件索引失败', '解析接收文件索引失败'], key: 'errors.receiveBox.listLanFailed' },
  { patterns: ['连接局域网设备失败'], key: 'errors.lan.connectFailed' },
  { patterns: ['发送局域网文件失败'], key: 'errors.lan.sendFileFailed' },
  { patterns: ['读取局域网同步数据失败', '解析局域网同步数据失败'], key: 'errors.lan.readSyncFailed' },
  { patterns: ['推送局域网同步数据失败', '解析局域网推送结果失败'], key: 'errors.lan.pushSyncFailed' },
  { patterns: ['读取 WebDAV 文件失败'], key: 'errors.webdav.readFailed' },
  { patterns: ['写入 WebDAV 文件失败'], key: 'errors.webdav.writeFailed' },
  { patterns: ['删除 WebDAV 文件失败'], key: 'errors.webdav.deleteFailed' },
  { patterns: ['创建 WebDAV 目录失败'], key: 'errors.webdav.createDirectoryFailed' },
];

function networkFallbackKey(raw, fallbackKey, type) {
  const lower = raw.toLowerCase();
  if (hasAny(raw, ['局域网']) || hasAny(lower, ['lan_error'])) {
    return 'errors.lan.connectFailed';
  }
  if (hasAny(lower, ['webdav'])) {
    return type === 'timeout' ? 'errors.webdav.timeout' : 'errors.webdav.networkFailed';
  }
  if (fallbackKey?.startsWith('errors.lan.') || fallbackKey === 'errors.transferShelf.sendFailed') {
    return 'errors.lan.connectFailed';
  }
  if (fallbackKey?.startsWith('errors.webdav.') || fallbackKey === 'errors.transferShelf.uploadFailed') {
    return type === 'timeout' ? 'errors.webdav.timeout' : 'errors.webdav.networkFailed';
  }
  return fallbackKey;
}

function matchKnownMessage(raw, t, fallbackKey) {
  const lower = raw.toLowerCase();

  for (const rule of PREFIX_RULES) {
    if (!hasAny(raw, rule.patterns)) continue;
    const reason = reasonAfterPrefix(raw);
    return t(rule.key, {
      reason: reason ? formatUserMessage(reason, t, rule.fallbackKey) : t(rule.fallbackKey),
    });
  }

  for (const rule of EXACT_RULES) {
    if (hasAny(raw, rule.patterns)) return t(rule.key);
  }

  for (const rule of CONTAINS_RULES) {
    if (hasAny(raw, rule.patterns)) return t(rule.key);
  }

  if (hasAny(lower, ['timed out', 'timeout', 'operation timed out', '请求超时'])) {
    return t(networkFallbackKey(raw, fallbackKey, 'timeout'));
  }
  if (hasAny(lower, ['connection refused', 'dns error', 'failed to lookup', 'error sending request', 'tcp connect error', 'network'])) {
    return t(networkFallbackKey(raw, fallbackKey, 'network'));
  }

  const status = matchHttpStatus(raw);
  if (status) {
    if (status === 401) return t('errors.webdav.authFailed');
    if (status === 403) return t('errors.webdav.permissionDenied');
    if (status === 404) return t('errors.webdav.notFound');
    if (status === 409) return t('errors.webdav.conflict');
    if (status === 507) return t('errors.webdav.storageFull');
    if (status >= 500) return t('errors.webdav.serverError', { status });
    if (status >= 400) return t('errors.webdav.httpFailed', { status });
  }

  return t(fallbackKey);
}

export function formatUserMessage(error, t, fallbackKey = 'errors.operationFailed') {
  const raw = rawErrorMessage(error).trim();
  if (!raw) return t(fallbackKey);
  return matchKnownMessage(raw, t, fallbackKey);
}

export function formatUserMessages(errors, t, fallbackKey = 'errors.operationFailed') {
  if (!Array.isArray(errors)) return [];
  return errors
    .map((error) => formatUserMessage(error, t, fallbackKey))
    .filter(Boolean);
}
