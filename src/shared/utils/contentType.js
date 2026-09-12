// 内容类型工具

//获取主类型（第一个逗号前的部分）
export function getPrimaryType(contentType) {
  if (!contentType) return 'text'
  return contentType.split(',')[0].trim()
}

//检查是否包含某个类型
export function hasType(contentType, type) {
  if (!contentType) return false
  return contentType.split(',').some(t => t.trim() === type)
}

