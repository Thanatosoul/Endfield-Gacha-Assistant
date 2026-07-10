# Endfield Gacha Assistant

![Windows](https://img.shields.io/badge/Windows-11%2F10-blue?logo=windows)
![macOS](https://img.shields.io/badge/macOS-11%2B-white?logo=apple)
![Linux](https://img.shields.io/badge/Linux-x86__64-orange?logo=linux)
[![Release](https://img.shields.io/github/v/release/Thanatosoul/Endfield-Gacha-Assistant?logo=github)](https://github.com/Thanatosoul/Endfield-Gacha-Assistant/releases/latest)
[![License](https://img.shields.io/github/license/Thanatosoul/Endfield-Gacha-Assistant)](LICENSE)

明日方舟：终末地（Arknights: Endfield）抽卡记录管理工具。通过官方 API 同步抽卡数据，支持森空岛每日签到、统计分析和多端数据备份。

## 功能

- **官方同步** — 通过森空岛 HG API 同步抽卡记录，支持角色 / 武器池分页拉取与增量去重
- **每日签到** — 一键完成森空岛明日方舟 & 终末地的每日签到
- **抽卡统计** — 六星出率、保底计数、UP 命中率、角色 / 武器分池统计等可视化概览
- **卡池浏览器** — 查看卡池元数据（名称、UP 角色、物品列表），支持编辑
- **资源同步与离线缓存** — 启动后后台检查卡池资源；图片优先读取本地缓存，断网仍可浏览已同步资源
- **数据导入/导出** — JSON 全量迁移（含旧版格式自动转换） & CSV 导入导出
- **WebDAV 备份** — 将数据备份至自建 WebDAV 服务器，支持列举 / 恢复历史备份
- **安全存储** — Token 使用 AES-256-CBC 设备指纹加密，仅本地可解密
- **便携式设计** — 所有数据存储在程序目录 `data/` 下，无需安装绿色运行
- **自动更新** — 内置 Tauri updater，启动时自动检测新版本
- **跨平台** — Windows（NSIS / MSI）、macOS（DMG）、Linux（AppImage / deb）

## Token 获取指引

工具需要你的鹰角网络通行证凭证（Token）来调用官方 API：

1. **登录森空岛** — 访问 [https://www.skland.com/](https://www.skland.com/) 并登录
2. **获取 Token** — 在已登录状态下访问 [https://web-api.skland.com/account/info/hg](https://web-api.skland.com/account/info/hg)
3. **填入** — 页面返回 JSON 中 `data.content` 的值即为 Token，填入程序的「账号」页面

> Token 经 AES-256-CBC 设备指纹加密后仅本地可解密，请勿泄露给他人。

## 下载

从 [Releases](https://github.com/Thanatosoul/Endfield-Gacha-Assistant/releases/latest) 页面下载最新版本。

| 平台 | 格式 |
|------|------|
| Windows | `.exe` (NSIS 安装包) / `.msi` |
| macOS | `.dmg` |
| Linux | `.AppImage` / `.deb` |

应用内置自动更新，启动时自动检测并提示更新。

## 开发

### 前置要求

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/) (stable, edition 2021)
- Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)（C++ 桌面开发工作负荷）

### 技术栈

- **前端**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + React Router 7
- **后端**: Tauri v2 (Rust) + SQLite (via `tauri-plugin-sql`)
- **桌面 API**: Tauri 插件 (dialog / fs / http / opener / updater)
- **加密**: CryptoJS (AES-256-CBC) + 设备指纹
- **测试**: Vitest

### 命令

| 任务 | 命令 |
|------|------|
| 类型检查 | `npm run typecheck` |
| Lint | `npm run lint` |
| 测试 | `npm test` |
| 开发（仅前端） | `npm run dev` |
| 开发（完整应用） | `npm run tauri:dev` |
| 构建（默认） | `npm run tauri:build` |
| 构建 NSIS | `npm run tauri:build:windows:nsis` |
| 构建 MSI | `npm run tauri:build:windows:msi` |
| 构建 macOS DMG | `npm run tauri:build:macos` |
| 构建 Linux | `npm run tauri:build:linux` |
| 压缩构建 | `npm run tauri:build:compact`（自动 UPX 压缩） |

### 项目结构

```
src/
  domain/types.ts         — 领域类型定义（GachaRecord、PoolMetadata 等）
  app/                    — React 全局状态 & Context
  modules/
    account/              — 账号管理
    import-export/        — JSON / CSV 导入导出（含旧版格式兼容）
    metadata/             — 卡池元数据与远端资源同步
    official-api/         — 森空岛 HG API 客户端（分页、限速、重试）
    pool-management/      — 卡池数据文件管理
    skland-checkin/       — 森空岛每日签到
    stats-engine/         — 抽卡统计引擎（保底 / 出率 / 分布）
    storage/              — SQLite 存储 + AES 加密（schema / repo / snapshot）
    sync-engine/          — 抽卡记录同步引擎（增量去重）
  components/             — 共享 UI 组件
  pages/                  — 页面组件（账号 / 签到 / 记录 / 统计 / 卡池 / 设置 / 关于）
src-tauri/
  src/main.rs             — Tauri 入口、可移植数据目录
  src/webdav.rs           — WebDAV 备份 / 恢复 / 列举
scripts/
  compact-build.mjs       — 自动构建 + UPX 压缩流水线
  compress-upx.ps1        — UPX 压缩脚本（Windows）
```

## 构建发布

推送 tag 触发 CI（需自行配置 GitHub Actions）:

```bash
git tag v1.1.0
git push origin v1.1.0
```

首次发布前，在 GitHub Secrets 中配置：
- `TAURI_PRIVATE_KEY` — `tauri signer generate` 生成的私钥
- `TAURI_KEY_PASSWORD` — 私钥密码（可选）

生成密钥对：

```bash
cargo install tauri-cli
tauri signer generate -w ~/.tauri/myapp.key
```

将公钥填入 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`，将 `endpoints` 中的仓库地址改为实际仓库名。

## License

MIT
