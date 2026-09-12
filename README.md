# Relic

**Relic** 是一款 Windows 桌面剪贴板增强工具，基于 Tauri 2 + Rust + React 构建。它在您复制的那一刻就开始工作——自动记录文本、图片、富文本、文件，让您随时找回曾经复制过的任何内容。

> 本项目为个人自用的本地化分支，仅保留本地功能，不含任何云端同步、遥测或在线更新组件。

## 功能特性

| 功能 | 说明 |
| --- | --- |
| 剪贴板历史 | 自动记录文本 / 图片 / 富文本 / 文件，支持搜索、筛选、多选合并粘贴 |
| 收藏与分组 | 常用内容收藏、分组管理、快速文本（Quick Text） |
| 贴图到屏幕 | 桌面置顶贴图 · 拖拽缩放 · 复制 / 另存为 |
| OCR 识别 | 图片 OCR · 一键提取并复制文字 |
| 便捷粘贴 | 快捷呼出历史列表，滚动选择后直接粘贴 |
| AI 能力 | 自定义 API 接入翻译 / 处理（密钥保存在本地） |
| 应用过滤 | 按应用屏蔽剪贴板采集（密码管理器等场景） |
| 数据管理 | 自定义存储路径、导出/导入备份 zip、一键重置 |
| 低占用模式 | 精简 UI 列表形态，显著降低内存占用 |

## 环境要求

- Node.js ≥ 20
- Rust（stable，MSVC 工具链）
- Windows 10/11

## 开发与构建

```bash
npm install

# 开发模式
npm run tauri:dev

# 构建（NSIS 安装包）
npm run tauri:build

# 代码检查与测试
npm run check     # cargo check
npm run clippy    # cargo clippy
npm run test:rust # cargo test
```

## 目录结构

```
src/          React 前端（main / settings / quickpaste / preview / pinImage / textEditor）
src-tauri/    Rust 后端（services / commands / windows / plugins）
```

## License

Apache-2.0（见 [LICENSE](LICENSE)）
