# Phase Pal Music Bridge

[English](README.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Español](README.es.md) · [日本語](README.ja.md)

将浏览器播放状态连接到 Phase Pal 的 **Dance to Music（随音乐舞动）** 功能；可选的节拍分析在你的设备上完成。由 Consistency AI 维护。

**预览版：** 源码采用 MIT 许可证，兔子图标另有使用条款。这不是 Chrome 应用商店正式版，也不包含已签名的 Phase Pal 安装程序。你需要另行获取已内置浏览器桥接组件的兼容桌面应用。真实 Chrome 播放和打包应用的验证仍未完成。

## 设置与隐私

- [设置指南](https://consistencyai.github.io/phasepal_extension/)（英文）
- [隐私政策](https://consistencyai.github.io/phasepal_extension/privacy/)（英文）
- [技术隐私说明与权限](docs/PRIVACY.md)
- [开发与原生主机设置](docs/DEVELOPMENT.md)

## 功能

报告以下网站的播放／暂停状态：Spotify Web、YouTube Music、SoundCloud、Apple Music、Amazon Music 各地区播放器、Deezer、TIDAL、Qobuz、Pandora、Yandex Music、QQ Music、KuGou、JioSaavn、LINE MUSIC、Bugs、JOOX、Anghami 和 Audiomack。
请查看[确切域名与验证范围](docs/SUPPORTED_SITES.md)。你也可以在弹窗的 **Custom websites（自定义网站）** 中添加单个网站，由 Chrome 请求该网站的访问权限；详见[自定义网站设置](docs/CUSTOM_SITES.md)。

本扩展将支持网站的播放视为音乐。语音、播客和广告也可能触发舞动；它不区分歌曲和语音。账号、订阅、地区、受保护内容及播放器的限制仍然有效。这些集成仍需真实播放测试后才能作为运行时正式版发布。

## 使用扩展

1. 在 Windows 或 macOS 上使用 Chrome 116 或更新版本，并使用已打包并注册浏览器桥接组件的兼容 Phase Pal 应用。目前的安装流程不支持 Linux 或其他浏览器。只更新扩展不会为旧版应用添加桥接组件。
2. 对于此开发者预览版，请从 [Releases](https://github.com/ConsistencyAI/phasepal_extension/releases) 下载 `phasepal-music-bridge-preview-0.1.0.zip` 并解压。在 `chrome://extensions` 中开启 **Developer mode（开发者模式）**，选择 **Load unpacked（加载已解压的扩展程序）**，然后选择包含 `manifest.json` 的文件夹。另一个商店上传 ZIP 用于开发者控制台，不包含开发公钥。
3. 打开 Phase Pal，启用 **Dance to Music**。在支持或已批准的自定义网站上开始播放，然后打开扩展弹窗检查连接状态。
4. 选择 **Enable Beat Sync（启用节拍同步）**，在本地分析当前标签页音频。Chrome 会显示捕获指示，标签页仍可正常发声。选择 **Stop Beat Sync（停止节拍同步）** 结束捕获。

**Auto Beat Sync（自动节拍同步）** 默认关闭，仅保存在本设备上。启用后，在音乐标签页准备就绪时打开弹窗会尝试捕获一次。已批准的音频流可以在暂停和同一网站切歌时保持连接。新标签页或已结束的流需要再次打开扩展或点击启用；该选项不授予无人操作时的捕获权限。手动停止、关闭自动同步、关闭 Dance to Music、应用断开连接、失去网站权限、离开网站、关闭标签页或音频流结束，都会停止捕获。

网站上的可关闭提醒会引导你打开工具栏弹窗。**Not now（暂不）** 只对当前文档生效；**Don't show again（不再显示）** 会在本地保存，可跨网站和重启生效。停用或移除扩展也会停止播放状态上报。

## 数据留在本地

标签页音频（包括语音和广告）仅在扩展内存中分析，不请求麦克风权限，不录音、不转写、不进行分析遥测，也不远程上传。仅将固定的播放／服务标识、元数据是否存在的布尔值、会话／协议字段以及数值节奏特征发送到本地 Phase Pal 应用。歌曲名、艺人名、网址、网页文本、浏览历史和原始音频不会发送给它。自定义网站的来源和两个偏好设置仅保存在本地 Chrome 中。Phase Pal、Chrome 和音乐服务各有独立的数据处理方式；请参阅[完整边界说明](docs/PRIVACY.md)。

## 构建与检查

使用 Node.js 22.x 系列的 22.12+ 或 Node.js 24+、npm，以及已提交的锁文件：

```bash
npm ci
npm run check
```

将生成的 `dist/` 目录作为已解压的扩展加载。开发扩展 ID 必须为 `depmepnaojmbbjgogihalfgeajkfkbjj`，与原生主机 `app.phasepal.music` 匹配。清单中的公钥固定了此 ID，它不是私密凭据。

请查看[开发与原生主机命令](docs/DEVELOPMENT.md)、[V1 设计](docs/DESIGN.md)和[贡献指南](CONTRIBUTING.md)。兼容打包应用的普通用户不需要 Rust、Python 或手动安装主机。原生主机开发需要 Rust 1.85+、Python 3 和对应平台的构建工具。

```bash
cargo test --manifest-path native-host/Cargo.toml --locked
npm run package:store
```

打包需要 Python 3，两个 ZIP 及其校验信息会输出到 `BuildArtifacts/chrome-web-store/0.1.0/`。预览 ZIP 保留开发公钥；商店上传包会移除它。请验证 Google 分配的商店 ID，并协调两份原生主机源码及应用注册，再分发对应 ID 的应用。不包含原生可执行文件。本地测试不验证真实 Chrome 捕获或打包应用。未配置 CI。

## 发布与支持

剩余要求见[商店准备状态](docs/STORE_PREPARATION.md)和[提交清单](store/RELEASE_CHECKLIST.md)。不要将构建产物、音频、缓存、个人设置或密钥提交到 Git。

联系：[hello@consistencyai.net](mailto:hello@consistencyai.net)。另见[安全问题报告](SECURITY.md)、[行为准则](CODE_OF_CONDUCT.md)和[源码发布审查](docs/PUBLIC_RELEASE_REVIEW.md)。源码及文档采用 [MIT 许可证](LICENSE)，构建产物还须遵守依赖项许可证。兔子图标另有条款，详见 [NOTICE](NOTICE)。
