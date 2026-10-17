# 南非入境申报助手 · 上架资料

> Chrome 应用商店（Chrome Web Store）提交用文案与表单答案。
> 版本：1.1.4 ｜ Manifest V3 ｜ 类别：效率工具（Productivity）
> 所有"可直接粘贴"区块均为纯文本，复制进商店后台即可。

---

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 扩展名称 | 南非入境申报助手 |
| 默认语言 | 中文（简体） |
| 类别 | 效率工具 / Productivity |
| 版本 | 1.1.4 |
| 开发者 | 个人开发者 |
| 官网 / 支持链接 | https://github.com/hex314/SARS-Traveller-Assistant |
| 隐私政策链接 | https://hex314.github.io/SARS-Traveller-Assistant/privacy-policy.html |

名称长度 8 个字符，远低于 45 字符上限。

---

## 2. 简短说明（上限 132 字符）

**中文（推荐）**

```text
批量填写南非海关旅客申报表（SARS Traveller）：粘贴名单即自动完成三步填写与翻页，最终提交仍由人工确认。
```

**英文**

```text
Batch-fill South Africa's SARS traveller declaration: paste a name list and complete all three steps automatically.
```

---

## 3. 详细说明（上限 16,000 字符）

```text
【它解决什么问题】
南非海关旅客申报表（SARS Traveller Declaration）需要逐人填写：旅客信息、行程信息、付款摘要三个步骤，
每步都要填十几个字段。一次出行十几位旅客时，重复劳动非常多，而且极易填错护照号、口岸或日期。

本扩展把「公共信息」和「旅客名单」分开管理：公共信息只填一次，名单粘贴一次，
之后每位旅客单独打开一个标签页，自动完成三步填写。

【主要功能】
· 公共信息一次录入，所有旅客自动套用
· 下拉选项直接从 SARS 页面读取，Mode of Travel Type / Airport / Mode of Transport 支持联动刷新
· 到达日期按页面可选范围选择，页面禁用的日期自动置灰
· 粘贴 Excel 复制的名单（姓名 / 护照号 / 出生日期 / 手机号），自动解析成旅客列表
· 手机号合并单元格时，空行自动沿用上一行号码
· 一键批量录入：为每位旅客打开独立标签页，依次填写旅行信息，避免数据串位
· 自动翻页：第一步填完自动进入 Travel Details；进入 Payments Summary 后自动把 Declaration 开关置为 YES
· 填写结果逐项报告，哪些字段成功、哪些未完成一目了然

【使用步骤】
1. 打开 SARS 旅客申报页面（tools.sars.gov.za/sarsonlinequery/traveller），点「从 SARS 页面获取下拉框选项」
2. 填写公共信息（声明类型、旅行方式、口岸、交通工具、旅客类型、旅行原因、出发/经停/目的地、到达日期、地址、邮箱）
3. 粘贴旅客名单，点「解析旅客数据」，核对每位旅客的姓名、护照号、出生日期、手机号
4. 点「一键批量录入（打开标签页并自动填写）」，等待状态栏报告结果
5. 逐个标签页核对信息，确认无误后自行点击最终提交

【它不会做什么】
· 不会自动提交申报，也不会代替你确认法律声明以外的任何内容
· 不上传、不收集任何个人数据，名单只保存在本机浏览器里
· 不读取你的浏览历史，不注入到 SARS 之外的任何网站
· 不修改页面上的校验规则，遇到页面报错仍会如实提示

【适用范围】
仅适用于南非税务局 SARS 在线旅客申报页面（https://tools.sars.gov.za/sarsonlinequery/*）。
其他网站、其他国家的入境表单均不支持。

【重要说明】
本扩展为独立第三方辅助工具，与 South African Revenue Service（SARS）无隶属关系，
也未获得其官方认可。申报信息的真实性由填报人自行负责，提交前请务必逐页核对护照信息与申报内容。
```

---

## 3.1 关于表格与格式（重要）

Chrome 应用商店的「详细说明」是**纯文本**字段，不是富文本编辑器：

| 写法 | 结果 |
| --- | --- |
| 管道符表格语法（竖线分隔） | 原样显示成一排竖线，不渲染 |
| `## 标题` / `**粗体**` | 符号原样露出，不转换 |
| `<b>` `<table>` 等 HTML | 被过滤或露出标签文本 |
| 用空格/制表符对齐列宽 | 字体非等宽，不同宽度下必然错位 |
| 空行分段、`•` `▸` `-` 开头、全大写或【】小标题、`✓` 符号 | ✅ 正常生效 |

### 替代方案一：字段式（最稳，可直接粘贴）

```text
【权限说明】
storage —— 在本机保存公共信息、旅客名单与下拉选项，供下次复用
tabs —— 为每位旅客创建独立标签页，并确认标签页仍在申报流程内
scripting —— 在 SARS 页面注入填表脚本，页面未就绪时兜底
activeTab —— 仅在你点击扩展时操作当前标签页
主机权限 —— 仅限 tools.sars.gov.za/sarsonlinequery 下的页面
```

### 替代方案二：分组小标题 + 短行（信息密度高）

```text
【三步流程】
1. TRAVELLER DETAILS
   声明类型、口岸、交通工具、证件类型、职业、地址、邮箱
2. TRAVEL DETAILS
   旅客类型、旅行原因、出发地/经停地/目的地、到达日期、航班号
3. PAYMENTS SUMMARY
   Declaration 自动置 YES，Next 自动点击

【支持的数据】
旅客名单：姓名、护照号、出生日期、手机号
浏览器：Chrome 110 及以上 / Edge 110 及以上
```

### 如果确实需要真表格

表格放在下面三处，商店页面只放链接：

1. **GitHub README** —— Markdown 表格正常渲染，见仓库 `README.md`
2. **隐私政策页** —— HTML 表格，已在 <https://hex314.github.io/SARS-Traveller-Assistant/privacy-policy.html> 使用
3. **商店截图** —— 把表格做成 1280×800 图片上传

README / 隐私页里可用的表格示例：

```markdown
| 功能 | 输入 | 输出 |
| --- | --- | --- |
| 批量录入 | Excel 复制的名单 | 每位旅客一个标签页，自动填写 |
| 下拉选项 | SARS 页面实际选项 | 本地缓存，含上下级联动 |
| 到达日期 | 页面可选范围 | 不可选日期自动置灰 |
| 填写结果 | 逐字段校验 | 成功/未完成逐项报告 |
```

---

## 4. 权限用途说明（商店后台 Privacy practices）

**中文版**

| 权限 | 用途 | 是否必需 |
| --- | --- | --- |
| `storage` | 在本机保存公共信息、旅客名单、下拉选项与到达日期范围，供下次打开复用 | 必需 |
| `tabs` | 为每位旅客创建并定位一个独立标签页，逐页读取页面地址以确认仍在申报流程内 | 必需 |
| `scripting` | 在 SARS 申报页面注入填表脚本；页面首次加载时内容脚本可能未就绪，需要兜底注入 | 必需 |
| `activeTab` | 用户主动点击扩展按钮时，才可操作当前标签页 | 必需 |
| 主机权限 `https://tools.sars.gov.za/sarsonlinequery/*` | 只在 SARS 在线查询/申报页面运行，用于读取下拉选项并填写表单 | 必需 |

**English version（后台通常按英文填写）**

```text
storage — Saves the shared trip settings, traveller list, dropdown options and arrival-date range locally in the browser so they can be reused next time.
tabs — Opens one tab per traveller and reads the tab URL to make sure the automation still runs on the SARS declaration page.
scripting — Injects the form-filling script when the page's content script is not ready yet (e.g. right after a tab is created).
activeTab — Grants access to the current tab only after the user clicks the extension button.
Host permission https://tools.sars.gov.za/sarsonlinequery/* — Required to read the real dropdown options and fill in the declaration form. The extension runs on no other site.
```

**单一用途说明（Single purpose）**

```text
辅助填写南非 SARS 在线旅客申报表：把用户录入的公共信息与旅客名单自动填进申报页面的表单，并在三步流程中自动翻页。
```

---

## 5. 数据使用声明（Data usage 表单答案）

| 问题 | 选择 |
| --- | --- |
| 是否收集用户数据 | 否（不收集任何类别：个人身份信息、健康信息、财务信息、身份验证信息、个人通信、位置、网页历史、用户活动、网站内容均不收集） |
| 是否出售数据给第三方 | 否 |
| 是否将数据用于与单一用途无关的目的 | 否 |
| 是否使用远程代码（Remote code） | 否，全部代码打包在扩展内，不使用 eval、不加载外部脚本 |
| 是否使用分析/统计服务 | 否 |
| 是否包含广告 | 否 |
| 数据传输是否加密 | 不涉及传输，数据只写入浏览器本地存储（chrome.storage.local） |

> 注意：护照号、手机号属于敏感信息，但由于它们仅保存在用户本机、不上传，
> 在商店表单中仍应选择"不收集"。若日后增加云同步或统计功能，必须回来更新此项并补充隐私政策。

---

## 6. 素材清单

| 素材 | 规格 | 状态 | 文件 |
| --- | --- | --- | --- |
| 商店图标 | 128×128 PNG | ✅ 已生成 | `store/icon-128.png` |
| 扩展内图标 | 16/32/48/128 PNG | ✅ 已生成并写入 manifest | `icons/icon*.png` |
| 小宣传图 | 440×280 PNG | ✅ 已生成 | `store/promo-440x280.png` |
| 商店截图 | 1280×800 或 640×400，1–5 张 | ⏳ 暂缓，可后续用真机截图替换 | `store/png/` |
| 隐私政策链接 | 可公开访问的 URL | ✅ 已上线（GitHub Pages） | https://hex314.github.io/SARS-Traveller-Assistant/privacy-policy.html |
| 上传包 | zip，根目录直接是 manifest.json | ✅ 已重新打包（含 icons/） | `store/SARS-Traveller-Assistant-1.1.4.zip` |

> 根目录下的旧文件 `SARS-Traveller-Assistant.zip` 是改名前的版本，缺少 `icons/` 目录，
> 上传会被拒绝（manifest 引用了不存在的图标），请以 `store/SARS-Traveller-Assistant-1.1.4.zip` 为准。

截图建议内容（真机截取，效果优于示意图）：
1. 公共信息面板（含"从页面获取下拉框选项"按钮）
2. 旅客名单解析后 + "一键批量录入"按钮
3. 批量填写结果报告（成功 / 未完成统计）
4. Payments Summary 页 Declaration 已置 YES 的状态

---

## 7. 提交前技术检查

- [x] Manifest V3，`manifest_version: 3`
- [x] 版本号 1.1.4，与已上架版本递增
- [x] 已配置 `icons` 与 `action.default_icon`（无图标会被拒审）
- [x] 主机权限精确到 `https://tools.sars.gov.za/sarsonlinequery/*`，未使用 `<all_urls>`
- [x] 无 `eval` / `new Function` / 远程脚本 / CDN 依赖
- [x] 无内联事件处理器（MV3 CSP 要求）
- [x] 无 `unlimitedStorage`、`webRequest`、`cookies` 等敏感权限
- [x] 名称、描述、权限说明与实际行为一致
- [x] 隐私政策已托管并填入商店后台（https://hex314.github.io/SARS-Traveller-Assistant/privacy-policy.html）
- [ ] 截图已上传
- [x] 已提交到公开仓库（https://github.com/hex314/SARS-Traveller-Assistant）

---

## 8. 审核风险提示

1. **权限理由要写"为什么"，不要写"用于填表"。** 审核员关注的是必要性，例如 `tabs` 要说明"每位旅客需要一个独立标签页，且需读取 URL 确认仍在申报流程内"。
2. **不要在描述里承诺"全自动申报"。** 扩展不点击最终提交，文案中明确写"提交由人工确认"，可以降低"代替用户做法律声明"的合规风险。
3. **第三方商标声明建议保留。** 描述里已注明与 SARS 无隶属关系；名称中避免直接使用 "SARS" 作为品牌前缀（当前名称为"南非入境申报助手"，符合要求）。
4. **隐私政策必须可公开访问。** 已托管在 GitHub Pages：<https://hex314.github.io/SARS-Traveller-Assistant/privacy-policy.html>（源码在仓库 `docs/`，Pages 从 `main` 的 `/docs` 目录构建）。修改后推送即自动重建。
