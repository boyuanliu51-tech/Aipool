# AI协同台 (AI-POOL)

一个主控 AI 拆解目标、分派给多个子 AI 并行执行、审核返工后汇总交付；带进度与 Token 用量监控。支持 Claude、OpenAI、DeepSeek 及任何 OpenAI 兼容服务。

## 下载

每次推送到 `main` 分支，GitHub Actions 会自动打包，十几分钟后在仓库的 **Releases** 页出现：

| 文件 | 用途 |
|---|---|
| `AIPool-Android-x.y.z.apk` | 安卓安装包 |
| `AIPool-Setup-x.y.z.exe` | Windows 安装程序 |
| `AIPool-Portable-x.y.z.exe` | Windows 免安装版 |

也可以在 **Actions → 打包安卓和 Windows → Run workflow** 手动触发。

## 安装提示

- **安卓**：首次安装需允许「安装未知来源应用」。设置了固定签名证书后（见文末），新版本可直接覆盖安装，配置和密钥保留。
- **Windows**：安装包没有代码签名，SmartScreen 会提示「已保护你的电脑」，点「更多信息 → 仍要运行」即可。
- 关闭 Windows 窗口会缩到右下角托盘，任务继续运行；从托盘菜单「退出」才真正关闭。

## 和网页版的区别

- 安卓和 Windows 版绕过了浏览器跨域限制，所有服务商都能直连。
- Windows 版任务完成会弹系统通知。
- 配置、密钥、用量都保存在本机。

## 目录

```
web/        界面（三个平台共用）
android/    安卓原生外壳（WebView + 原生 HTTP 通道）
desktop/    Windows 桌面版（Electron）
.github/    自动打包流程
```

## 安卓签名证书（可选）

仓库里不存放签名证书。没有设置时，每次打包都会临时生成一个新证书，此时安装新版本前需要先卸载旧版（App 内的配置会丢失）。

想让新版本直接覆盖安装，在本地生成一个固定证书（别名必须是 `aipool`）：

```
keytool -genkeypair -keystore release.jks -alias aipool -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=AIPool"
base64 -w0 release.jks   # Windows 可用：certutil -encode release.jks out.txt
```

然后在仓库 **Settings → Secrets and variables → Actions** 里添加两个 Secret：

- `KEYSTORE_B64`：上面 base64 输出的内容
- `KEYSTORE_PASSWORD`：生成证书时设的密码

证书文件自己妥善保存，不要上传到仓库，也不要更换，否则手机上无法覆盖安装。
