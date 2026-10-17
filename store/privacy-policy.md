# 隐私政策 · 南非入境申报助手

最后更新：2026 年 10 月 17 日
适用版本：1.1.4 及以后

## 一句话说明

**本扩展不收集、不上传、不出售任何数据。** 你填写的信息只保存在你自己的浏览器里。

---

## 1. 我们处理哪些信息

为了完成"填写申报表"这一件事，扩展需要在你本机暂存以下内容：

| 数据类型 | 具体内容 | 存储位置 |
| --- | --- | --- |
| 公共信息 | 声明类型、旅行方式、入境口岸、交通工具、证件类型、职业、旅客类型、旅行原因、出发地 / 经停地 / 目的地、到达日期、街道、城市、邮编、邮箱、航班号 | `chrome.storage.local`（本机） |
| 旅客信息 | 英文姓名、护照号、出生日期、手机号 | `chrome.storage.local`（本机） |
| 页面选项缓存 | 从 SARS 页面读取的下拉框选项、可选日期范围 | `chrome.storage.local`（本机） |

这些数据的作用只有一个：下次打开扩展时不用重新输入，并能把内容填进 SARS 申报页面。

## 2. 我们不做什么

- **不上传**：扩展没有任何后端服务器，也不会向任何第三方接口发送你的数据。
- **不收集使用数据**：没有埋点、没有分析统计、没有崩溃上报、没有广告 SDK。
- **不读取浏览历史**：只在你主动点击扩展按钮、或页面处于 SARS 申报地址时才工作。
- **不读取其他网站内容**：主机权限限定为 `https://tools.sars.gov.za/sarsonlinequery/*`。
- **不共享、不出售**：不存在任何形式的数据共享或商业利用。
- **不使用远程代码**：全部代码随扩展一起打包，不加载 CDN 脚本、不执行 `eval`。

## 3. 数据保存在哪里

所有数据通过浏览器提供的 `chrome.storage.local` 保存在**你当前这台设备的浏览器配置里**，不进入云端。

删除方式（任选其一）：

1. 在扩展弹窗中点"清空旅客"；
2. 在 Chrome 中移除本扩展——移除时浏览器会一并清除该扩展的本地存储；
3. 清除浏览器站点数据 / 重置浏览器配置文件。

扩展作者无法访问、也无法恢复这些数据，因为它们从未离开你的设备。

## 4. 权限与用途

| 权限 | 用途 |
| --- | --- |
| `storage` | 在本机保存上述信息，供下次复用 |
| `tabs` | 为每位旅客创建独立标签页，并确认标签页仍停留在申报流程内 |
| `scripting` | 在 SARS 页面注入填表脚本（页面首次加载时内容脚本可能未就绪） |
| `activeTab` | 仅在你主动点击扩展时操作当前标签页 |
| `https://tools.sars.gov.za/sarsonlinequery/*` | 只在 SARS 在线申报页面读取选项并填写表单 |

## 5. 第三方

本扩展不集成任何第三方服务、SDK 或统计工具。你填写的申报信息由你本人直接提交给南非税务局（SARS）的网站，其处理规则适用 SARS 自身的隐私政策。

## 6. 儿童隐私

本扩展面向需要办理南非入境申报的成年旅客，不面向儿童，也不会主动收集任何人的信息。

## 7. 政策变更

如果未来版本新增了任何联网、同步或统计功能，我们会在本页面更新说明，并在扩展更新日志中注明。当前版本（1.1.4）不存在此类功能。

## 8. 联系方式

- 首选渠道：[GitHub Issues](https://github.com/hex314/SARS-Traveller-Assistant/issues)
- 邮箱：`your-email@example.com`（请在发布前替换为真实联系方式）
- 在线版本：<https://hex314.github.io/SARS-Traveller-Assistant/privacy-policy.html>

---

# Privacy Policy · South Africa Entry Declaration Assistant

Last updated: October 17, 2026

## Summary

**This extension does not collect, transmit, or sell any data.** Everything you enter stays in your own browser.

## 1. What is stored locally

To fill the declaration form, the extension keeps the following in `chrome.storage.local` on your device:

- Shared trip settings: declaration type, mode of travel, port of entry, mode of transport, document type, occupation, traveller type, reason for travel, origin / via / destination, arrival date, street, city, postal code, email, flight number.
- Traveller details: full name, passport number, date of birth, mobile number.
- Page option cache: dropdown options and selectable arrival-date range read from the SARS page.

## 2. What we never do

- No uploads: there is no backend server; no data leaves your device.
- No analytics, telemetry, crash reporting, or advertising SDKs.
- No browsing-history access; the extension only runs on the SARS declaration page or when you click its button.
- No data sharing or selling.
- No remote code; all code ships inside the package.

## 3. Data removal

Use "清空旅客 (Clear travellers)" in the popup, or simply uninstall the extension — Chrome removes its local storage on uninstall. The developer has no access to this data.

## 4. Permissions

`storage` (save settings locally), `tabs` (open one tab per traveller and verify the tab is still on the declaration flow), `scripting` (inject the form-filling script), `activeTab` (act on the current tab only after a user click), and host permission for `https://tools.sars.gov.za/sarsonlinequery/*` (read options and fill the form on that page only).

## 5. Third parties

None. Submission is made directly by you to the SARS website; SARS's own privacy policy applies to that submission.

## 6. Changes

If a future version adds any network, sync, or analytics feature, this page and the changelog will be updated. Version 1.1.4 has no such feature.

## 7. Contact

GitHub Issues: <https://github.com/hex314/SARS-Traveller-Assistant/issues>
Online version: <https://hex314.github.io/SARS-Traveller-Assistant/privacy-policy.html>
`your-email@example.com` (replace with a real address before publishing)
