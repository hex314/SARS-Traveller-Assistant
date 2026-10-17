
"use strict";

const STORAGE_KEYS = {
  settings: "sars_public_settings",
  travellers: "sars_travellers",
  excelData: "sars_excel_data",
  availability: "sars_arrival_availability"
};

const DEFAULT_SETTINGS = {
  declarationType: "NIL",
  modeOfTravelType: "Air",
  port: "O.R. Tambo International Airport",
  modeOfTransport: "International Aircraft",
  travelDocumentType: "Ordinary Passport",
  occupation: "Trade/Business",
  travellerType: "Travelling in my personal capacity",
  travelReason: "Leisure",
  travellingFrom: "China",
  travellingVia: "None",
  travellingTo: "South Africa",
  arrivalDate: "",
  street: "",
  city: "",
  postal: "",
  email: "",
  flightNumber: ""
};

let travellers = [];
let isSaving = false;

// 公共信息中的页面下拉框字段：
// key 为弹窗存储键；name 为页面上 MUI 下拉框的组件名；
// refresh 为联动子级（页面组件名），修改父级后需回读这些子级的新选项。
const DROPDOWN_FIELDS = [
  {
    key: "declarationType",
    name: "declarationtype",
    label: "Declaration Type（声明类型）",
    refresh: []
  },
  {
    key: "modeOfTravelType",
    name: "modalitytype",
    label: "Mode of Travel Type（旅行方式）",
    refresh: ["travelport", "travelmode"]
  },
  {
    key: "port",
    name: "travelport",
    label: "Mode of Travel / Airport（入境口岸/机场）",
    refresh: ["travelmode"]
  },
  {
    key: "modeOfTransport",
    name: "travelmode",
    label: "Mode of Transport（交通工具）",
    refresh: []
  },
  {
    key: "travelDocumentType",
    name: "traveldocumenttype",
    label: "Travel Document Type（证件类型）",
    refresh: []
  },
  {
    key: "occupation",
    name: "occupation",
    label: "Occupation（职业）",
    refresh: []
  }
];

// key -> { name, options: [], current }
let dropdownOptions = {};

const $ = id => document.getElementById(id);

function showStatus(message, type = "") {
  const el = $("status");
  if (!el) return;

  el.textContent = String(message || "");
  el.className = type;
}

function showDetails(content) {
  const el = $("details");
  if (!el) return;

  el.textContent = String(content || "");
  el.hidden = !content;
}

function getSettings() {
  const settings = {};

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const el = $(key);
    settings[key] = el
      ? el.value.trim()
      : DEFAULT_SETTINGS[key];
  }

  return settings;
}

function applySettings(settings = {}) {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const el = $(key);

    if (!el) continue;

    // 空字符串也回退到默认值（?? 不会拦截空串，这里用 ||）。
    const value = settings[key] || DEFAULT_SETTINGS[key];

    if (el instanceof HTMLSelectElement) {
      // 旧数据可能与当前选项格式不一致（如 Trade-Business vs Trade/Business），
      // 用智能匹配回填，避免 select 赋值失败显示为空。
      el.value = chooseOption(el, value);
    } else {
      el.value = value;
    }
  }
}

function validateSettings() {
  const settings = getSettings();

  const required = [
    ["street", "Street（街道）"],
    ["city", "City / Town（城市）"],
    ["postal", "Postal Code（邮政编码）"],
    ["email", "Email（电子邮箱）"]
  ];

  // 下拉框字段仅在已获取页面选项后强制校验；
  // 未获取时沿用默认值，不阻断批量操作。
  for (const field of DROPDOWN_FIELDS) {
    const select = $(field.key);

    if (select && !select.disabled && !settings[field.key]) {
      required.push([field.key, field.label]);
    }
  }

  const missing = required
    .filter(([key]) => !settings[key])
    .map(([, label]) => label);

  if (missing.length) {
    showStatus(
      "请填写必填公共信息：" + missing.join("、"),
      "error"
    );
    return false;
  }

  const email = $("email");

  if (email && !email.validity.valid) {
    showStatus("Email 格式不正确，请检查。", "error");
    email.focus();
    return false;
  }

  const arrivalDate = $("arrivalDate")?.value || "";

  if (arrivalDate && isArrivalDateDisabled(arrivalDate)) {
    showStatus(
      `Arrival Date ${arrivalDate} 不在页面可选范围内，请重新选择或点「清除」。`,
      "error"
    );
    return false;
  }

  return true;
}

function chooseOption(select, desired) {
  const options = [...select.options];

  if (!options.length) return "";

  if (!desired) return options[0].value;

  const lower = String(desired).toLowerCase();

  // 1. 精确匹配。
  let hit = options.find(option => option.value === desired);

  // 2. 包含匹配（保存值与页面全文互为子串）。
  if (!hit) {
    hit = options.find(option => {
      const text = option.value.toLowerCase();
      return text.includes(lower) || lower.includes(text);
    });
  }

  // 2.5 归一化匹配：连字符/斜杠/空格等价，
  // 例如旧数据 Trade-Business 可匹配 Trade/Business。
  if (!hit) {
    const norm = value =>
      String(value).toLowerCase().replace(/[\s\-/\\]+/g, "");

    hit = options.find(
      option => norm(option.value) === norm(desired)
    );
  }

  // 3. 关键词匹配：NIL / FULL 声明按钮。
  if (!hit && /\bnil\b|no goods/.test(lower)) {
    hit = options.find(option => /\bnil\b|no goods/i.test(option.value));
  }

  if (!hit && /\bfull\b|have goods/.test(lower)) {
    hit = options.find(option => /\bfull\b|have goods/i.test(option.value));
  }

  return hit ? hit.value : options[0].value;
}

function populateSelect(key) {
  const select = $(key);

  if (!select) return;

  const data = dropdownOptions[key];

  if (!data) return;

  // 保留当前已选值（可能来自上次保存）。
  const saved = select.value;

  select.replaceChildren();

  if (!data.options.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "（未在页面找到可选项）";
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  for (const text of data.options) {
    const option = document.createElement("option");
    option.value = text;
    option.textContent = text;
    select.appendChild(option);
  }

  select.disabled = false;

  // 回填优先级：已保存值 → 页面当前值 → 字段默认值。
  // 例如 declarationType 的默认值为 NIL，抓取选项后仍默认选中 NIL。
  select.value = chooseOption(
    select,
    saved || data.current || DEFAULT_SETTINGS[key] || ""
  );
}

async function fetchDropdownOptions() {
  const btn = $("fetchOptionsBtn");

  if (btn) btn.disabled = true;

  showStatus("正在从 SARS 页面获取下拉框选项……");
  showDetails("");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_OPTIONS",
      names: DROPDOWN_FIELDS.map(field => field.name)
    });

    if (!response || response.ok === false) {
      throw new Error(
        response?.message ||
        "获取失败。请确认当前标签页是已加载完成的 SARS 表单页面。"
      );
    }

    const dropdowns = response.dropdowns || {};
    const failed = [];
    const empty = [];
    const currentOnly = [];

    for (const field of DROPDOWN_FIELDS) {
      const data = dropdowns[field.name];

      if (!data || !data.exists) {
        failed.push(field.label);
        continue;
      }

      dropdownOptions[field.key] = {
        name: field.name,
        options: data.options || [],
        current: data.current || "",
        fromCurrentValue: Boolean(data.fromCurrentValue)
      };

      populateSelect(field.key);

      if (!dropdownOptions[field.key].options.length) {
        empty.push(field.label);
      } else if (dropdownOptions[field.key].fromCurrentValue) {
        currentOnly.push(field.label);
      }
    }

    await saveAll(false);

    const lines = [
      `已从页面获取 ${DROPDOWN_FIELDS.length - failed.length} 个下拉框的真实选项，` +
      "联动关系已建立。"
    ];

    if (failed.length) {
      lines.push(`未找到页面组件：${failed.join("、")}`);
    }

    if (empty.length) {
      lines.push(
        `未读取到选项：${empty.join("、")}`,
        "请确认页面已完全加载后重新获取；若仍失败，请刷新 SARS 页面再试。"
      );
    }

    if (currentOnly.length) {
      lines.push(
        `只读到当前已选值（组件无法展开）：${currentOnly.join("、")}`,
        "若页面已自动选中正确值，可直接使用；如需其他取值，请刷新页面后重新获取。"
      );
    }

    showStatus(lines.join("\n"), failed.length ? "error" : "success");

    // 顺带读取 Arrival Date 可选范围（仅在第二步页面有效，失败静默）。
    fetchArrivalAvailability(true);
  } catch (error) {
    showStatus(
      "获取下拉框选项失败：" + (error?.message || String(error)),
      "error"
    );
  } finally {
    if (btn) btn.disabled = false;
  }
}

// 修改下拉框父级时：先在页面上真实选中，
// 再回读联动子级的最新选项（页面是联动的唯一数据源）。
async function handleDropdownChange(key) {
  const field = DROPDOWN_FIELDS.find(item => item.key === key);

  const select = $(key);

  if (!field || !select) return;

  const value = select.value || "";

  if (!value) {
    await saveAll(false);
    return;
  }

  // 没有联动子级的字段直接保存即可。
  if (!field.refresh.length) {
    await saveAll(false);
    return;
  }

  select.disabled = true;
  showStatus(`正在应用「${field.label}」并刷新联动下拉框……`);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SET_FIELD_AND_REFRESH",
      name: field.name,
      value,
      refreshNames: field.refresh
    });

    if (!response || response.ok === false) {
      throw new Error(
        response?.message ||
        response?.set?.error ||
        "页面操作失败，请确认 SARS 页面可用。"
      );
    }

    if (response.set?.result?.ok === false) {
      throw new Error(
        response.set.result.reason || "页面下拉框选择失败。"
      );
    }

    const refreshed = response.refreshed?.dropdowns || {};

    for (const childName of field.refresh) {
      const childField = DROPDOWN_FIELDS.find(
        item => item.name === childName
      );

      const data = refreshed[childName];

      if (!childField || !data || !data.exists) continue;

      dropdownOptions[childField.key] = {
        name: childName,
        options: data.options || [],
        current: data.current || "",
        fromCurrentValue: Boolean(data.fromCurrentValue)
      };

      populateSelect(childField.key);
    }

    await saveAll(false);

    const childLabels = field.refresh
      .map(name =>
        DROPDOWN_FIELDS.find(item => item.name === name)?.label || name
      )
      .join("、");

    showStatus(
      `「${field.label}」已更新为：${value}\n联动下拉框已刷新：${childLabels}`,
      "success"
    );
  } catch (error) {
    showStatus(
      `更新「${field.label}」失败：` + (error?.message || String(error)),
      "error"
    );
  } finally {
    if (select && dropdownOptions[key]?.options.length) {
      select.disabled = false;
    }
  }
}

async function saveAll(showMessage = true) {
  if (isSaving) return false;

  isSaving = true;

  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.settings]: getSettings(),
      [STORAGE_KEYS.travellers]: travellers,
      [STORAGE_KEYS.excelData]: $("excelData")?.value || "",
      [STORAGE_KEYS.availability]: arrivalAvailability
    });

    if (showMessage) {
      showStatus(
        `保存成功。公共信息已保存，当前旅客 ${travellers.length} 人。`,
        "success"
      );
    }

    return true;
  } catch (error) {
    showStatus(
      "保存失败：" + (error?.message || String(error)),
      "error"
    );
    return false;
  } finally {
    isSaving = false;
  }
}

async function loadAll() {
  const data = await chrome.storage.local.get(
    Object.values(STORAGE_KEYS)
  );

  applySettings(data[STORAGE_KEYS.settings] || {});

  const availability = data[STORAGE_KEYS.availability];

  if (availability && typeof availability === "object") {
    arrivalAvailability = normalizeAvailability(availability);
  }

  renderArrivalCalendar();

  // 旧配置里超出「今天～明天」窗口的日期直接清掉，避免带着不可填的值去批量填表。
  const arrivalInput = $("arrivalDate");

  if (arrivalInput?.value && isArrivalDateDisabled(arrivalInput.value)) {
    const removed = arrivalInput.value;

    arrivalInput.value = "";
    arrivalAvailabilityNote = `（原选 ${removed} 已超出可选窗口，已清空）`;

    renderArrivalCalendar();
    saveAll(false);
  }

  if ($("excelData")) {
    $("excelData").value =
      data[STORAGE_KEYS.excelData] || "";
  }

  travellers = Array.isArray(data[STORAGE_KEYS.travellers])
    ? data[STORAGE_KEYS.travellers]
    : [];

  renderTravellers();
}

function normalizeDate(value) {
  const input = String(value || "").trim();
  if (!input) return "";

  const match = input.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
  );

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "";
    }

    return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
  }

  // Excel 日期序列号
  if (/^\d{5}$/.test(input)) {
    const serial = Number(input);

    if (serial >= 20000 && serial <= 80000) {
      const date = new Date(
        Date.UTC(1899, 11, 30) + serial * 86400000
      );

      return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, "0"),
        String(date.getUTCDate()).padStart(2, "0")
      ].join("/");
    }
  }

  return "";
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\\\-./（）()：:]+/g, "");
}

function findColumn(headers, candidates) {
  return headers.findIndex(header =>
    candidates.some(
      candidate => header === normalizeHeader(candidate)
    )
  );
}

function splitFullName(value) {
  const input = String(value || "").trim();

  if (!input) {
    return { firstName: "", surname: "" };
  }

  if (input.includes(",")) {
    const parts = input
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return {
        surname: parts[0],
        firstName: parts.slice(1).join(" ")
      };
    }
  }

  const parts = input.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      surname: ""
    };
  }

  // 支持示例中的 SHAOQING HUANG 格式
  return {
    firstName: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1]
  };
}

function parseTravellerRows(rawText) {
  const lines = String(rawText || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(line => line.trim());

  if (!lines.length) {
    return {
      rows: [],
      errors: ["请先粘贴旅客数据。"]
    };
  }

  const delimiter = lines[0].includes("\t")
    ? "\t"
    : lines[0].includes(";")
      ? ";"
      : ",";

  const matrix = lines.map(line => {
    if (delimiter !== ",") {
      return line.split(delimiter).map(x => x.trim());
    }

    const result = [];
    let current = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  });

  const headers = matrix[0].map(normalizeHeader);

  const nameCol = findColumn(headers, [
    "英文姓名", "姓名", "旅客姓名", "全名",
    "name", "fullname", "englishname",
    "travellername", "passengername"
  ]);

  const firstNameCol = findColumn(headers, [
    "firstname", "givenname", "名", "名字", "forename"
  ]);

  const surnameCol = findColumn(headers, [
    "surname", "lastname", "familyname", "姓", "姓氏"
  ]);

  const passportCol = findColumn(headers, [
    "护照号", "护照号码", "护照编号",
    "passport", "passportnumber", "passportno",
    "documentnumber", "traveldocumentnumber"
  ]);

  const dobCol = findColumn(headers, [
    "出生日期", "生日", "dob",
    "dateofbirth", "birthdate"
  ]);

  const phoneCol = findColumn(headers, [
    "手机号", "手机号码", "电话", "联系电话",
    "phone", "phonenumber", "mobile",
    "mobilephone", "telephone"
  ]);

  const hasHeader = [
    nameCol,
    firstNameCol,
    surnameCol,
    passportCol,
    dobCol,
    phoneCol
  ].some(index => index >= 0);

  const rows = [];
  const errors = [];
  const notes = [];

  // Excel 合并单元格复制成文本后，只有首行保留值，其余行是空的。
  // 手机号通常整组共用一个，因此允许向下沿用上一行的值。
  let lastPhone = "";
  let lastPhoneLine = 0;

  for (
    let i = hasHeader ? 1 : 0;
    i < matrix.length;
    i++
  ) {
    const cells = matrix[i];

    const get = col =>
      col >= 0 ? String(cells[col] || "").trim() : "";

    let firstName = get(firstNameCol);
    let surname = get(surnameCol);

    if (!firstName && !surname) {
      const name = nameCol >= 0
        ? get(nameCol)
        : (hasHeader ? "" : cells[0] || "");

      const parsed = splitFullName(name);
      firstName = parsed.firstName;
      surname = parsed.surname;
    }

    const passportNumber = get(
      passportCol >= 0 ? passportCol : (hasHeader ? -1 : 1)
    );

    const rawDob = get(
      dobCol >= 0 ? dobCol : (hasHeader ? -1 : 2)
    );

    const phoneRaw = get(
      phoneCol >= 0 ? phoneCol : (hasHeader ? -1 : 3)
    );

    const dateOfBirth = normalizeDate(rawDob);

    if (
      !firstName &&
      !surname &&
      !passportNumber &&
      !rawDob &&
      !phoneRaw
    ) {
      continue;
    }

    // 合并单元格：手机号为空时沿用上一行（并标记来源，便于核对）。
    let phone = phoneRaw;
    let phoneInherited = false;

    if (!phone && lastPhone) {
      phone = lastPhone;
      phoneInherited = true;

      notes.push(
        `第 ${i + 1} 行手机号为空，已沿用第 ${lastPhoneLine} 行的 ${phone}（合并单元格/整组共用）。`
      );
    }

    if (!phone) {
      notes.push(
        `第 ${i + 1} 行手机号为空，且上方没有可沿用的号码，请补齐后再填表。`
      );
    }

    if (!firstName || !surname) {
      errors.push(
        `第 ${i + 1} 行：姓名无法识别，请检查英文姓名及顺序。`
      );
      continue;
    }

    if (!passportNumber) {
      errors.push(`第 ${i + 1} 行：缺少护照号。`);
      continue;
    }

    if (!dateOfBirth) {
      errors.push(
        `第 ${i + 1} 行：出生日期无效，请使用 YYYY-MM-DD 或 YYYY/MM/DD。`
      );
      continue;
    }

    rows.push({
      firstName,
      surname,
      passportNumber,
      dateOfBirth,
      phone,
      phoneInherited
    });

    if (phoneRaw) {
      lastPhone = phoneRaw;
      lastPhoneLine = i + 1;
    }
  }

  if (!rows.length && !errors.length) {
    errors.push("没有识别到有效旅客，请检查表头和数据列。");
  }

  // 姓名/护照号若也是合并单元格，无法安全沿用，给出针对性提示。
  if (errors.some(item => item.includes("姓名无法识别") || item.includes("缺少护照号"))) {
    notes.push(
      "提示：姓名或护照号列若有合并单元格，无法自动沿用，请在 Excel 中取消合并（或先向下填充）后重新复制。"
    );
  }

  return { rows, errors, notes };
}

function renderTravellers() {
  const count = $("travellerCount");
  const list = $("travellerList");

  if (count) {
    count.textContent = `当前旅客：${travellers.length} 人`;
  }

  if (!list) return;

  list.replaceChildren();

  if (!travellers.length) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "尚未解析旅客数据。";
    list.appendChild(hint);
    return;
  }

  travellers.forEach((traveller, index) => {
    const card = document.createElement("div");
    card.className = "traveller-card";

    const title = document.createElement("strong");
    title.textContent =
      `${index + 1}. ${traveller.firstName} ${traveller.surname}`;

    const info = document.createElement("div");
    info.className = "hint";
    info.textContent =
      `护照号：${traveller.passportNumber} ｜ 出生日期：${traveller.dateOfBirth}` +
      (traveller.phone
        ? ` ｜ 手机：${traveller.phone}${traveller.phoneInherited ? "（沿用上行）" : ""}`
        : " ｜ 手机：未填写");

    card.append(title, info);
    list.appendChild(card);
  });
}

async function parseTravellers() {
  const result = parseTravellerRows($("excelData")?.value || "");

  travellers = result.rows;
  renderTravellers();

  const saved = await saveAll(false);

  const messages = [];

  if (travellers.length) {
    messages.push(`成功解析 ${travellers.length} 位旅客。`);
  }

  if (result.errors.length) {
    messages.push("", ...result.errors);
  }

  if (result.notes?.length) {
    messages.push("", ...result.notes);
  }

  if (!saved) {
    messages.push("", "注意：旅客数据保存失败，请重试。");
  }

  showStatus(
    messages.join("\n") || "没有解析到旅客数据。",
    result.errors.length || !saved ? "error" : "success"
  );

  showDetails("");
}

function getSampleData() {
  return [
    "英文姓名\t护照号\t出生日期\t手机号",
    "SHAOQING HUANG\t请填写护照号\t1967-04-15\t",
    "JINBO HONG\t请填写护照号\t1960-07-21\t",
    "JUN ZHANG\t请填写护照号\t1954-07-25\t",
    "ZHIHUAN GUAN\t请填写护照号\t1954-12-25\t"
  ].join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showStatus("已复制到剪贴板。", "success");
  } catch (_) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    showStatus(
      copied
        ? "已复制到剪贴板。"
        : "复制失败，请手动复制文本。",
      copied ? "success" : "error"
    );
  }
}

function buildBatchDetails(response) {
  if (!response || !Array.isArray(response.results)) {
    return "";
  }

  return response.results
    .map(result =>
      `${result.ok ? "✓" : "✗"} ${result.traveller}` +
      `（标签页 ${result.tabId}）：成功 ${result.successCount} 项，` +
      `未完成 ${result.failedCount} 项` +
      (result.ok ? "" : `\n    ${result.message}`)
    )
    .join("\n");
}

async function openAndFillAllTravellers() {
  if (!validateSettings()) return;

  if (!travellers.length) {
    showStatus("请先解析旅客数据，确保旅客列表不为空。", "error");
    return;
  }

  if (!(await saveAll(false))) return;

  showStatus(
    `正在为 ${travellers.length} 位旅客打开标签页并自动填写，请勿关闭弹窗……`
  );
  showDetails("");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "OPEN_AND_FILL",
      travellers,
      settings: getSettings()
    });

    if (!response) {
      throw new Error("后台没有返回结果，请重试。");
    }

    showStatus(
      response.message || "批量录入完成，请逐页核对后自行提交。",
      response.ok === false ? "error" : "success"
    );

    showDetails(buildBatchDetails(response));
  } catch (error) {
    showStatus(
      "一键批量录入失败：" + (error?.message || String(error)),
      "error"
    );
  }
}

async function clearTravellers() {
  if (!confirm("确定清空已解析的旅客数据和输入框内容吗？")) {
    return;
  }

  travellers = [];

  if ($("excelData")) {
    $("excelData").value = "";
  }

  renderTravellers();

  const saved = await saveAll(false);

  showStatus(
    saved ? "旅客数据已清空。" : "清空后保存失败，请重试。",
    saved ? "success" : "error"
  );

  showDetails("");
}

// ---------- Arrival Date 日历（禁用页面不可选日期） ----------

const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

let arrivalAvailability = {
  min: "",
  max: "",
  disabled: [],
  pageValue: "",
  source: "default",
  scanned: false,
  manual: false,
  updatedAt: 0
};

// 读取页面范围时的提示（成功为空）。
let arrivalAvailabilityNote = "";

let arrivalView = null;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseISODate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function todayISODate() {
  return toISODate(new Date());
}

function tomorrowISODate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toISODate(date);
}

// 固定窗口：只允许「今天 / 明天」。
// 读到页面范围时与之取交集（页面更窄则以页面为准）；手动范围优先级最高。
function arrivalRange() {
  const today = todayISODate();
  const tomorrow = tomorrowISODate();

  if (arrivalAvailability.manual) {
    return {
      min: arrivalAvailability.min || "",
      max: arrivalAvailability.max || ""
    };
  }

  if (arrivalAvailability.source === "page") {
    const pageMin = arrivalAvailability.min || "";
    const pageMax = arrivalAvailability.max || "";

    const min = pageMin && pageMin > today ? pageMin : today;
    const max = pageMax && pageMax < tomorrow ? pageMax : tomorrow;

    // 页面范围与「今天～明天」完全不相交时，退回页面自身范围。
    if (min > max) {
      return {
        min: pageMin || today,
        max: pageMax || tomorrow
      };
    }

    return { min, max };
  }

  return { min: today, max: tomorrow };
}

function isArrivalDateDisabled(iso) {
  if (!iso) return false;

  const { min, max } = arrivalRange();

  if (min && iso < min) return true;
  if (max && iso > max) return true;

  return arrivalAvailability.disabled.includes(iso);
}

function ensureArrivalView() {
  if (arrivalView) return arrivalView;

  const selected = parseISODate($("arrivalDate")?.value || "");
  const base = selected || new Date();

  arrivalView = { year: base.getFullYear(), month: base.getMonth() };

  return arrivalView;
}

function updateArrivalDateText() {
  const value = $("arrivalDate")?.value || "";
  const text = $("arrivalDateText");

  if (text) text.textContent = value || "未选择（使用页面日期）";
}

function renderArrivalRangeHint() {
  const hint = $("dateRangeHint");

  if (!hint) return;

  const { min, max } = arrivalRange();
  const pieces = [];

  if (arrivalAvailability.manual) {
    pieces.push(`手动范围 ${min || "不限"} ~ ${max || "不限"}`);
  } else if (arrivalAvailability.source === "page") {
    pieces.push(`页面范围 ${min || "不限"} ~ ${max || "不限"}`);

    if (arrivalAvailability.disabled.length) {
      pieces.push(`另有 ${arrivalAvailability.disabled.length} 天不可选`);
    }
  } else {
    pieces.push(`固定今天～明天（${min} ~ ${max}）`);
  }

  if (arrivalAvailabilityNote) pieces.push(arrivalAvailabilityNote);

  hint.textContent = pieces.join("　");
}

function renderArrivalCalendar() {
  const week = $("dateWeek");
  const grid = $("dateGrid");
  const label = $("dateMonthLabel");

  if (!week || !grid) return;

  const view = ensureArrivalView();

  if (label) label.textContent = `${view.year} 年 ${view.month + 1} 月`;

  if (!week.children.length) {
    for (const text of WEEK_LABELS) {
      const cell = document.createElement("span");
      cell.textContent = text;
      week.appendChild(cell);
    }
  }

  grid.replaceChildren();

  const first = new Date(view.year, view.month, 1);
  const offset = first.getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const selected = $("arrivalDate")?.value || "";
  const today = todayISODate();

  for (let i = 0; i < offset; i++) {
    const blank = document.createElement("button");
    blank.type = "button";
    blank.className = "date-cell is-blank";
    blank.disabled = true;
    grid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toISODate(new Date(view.year, view.month, day));

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(day);
    button.className = "date-cell";
    button.dataset.iso = iso;

    if (iso === today) button.classList.add("is-today");
    if (iso === selected) button.classList.add("is-selected");

    if (isArrivalDateDisabled(iso)) {
      button.classList.add("is-disabled");
      button.disabled = true;
      button.title = "页面不可选日期";
    }

    grid.appendChild(button);
  }

  syncArrivalManualInputs();
  renderArrivalRangeHint();
  updateArrivalDateText();
}

function shiftArrivalMonth(delta) {
  const view = ensureArrivalView();
  const next = new Date(view.year, view.month + delta, 1);

  arrivalView = { year: next.getFullYear(), month: next.getMonth() };

  renderArrivalCalendar();
}

function setArrivalDate(iso, showMessage = false) {
  const input = $("arrivalDate");

  if (!input) return;

  input.value = iso || "";

  arrivalView = null;

  renderArrivalCalendar();

  saveAll(false);

  if (showMessage) {
    showStatus(
      iso ? `Arrival Date 已设为 ${iso}。` : "已清除 Arrival Date，将使用页面日期。",
      "success"
    );
  }
}

function normalizeAvailability(data) {
  return {
    min: String(data?.min || ""),
    max: String(data?.max || ""),
    disabled: Array.isArray(data?.disabled)
      ? data.disabled.filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item))
      : [],
    pageValue: String(data?.pageValue || ""),
    source: data?.source === "page" ? "page" : "default",
    scanned: data?.scanned === true,
    manual: data?.manual === true,
    updatedAt: Number(data?.updatedAt || 0)
  };
}

function applyArrivalAvailability(data, options = {}) {
  arrivalAvailability = normalizeAvailability({ ...data, source: "page" });
  arrivalAvailabilityNote = "";

  // 页面什么限制都没读到：退回“不早于今天”，避免完全放开。
  if (
    !arrivalAvailability.min &&
    !arrivalAvailability.max &&
    !arrivalAvailability.disabled.length
  ) {
    arrivalAvailability = { ...arrivalAvailability, source: "default" };
    arrivalAvailabilityNote =
      `（页面未给出日期限制，已按今天～明天固定：${todayISODate()} ~ ${tomorrowISODate()}）`;
  }

  arrivalView = null;

  const input = $("arrivalDate");

  if (input?.value && isArrivalDateDisabled(input.value)) {
    input.value = "";

    if (!options.silent) {
      showStatus(
        "已选日期不在页面可选范围内，已清空，请重新选择。",
        "error"
      );
    }
  }

  renderArrivalCalendar();
  saveAll(false);
}

// 手动范围输入框与当前生效范围保持同步（正在输入时不覆盖）。
function syncArrivalManualInputs() {
  const { min, max } = arrivalRange();
  const minEl = $("dateMinInput");
  const maxEl = $("dateMaxInput");

  if (minEl && document.activeElement !== minEl) minEl.value = min || "";
  if (maxEl && document.activeElement !== maxEl) maxEl.value = max || "";
}

// 手动指定可选范围：页面读取不到时用它兜底（例如只允许 10-17 / 10-18）。
function applyManualArrivalRange() {
  const min = $("dateMinInput")?.value || "";
  const max = $("dateMaxInput")?.value || "";

  if (min && max && min > max) {
    showStatus("最早可选日期不能晚于最晚可选日期。", "error");
    syncArrivalManualInputs();
    return;
  }

  arrivalAvailability = {
    ...arrivalAvailability,
    min,
    max,
    source: "page",
    manual: true
  };

  arrivalAvailabilityNote = "（范围已手动指定）";
  arrivalView = null;

  const input = $("arrivalDate");

  if (input?.value && isArrivalDateDisabled(input.value)) {
    input.value = "";
    showStatus("已选日期不在新的可选范围内，已清空。", "error");
  }

  renderArrivalCalendar();
  saveAll(false);
}

async function fetchArrivalAvailability(quiet = false) {
  const btn = $("fetchDateBtn");

  if (btn) btn.disabled = true;

  if (!quiet) showStatus("正在从页面读取 Arrival Date 可选范围……");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_ARRIVAL_DATE_INFO"
    });

    if (!response || response.ok === false) {
      throw new Error(
        response?.message ||
        "读取失败，请确认当前是已加载完成的 SARS 表单页面。"
      );
    }

    if (!response.exists) {
      throw new Error(
        response.reason ||
        "当前页面没有 Arrival Date 字段，请进入第二步 Travel Details 后再试。"
      );
    }

    applyArrivalAvailability(response, { silent: quiet });

    if (!response.scanned) {
      arrivalAvailabilityNote = "（页面日历未能展开，仅按范围限制）";
      renderArrivalRangeHint();
    }

    const { min, max } = arrivalRange();

    if (!quiet) {
      showStatus(
        [
          "Arrival Date 可选范围已更新。",
          `最早：${min || "不限"}　最晚：${max || "不限"}`,
          response.scanned
            ? `已按页面日历禁用 ${arrivalAvailability.disabled.length} 个不可选日期。`
            : "页面日历未能展开，仅按范围限制；如与页面不一致，请手动核对。"
        ].join("\n"),
        response.scanned ? "success" : "error"
      );
    }
  } catch (error) {
    const message = error?.message || String(error);

    arrivalAvailabilityNote = "（未读取到页面日期范围：" + message + "）";
    renderArrivalRangeHint();

    if (!quiet) {
      showStatus("读取 Arrival Date 可选范围失败：" + message, "error");
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindEvents() {
  const bind = (id, event, handler) => {
    const el = $(id);
    if (el) el.addEventListener(event, handler);
  };

  bind("saveBtn", "click", async () => {
    if (!validateSettings()) return;
    await saveAll(true);
  });

  bind("templateBtn", "click", async () => {
    if ($("excelData")) {
      $("excelData").value = getSampleData();
    }
    await parseTravellers();
  });

  bind("clearBtn", "click", clearTravellers);
  bind("parseBtn", "click", parseTravellers);

  bind("exportTemplateBtn", "click", () => {
    copyText("英文姓名\t护照号\t出生日期\t手机号");
  });

  bind("openAndFillBtn", "click", openAndFillAllTravellers);

  bind("fetchOptionsBtn", "click", fetchDropdownOptions);

  // Arrival Date 日历交互。
  bind("arrivalDateTrigger", "click", () => {
    const panel = $("arrivalDatePanel");

    if (!panel) return;

    panel.hidden = !panel.hidden;

    if (!panel.hidden) {
      arrivalView = null;
      renderArrivalCalendar();

      // 首次展开时静默尝试读取页面真实可选范围。
      if (arrivalAvailability.source !== "page") {
        fetchArrivalAvailability(true);
      }
    }
  });

  bind("datePrevBtn", "click", () => shiftArrivalMonth(-1));
  bind("dateNextBtn", "click", () => shiftArrivalMonth(1));

  bind("dateMinInput", "change", applyManualArrivalRange);
  bind("dateMaxInput", "change", applyManualArrivalRange);

  bind("dateClearBtn", "click", () => {
    setArrivalDate("", true);
  });

  bind("fetchDateBtn", "click", () => fetchArrivalAvailability(false));

  bind("dateGrid", "click", event => {
    const cell = event.target.closest(".date-cell");
    const iso = cell?.dataset?.iso;

    if (!iso || cell.disabled || isArrivalDateDisabled(iso)) return;

    const panel = $("arrivalDatePanel");
    if (panel) panel.hidden = true;

    setArrivalDate(iso, true);
  });

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (DROPDOWN_FIELDS.some(field => field.key === key)) continue;
    bind(key, "change", () => saveAll(false));
  }

  for (const field of DROPDOWN_FIELDS) {
    bind(field.key, "change", () => handleDropdownChange(field.key));
  }

  bind("excelData", "change", () => saveAll(false));
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadAll();
    bindEvents();
  } catch (error) {
    console.error("SARS 扩展初始化失败：", error);

    showStatus(
      "初始化失败：" + (error?.message || String(error)),
      "error"
    );
  }
});
