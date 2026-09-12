// 将错误转换为用户可读消息；未知错误直接展示原始信息，空消息回退到通用提示
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

export function formatUserMessage(error, t, fallbackKey = 'errors.operationFailed') {
  const raw = rawErrorMessage(error).trim();
  return raw || t(fallbackKey);
}

export function formatUserMessages(errors, t, fallbackKey = 'errors.operationFailed') {
  if (!Array.isArray(errors)) return [];
  return errors
    .map((error) => formatUserMessage(error, t, fallbackKey))
    .filter(Boolean);
}
