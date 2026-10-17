
"use strict";

(() => {
  if (window.__sarsTravellerAssistantInstalled) return;
  window.__sarsTravellerAssistantInstalled = true;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0 ||
      el.getAttribute("aria-hidden") === "true"
    ) return false;

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  async function waitFor(fn, timeout = 5000, interval = 100) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try {
        const result = fn();
        if (result) return result;
      } catch (_) {}
      await sleep(interval);
    }
    return null;
  }

  function cleanText(value) {
    return String(value ?? "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function textOf(el) {
    return cleanText(el?.innerText || el?.textContent || "");
  }

  function dispatchMouseSequence(el) {
    if (!el) return;
    el.scrollIntoView({ block: "center", inline: "nearest" });

    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1
    };

    el.dispatchEvent(new MouseEvent("mousedown", options));
    el.dispatchEvent(new MouseEvent("mouseup", options));
    el.dispatchEvent(new MouseEvent("click", options));
  }

  function setReactValue(el, value) {
    if (!el) return false;

    const prototype = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(
      prototype,
      "value"
    );

    if (descriptor?.set) {
      descriptor.set.call(el, String(value ?? ""));
    } else {
      el.value = String(value ?? "");
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function findVisibleInput(selector) {
    try {
      return [...document.querySelectorAll(selector)].find(el =>
        visible(el) &&
        !el.disabled &&
        !el.readOnly &&
        el.getAttribute("aria-hidden") !== "true"
      ) || null;
    } catch (_) {
      return null;
    }
  }

  async function fillText(selector, value) {
    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {
      return { ok: false, reason: "没有提供填写值" };
    }

    const expected = String(value).trim();

    // 写两次：有些页面在重渲染时会清空刚写入的值。
    for (let attempt = 0; attempt < 2; attempt++) {
      const el = findVisibleInput(selector);

      if (!el) {
        return {
          ok: false,
          reason: `未找到可见输入框：${selector}`
        };
      }

      el.scrollIntoView({ block: "center" });
      el.focus();
      setReactValue(el, expected);
      el.blur();

      await sleep(200);

      const current = findVisibleInput(selector);

      if (current && current.value === expected) {
        return { ok: true, value: current.value };
      }
    }

    const finalEl = findVisibleInput(selector);

    return {
      ok: false,
      reason: `填写后校验失败；目标值：${expected}；实际值：${finalEl?.value || "空"}`
    };
  }

  function formatDate(value) {
    if (value === undefined || value === null || value === "") return "";

    const raw = String(value).trim();

    // 支持 YYYY-MM-DD、YYYY/MM/DD、YYYY.M.D
    let match = raw.match(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
    );

    if (match) {
      return `${match[1]}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}`;
    }

    // 支持 DD/MM/YYYY 或 DD-MM-YYYY
    match = raw.match(
      /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/
    );

    if (match) {
      return `${match[3]}/${match[2].padStart(2, "0")}/${match[1].padStart(2, "0")}`;
    }

    // 支持 Excel 日期序列号
    if (/^\d{5}(\.0+)?$/.test(raw)) {
      const serial = Number(raw);
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      if (!Number.isNaN(date.getTime())) {
        return [
          date.getUTCFullYear(),
          String(date.getUTCMonth() + 1).padStart(2, "0"),
          String(date.getUTCDate()).padStart(2, "0")
        ].join("/");
      }
    }

    return raw;
  }

  function getDateInput() {
    const selectors = [
      'input[placeholder="CCYY/MM/DD"]',
      'input[id="mui-68"]',
      'input[name="dateofbirth"]',
      'input[name="dateOfBirth"]'
    ];

    for (const selector of selectors) {
      const el = findVisibleInput(selector);
      if (el) return el;
    }
    return null;
  }

  function validateFormattedDate(formatted, label) {
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(formatted)) {
      return {
        ok: false,
        reason: `${label}格式不正确：${formatted || "空"}；要求 CCYY/MM/DD`
      };
    }

    const [year, month, day] = formatted.split("/").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return {
        ok: false,
        reason: `${label}不是有效日期：${formatted}`
      };
    }

    return null;
  }

  // 向 MUI DatePicker 输入框写入日期并验证（出生日期 / 到达日期共用）。
  async function writeDateToInput(el, formatted, label) {
    el.scrollIntoView({ block: "center" });
    el.focus();
    setReactValue(el, formatted);
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    el.blur();

    const verified = await waitFor(() =>
      el.value === formatted ? el : null
    , 3000);

    if (!verified) {
      return {
        ok: false,
        reason: `${label}写入后未通过验证；目标值：${formatted}；实际值：${el.value || "空"}`
      };
    }

    return { ok: true, value: verified.value };
  }

  async function fillDate(value) {
    const formatted = formatDate(value);

    const invalid = validateFormattedDate(formatted, "出生日期");
    if (invalid) return invalid;

    const el = await waitFor(() => getDateInput(), 10000);
    if (!el) {
      return {
        ok: false,
        reason: "等待 10 秒后仍未找到可见的 Date of Birth 输入框"
      };
    }

    return await writeDateToInput(el, formatted, "出生日期");
  }

  function getSelectControl(name) {
    const exact = document.getElementById(`${name}-select`);
    if (exact && visible(exact)) return exact;

    // 页面 id 大小写可能不一致（如 ModalityType-select）。
    const target = `${String(name).toLowerCase()}-select`;

    const combo = [...document.querySelectorAll('[role="combobox"]')]
      .find(item =>
        visible(item) &&
        (
          String(item.id || "").toLowerCase() === target ||
          String(item.id || "").toLowerCase() === String(name).toLowerCase()
        )
      );

    if (combo) return combo;

    // 部分字段其实是原生 select（如 Mode of Travel Type）。
    const native = [...document.querySelectorAll("select")]
      .find(item =>
        visible(item) &&
        (
          String(item.id || "").toLowerCase() === target ||
          String(item.id || "").toLowerCase() === String(name).toLowerCase() ||
          String(item.name || "").toLowerCase() === String(name).toLowerCase()
        )
      );

    if (native) return native;

    // 最后按页面标签文本定位（id/name 与预期不一致时）。
    return findSelectByLabel(name);
  }

  // 字段名 → 页面标签文本（用于按标签定位下拉框）。
  const SELECT_LABEL_HINTS = {
    modalitytype: ["mode of travel type", "travel type"],
    travelport: ["mode of travel / airport", "airport"],
    travelmode: ["mode of transport"],
    traveldocumenttype: ["travel document type"],
    occupation: ["occupation"],
    nationality: ["nationality"],
    passportcountry: ["country of issue", "passport country"],
    mobilecode: ["mobile code"]
  };

  function findSelectByLabel(name) {
    const hints = SELECT_LABEL_HINTS[name];

    if (!hints) return null;

    const candidates = [
      ...document.querySelectorAll('[role="combobox"], select')
    ].filter(visible);

    for (const hint of hints) {
      const matches = [];

      for (const el of candidates) {
        let node = el;

        for (let depth = 0; depth < 5 && node; depth++) {
          node = node.parentElement;

          if (!node || node === document.body) break;

          const text = cleanText(node.innerText || "");

          if (!text) continue;

          if (text.includes(hint)) {
            matches.push({ el, size: text.length });
            break;
          }
        }
      }

      if (matches.length) {
        // 容器文本最短者为最贴近该标签的控件。
        matches.sort((a, b) => a.size - b.size);
        return matches[0].el;
      }
    }

    return null;
  }

  function isNativeSelect(el) {
    return Boolean(el) && el.tagName === "SELECT";
  }

  function nativeSelectText(option) {
    return String(option?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function readNativeSelectOptions(control) {
    return [...control.options]
      .map(nativeSelectText)
      .filter(Boolean);
  }

  function selectNativeOption(control, wanted) {
    const target = cleanText(wanted);
    const options = [...control.options];

    const match =
      options.find(option => cleanText(nativeSelectText(option)) === target) ||
      options.find(option =>
        cleanText(nativeSelectText(option)).startsWith(`${target} `)
      ) ||
      options.find(option =>
        cleanText(nativeSelectText(option)).includes(target)
      ) ||
      options.find(option => cleanText(option.value) === target);

    if (!match) {
      return {
        ok: false,
        reason: `下拉框中找不到选项：${wanted}；现有选项：` +
          (readNativeSelectOptions(control).slice(0, 20).join("、") || "空")
      };
    }

    if (control.value === match.value) {
      return {
        ok: true,
        value: nativeSelectText(match),
        alreadySelected: true,
        type: "native-select"
      };
    }

    control.focus?.();
    control.value = match.value;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));

    return control.value === match.value
      ? {
          ok: true,
          value: nativeSelectText(match),
          type: "native-select"
        }
      : {
          ok: false,
          reason: `已选择但页面未接受该值：${wanted}`
        };
  }

  function controlDisplayText(control) {
    if (!control) return "";

    const clone = control.cloneNode(true);
    clone.querySelectorAll("input, svg, button").forEach(el => el.remove());

    return cleanText(clone.innerText || clone.textContent || "");
  }

  function getAssociatedListbox(control) {
    if (!control) return null;

    const ids = [
      control.getAttribute("aria-controls"),
      control.getAttribute("aria-owns")
    ]
      .filter(Boolean)
      .join(" ")
      .split(/\s+/)
      .filter(Boolean);

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && visible(el)) return el;
    }

    const lists = [...document.querySelectorAll('[role="listbox"]')]
      .filter(visible);

    return lists.length === 1 ? lists[0] : null;
  }

  function getOptionMatch(listbox, wanted, mode = "normal") {
    if (!listbox) return null;

    const target = cleanText(wanted);
    const options = [
      ...listbox.querySelectorAll('[role="option"], li')
    ].filter(visible);

    if (mode === "dial-code") {
      return options.find(option => {
        const text = textOf(option);
        return text === target ||
          (text.includes("china") && text.includes("(+86)"));
      }) || null;
    }

    return options.find(option => textOf(option) === target) ||
      options.find(option => textOf(option).startsWith(`${target} `)) ||
      // 兜底：选项全文可能带前缀（如 Travelling Via 的 "- None -"）。
      options.find(option => textOf(option).includes(target)) ||
      null;
  }

  async function selectMui(name, wanted, mode = "normal", finder = null) {
    if (!wanted) {
      return { ok: false, reason: "没有提供目标选项" };
    }

    // finder：按标签定位下拉框（第二步 Travel Details 的下拉框没有稳定 id）。
    const getControl = () => (finder ? finder() : getSelectControl(name));

    let control = getControl();
    if (!control) {
      return {
        ok: false,
        reason: `未找到可见下拉框：${name}`
      };
    }

    if (isNativeSelect(control)) {
      return selectNativeOption(control, wanted);
    }

    const target = cleanText(wanted);
    const currentText = controlDisplayText(control);

    if (
      currentText === target ||
      (mode === "dial-code" &&
        currentText.includes("china") &&
        currentText.includes("(+86)"))
    ) {
      return {
        ok: true,
        value: currentText,
        alreadySelected: true
      };
    }

    // 打开下拉框。若第一种事件没有打开，再尝试 click。
    dispatchMouseSequence(control);

    let expanded = await waitFor(() => {
      const current = getControl();
      return current?.getAttribute("aria-expanded") === "true"
        ? current
        : null;
    }, 1600);

    if (!expanded) {
      control = getControl();
      const innerInput = control?.querySelector("input");

      if (innerInput && visible(innerInput)) {
        innerInput.focus();
        innerInput.click();
      } else if (control) {
        control.focus?.();
        control.click();
      }

      expanded = await waitFor(() => {
        const current = getControl();
        return current?.getAttribute("aria-expanded") === "true"
          ? current
          : null;
      }, 2200);
    }

    if (!expanded) {
      return {
        ok: false,
        reason: `点击后下拉框未展开：${name}`
      };
    }

    const listbox = await waitFor(() => {
      const current = getControl();
      const list = getAssociatedListbox(current);
      if (list) return list;

      const lists = [...document.querySelectorAll('[role="listbox"]')]
        .filter(visible);

      return lists.length === 1 ? lists[0] : null;
    }, 3000);

    if (!listbox) {
      return {
        ok: false,
        reason: `下拉框已展开，但未找到选项列表：${name}`
      };
    }

    const option = await waitFor(
      () => getOptionMatch(listbox, wanted, mode),
      3000
    );

    if (!option) {
      const available = [
        ...listbox.querySelectorAll('[role="option"], li')
      ]
        .filter(visible)
        .map(el => (el.innerText || el.textContent || "").trim())
        .filter(Boolean)
        .slice(0, 15);

      return {
        ok: false,
        reason: `找不到选项：${wanted}` +
          (available.length ? `；当前可见选项：${available.join("、")}` : "")
      };
    }

    const optionText = textOf(option);
    const optionValue =
      option.getAttribute("data-value") ??
      option.getAttribute("value") ??
      "";

    option.scrollIntoView({ block: "center" });
    dispatchMouseSequence(option);

    const selected = await waitFor(() => {
      const current = getControl();
      if (!current) return null;

      const display = controlDisplayText(current);
      const hiddenInput = document.querySelector(
        `input[name="${CSS.escape(name)}"]`
      );

      const displayMatches =
        display === target ||
        display.includes(target) ||
        (mode === "dial-code" &&
          display.includes("china") &&
          display.includes("(+86)"));

      const valueMatches =
        optionValue !== "" &&
        hiddenInput?.value === optionValue;

      if (displayMatches || valueMatches) return current;
      return null;
    }, 3000);

    if (!selected) {
      return {
        ok: false,
        reason: `已点击选项，但无法确认网站已保存选择：${wanted}`
      };
    }

    return {
      ok: true,
      value: controlDisplayText(selected) || optionText,
      internalValue: optionValue || undefined
    };
  }

  // ================= 第二步：Travel Details =================

  // 第二步各下拉框对应的页面标签（用于按标签定位，页面无稳定 id）。
  const STEP2_FIELD_LABELS = {
    travellerType: "traveller type",
    travelReason: "travel reason",
    travellingFrom: "travelling from",
    travellingVia: "travelling via",
    travellingTo: "travelling to"
  };

  // 按标签定位第二步下拉框。逐层向上检查祖先容器文本：
  // 仅当容器包含目标标签且不包含其他第二步标签时才认定匹配，
  // 避免整行/整页容器导致 From / Via / To 互相混淆。
  function findStep2Combobox(key) {
    const wanted = STEP2_FIELD_LABELS[key];

    if (!wanted) return null;

    const allLabels = Object.values(STEP2_FIELD_LABELS);
    const combos = [...document.querySelectorAll('[role="combobox"]')]
      .filter(visible);

    for (const el of combos) {
      const direct = cleanText([
        el.getAttribute("aria-label") || "",
        el.getAttribute("data-label") || ""
      ].join(" "));

      if (direct.includes(wanted)) return el;

      let node = el;

      for (let depth = 0; depth < 6 && node; depth++) {
        node = node.parentElement;

        if (!node || node === document.body) break;

        const text = cleanText(node.innerText || "");

        if (!text) continue;

        const hits = allLabels.filter(label => text.includes(label));

        if (hits.includes(wanted)) {
          if (hits.length === 1) return el;
          // 容器过大，包含多个字段标签，跳过该元素。
          break;
        }
      }
    }

    return null;
  }

  // 按标签定位 Arrival Date 输入框（MUI DatePicker）。
  function findArrivalDateInput() {
    const inputs = [...document.querySelectorAll("input")].filter(el =>
      visible(el) && !el.disabled
    );

    for (const el of inputs) {
      const direct = cleanText([
        el.getAttribute("aria-label") || "",
        el.labels ? [...el.labels].map(l => l.innerText).join(" ") : ""
      ].join(" "));

      if (direct.includes("arrival date")) return el;

      let node = el;

      for (let depth = 0; depth < 6 && node; depth++) {
        node = node.parentElement;

        if (!node || node === document.body) break;

        const text = cleanText(node.innerText || "");

        if (!text) continue;

        if (text.includes("arrival date")) return el;

        // 容器同时含出生日期等其他日期字段时不可靠，停止向上。
        if (text.includes("date of birth")) break;
      }
    }

    return null;
  }

  // 读取日期输入框上页面声明的可选范围（min/max 多种写法）。
  function readDateBounds(el) {
    if (!el) return { min: "", max: "" };

    const read = name => {
      const raw = el.getAttribute(name);

      if (!raw) return "";

      const formatted = formatDate(raw);

      return /^\d{4}\/\d{2}\/\d{2}$/.test(formatted) ? formatted : "";
    };

    return {
      min: read("min") || read("aria-valuemin") || read("data-min") ||
        read("data-min-date") || "",
      max: read("max") || read("aria-valuemax") || read("data-max") ||
        read("data-max-date") || ""
    };
  }

  // Arrival Date：以页面实际可用的日期为准。
  // 1) 页面已带出日期 → 保留（除非弹窗配置了同样合法且有差异的日期）
  // 2) 配置日期超出页面 min/max → 取边界日期
  // 3) 写入被页面拒绝 → 回退到页面原本的日期
  // ---------- 到达日期可选范围（供弹窗禁用不可用日期） ----------

  const MONTH_WORDS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];

  function isoDate(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);

    if (!y || !m || !d) return "";

    const date = new Date(Date.UTC(y, m - 1, d));

    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== m - 1 ||
      date.getUTCDate() !== d
    ) {
      return "";
    }

    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function isoFromSlash(value) {
    const match = String(value || "").match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
  }

  function todayIso() {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-` +
      `${String(now.getDate()).padStart(2, "0")}`;
  }

  function parseISODateParts(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) return null;

    return { year: Number(match[1]), month: Number(match[2]) };
  }

  function parseDateFromText(raw) {
    const text = cleanText(raw);

    if (!text) return "";

    const numeric = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);

    if (numeric) return isoDate(numeric[1], numeric[2], numeric[3]);

    const monthIndex = MONTH_WORDS.findIndex(name => text.includes(name));

    if (monthIndex >= 0) {
      const numbers = text.match(/\d+/g) || [];
      const year = numbers.find(item => item.length === 4);
      const day = numbers.filter(item => item.length <= 2).pop();

      if (year && day) return isoDate(year, monthIndex + 1, day);
    }

    return "";
  }

  const CALENDAR_CELL_SELECTOR =
    '[role="gridcell"], .MuiPickersDay-root, .react-datepicker__day, ' +
    'button[data-timestamp], [data-timestamp]';

  const CALENDAR_ROOT_SELECTOR = [
    '[role="dialog"]',
    ".MuiPickersPopper-root",
    ".MuiPickersPopper-paper",
    ".MuiDatePicker-root",
    ".MuiPickersCalendar-root",
    ".MuiPopover-paper",
    ".MuiPopper-root",
    ".react-datepicker-popper",
    ".react-datepicker",
    '[class*="DatePicker"]',
    '[class*="datePicker"]',
    '[class*="datepicker"]'
  ].join(", ");

  function calendarRootHasCells(el) {
    return !!el.querySelector(CALENDAR_CELL_SELECTOR) ||
      !!el.querySelector('[role="grid"]');
  }

  // 兜底：不依赖弹层容器，直接按日历单元格反推最内层容器。
  function findCalendarRoot() {
    const cells = [...document.querySelectorAll(CALENDAR_CELL_SELECTOR)]
      .filter(visible);

    if (!cells.length) return null;

    for (const cell of cells) {
      const root = cell.closest(
        '[role="grid"], [role="dialog"], .MuiPickersPopper-root, ' +
        '.MuiPickersCalendar-root, .MuiPopover-paper, .MuiPopper-root, ' +
        '.react-datepicker'
      );

      if (root && visible(root)) return root;
    }

    return null;
  }

  function findDatePickerDialog() {
    const candidates = [...document.querySelectorAll(CALENDAR_ROOT_SELECTOR)]
      .filter(el => visible(el) && calendarRootHasCells(el));

    if (!candidates.length) return findCalendarRoot();

    // 取最内层（最具体）的容器，避免把整页当成日历。
    return candidates.find(el =>
      !candidates.some(other => other !== el && el.contains(other))
    ) || candidates[0];
  }

  async function openArrivalCalendar(input) {
    if (!input) return null;

    const opened = findDatePickerDialog();

    if (opened && calendarRootHasCells(opened)) return opened;

    dispatchMouseSequence(input);

    let dialog = await waitFor(() => {
      const found = findDatePickerDialog();
      return found && calendarRootHasCells(found) ? found : null;
    }, 1500);

    if (!dialog) {
      const container =
        input.closest(".MuiFormControl-root") || input.parentElement;

      const iconButton = container
        ? [...container.querySelectorAll("button")].find(visible)
        : null;

      if (iconButton) {
        dispatchMouseSequence(iconButton);
        dialog = await waitFor(() => {
          const found = findDatePickerDialog();
          return found && calendarRootHasCells(found) ? found : null;
        }, 1800);
      }
    }

    if (dialog) {
      // 等待日历单元格渲染。
      await waitFor(
        () => (dialog.querySelectorAll(CALENDAR_CELL_SELECTOR).length ? true : null),
        1500
      );
      await sleep(200);
    }

    return dialog;
  }

  async function closeArrivalCalendar(input) {
    for (const type of ["keydown", "keyup"]) {
      (document.activeElement || document.body).dispatchEvent(
        new KeyboardEvent(type, {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true
        })
      );
    }

    await sleep(200);

    if (findDatePickerDialog()) {
      // 兜底 1：再次点击输入框切换关闭。
      if (input) {
        dispatchMouseSequence(input);
        await sleep(250);
      }
    }

    if (findDatePickerDialog()) {
      // 兜底 2：点击日历面板外部关闭。
      document.body.click();
      await sleep(200);
    }

    input?.blur?.();
  }

  // 月视图里用于占位的相邻月份日期。
  const CALENDAR_FILLER_PATTERN =
    /hiddenDayFiller|dayOutsideMonth|outside-month|outsideMonth|adjacentMonth|is-outside/i;

  const DISABLED_PATTERN =
    /(^|[\s_-])(Mui-disabled|is-disabled|rdp-day_disabled|disabled)([\s_-]|$)/;

  function calendarCellNodes(root) {
    const scope = root || document;

    let cells = [...scope.querySelectorAll(CALENDAR_CELL_SELECTOR)].filter(visible);

    if (!cells.length) {
      // 没有语义化单元格时，退回“只有 1~2 位数字文本”的叶子节点。
      cells = [...scope.querySelectorAll("button, td, div")]
        .filter(el =>
          visible(el) &&
          el.children.length === 0 &&
          /^\d{1,2}$/.test(cleanText(el.textContent))
        );
    }

    return cells;
  }

  // 读取日历当前显示的年月（不同组件写法差异较大）。
  function readCalendarMonth(root) {
    const scope = root || document;

    const candidates = [
      ".MuiPickersCalendarHeader-label",
      ".MuiPickersFadeTransitionGroup-root",
      ".react-datepicker__current-month",
      '[aria-live="polite"]',
      '[class*="CalendarHeader"]',
      '[class*="calendarHeader"]',
      '[class*="PickerHeader"]'
    ];

    for (const selector of candidates) {
      for (const node of scope.querySelectorAll(selector)) {
        if (!visible(node)) continue;

        const text = cleanText(node.textContent);
        if (!text) continue;

        const cn = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
        if (cn) return { year: Number(cn[1]), month: Number(cn[2]) };

        const monthIndex = MONTH_WORDS.findIndex(name =>
          text.toLowerCase().includes(name)
        );
        const yearMatch = text.match(/(\d{4})/);

        if (monthIndex >= 0 && yearMatch) {
          return { year: Number(yearMatch[1]), month: monthIndex + 1 };
        }

        const slash = text.match(/^(\d{1,2})\s*\/\s*(\d{4})$/);
        if (slash) return { year: Number(slash[2]), month: Number(slash[1]) };
      }
    }

    return null;
  }

  function isCellDisabled(button, cell) {
    if (button.disabled === true) return true;

    let node = button;

    for (let depth = 0; node && depth < 5; depth++) {
      const aria = node.getAttribute && node.getAttribute("aria-disabled");

      if (aria === "true" || aria === "disabled") return true;
      if (DISABLED_PATTERN.test(String(node.className || ""))) return true;
      if (node.hasAttribute && node.hasAttribute("disabled")) return true;

      if (node === cell) break;

      node = node.parentElement;
    }

    if (cell && cell !== button) {
      if (cell.getAttribute("aria-disabled") === "true") return true;
      if (DISABLED_PATTERN.test(String(cell.className || ""))) return true;
    }

    return false;
  }

  function scanCalendarDays(root, fallbackMonth) {
    const cells = calendarCellNodes(root);
    const month = readCalendarMonth(root) || fallbackMonth || null;
    const byIso = new Map();

    for (const cell of cells) {
      const button = cell.matches && cell.matches("button")
        ? cell
        : (cell.querySelector("button") || cell);

      const classes =
        String(button.className || "") + " " + String(cell.className || "");

      if (CALENDAR_FILLER_PATTERN.test(classes)) continue;

      const rawTimestamp =
        button.getAttribute("data-timestamp") ||
        cell.getAttribute("data-timestamp") ||
        "";

      let iso = "";

      if (/^\d{10,13}$/.test(rawTimestamp)) {
        iso = new Date(Number(rawTimestamp)).toISOString().slice(0, 10);
      } else {
        iso = parseDateFromText([
          button.getAttribute("aria-label"),
          cell.getAttribute("aria-label"),
          button.getAttribute("data-date"),
          button.getAttribute("title"),
          cell.getAttribute("title")
        ].filter(Boolean).join(" "));
      }

      // 兜底：只有日号文本时，用日历头部年月拼出完整日期。
      if (!iso && month) {
        const text = cleanText(button.textContent || cell.textContent || "");
        const day = (text.match(/^\d{1,2}$/) || [])[0];

        if (day) iso = isoDate(month.year, month.month, day);
      }

      if (!iso) continue;

      const disabled = isCellDisabled(button, cell);
      const existing = byIso.get(iso);

      // 同一日期可能同时出现在相邻月份的占位格里：任一处可选即视为可选。
      byIso.set(iso, {
        iso,
        disabled: existing ? existing.disabled && disabled : disabled
      });
    }

    return [...byIso.values()].sort((a, b) => a.iso.localeCompare(b.iso));
  }

  // 读取 Arrival Date 的真实可选范围与不可用日期。
  async function collectArrivalDateAvailability() {
    const input = findArrivalDateInput();

    if (!input) {
      return {
        exists: false,
        reason: "当前页面没有 Arrival Date 字段（该字段位于第二步 Travel Details）"
      };
    }

    const bounds = readDateBounds(input);
    const pageValue = isoFromSlash(formatDate(input.value));

    // 日历打不开时，用页面已带出/已选的日期作月份兜底。
    const fallbackIso = pageValue || todayIso();
    const fallbackMonth = parseISODateParts(fallbackIso);

    let days = [];
    let root = null;
    let scanned = false;

    root = await openArrivalCalendar(input);

    try {
      if (root) {
        days = scanCalendarDays(root, fallbackMonth);
      }

      if (!days.length) {
        // 兜底：不依赖我们找到的容器，全文档再找一次日历网格。
        const globalRoot = findCalendarRoot();

        if (globalRoot) {
          root = globalRoot;
          days = scanCalendarDays(globalRoot, fallbackMonth);
        }
      }
    } finally {
      if (root) await closeArrivalCalendar(input);
    }

    scanned = days.length > 0;

    const enabledDates = [...new Set(
      days.filter(day => !day.disabled).map(day => day.iso)
    )].sort();

    const disabledDates = [...new Set(
      days.filter(day => day.disabled).map(day => day.iso)
    )].sort();

    let min = isoFromSlash(bounds.min);
    let max = isoFromSlash(bounds.max);

    const firstEnabled = enabledDates[0] || "";
    const lastEnabled = enabledDates[enabledDates.length - 1] || "";

    // 属性缺失时，用日历中观察到的边界推断（仅在确实观察到边界时推断）。
    if (!min && firstEnabled &&
      disabledDates.some(date => date < firstEnabled)) {
      min = firstEnabled;
    }

    if (!max && lastEnabled &&
      disabledDates.some(date => date > lastEnabled)) {
      max = lastEnabled;
    }

    // 观察到“某天之后全部不可选”时，也把边界收紧到最后一个可选日。
    if (!max && lastEnabled && days.length) {
      const gridLast = days[days.length - 1].iso;

      if (gridLast > lastEnabled) {
        const onlyLaterDisabled = days
          .filter(day => day.iso > lastEnabled)
          .every(day => day.disabled);

        if (onlyLaterDisabled) max = lastEnabled;
      }
    }

    if (!min && firstEnabled && days.length) {
      const gridFirst = days[0].iso;

      if (gridFirst < firstEnabled) {
        const onlyEarlierDisabled = days
          .filter(day => day.iso < firstEnabled)
          .every(day => day.disabled);

        if (onlyEarlierDisabled) min = firstEnabled;
      }
    }

    return {
      exists: true,
      scanned,
      pageValue,
      min,
      max,
      disabled: disabledDates,
      enabled: enabledDates,
      enabledCount: enabledDates.length,
      probe: {
        inputType: String(input.getAttribute("type") || ""),
        hasMinAttr: !!bounds.min,
        hasMaxAttr: !!bounds.max,
        calendarFound: !!root,
        cellCount: days.length,
        enabledCount: enabledDates.length,
        firstEnabled,
        lastEnabled
      },
      updatedAt: Date.now()
    };
  }

  async function fillArrivalDate(value) {
    const el = await waitFor(() => findArrivalDateInput(), 10000);

    if (!el) {
      return {
        ok: false,
        reason: "等待 10 秒后仍未找到可见的 Arrival Date 输入框"
      };
    }

    const pageValue = String(el.value || "").trim();
    const bounds = readDateBounds(el);

    let target = formatDate(value);

    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(target) ||
      validateFormattedDate(target, "到达日期")) {
      target = "";
    }

    const notes = [];

    if (target && bounds.min && target < bounds.min) {
      notes.push(`配置日期 ${target} 早于页面最小可选日期 ${bounds.min}，改用 ${bounds.min}`);
      target = bounds.min;
    }

    if (target && bounds.max && target > bounds.max) {
      notes.push(`配置日期 ${target} 晚于页面最大可选日期 ${bounds.max}，改用 ${bounds.max}`);
      target = bounds.max;
    }

    // 未配置或配置无效：沿用页面自动带出的可用日期。
    if (!target) {
      if (pageValue) {
        return {
          ok: true,
          value: pageValue,
          usedPageValue: true,
          note: "未配置到达日期，保留页面自动带出的日期"
        };
      }

      return {
        ok: false,
        reason: "未配置到达日期，且页面未带出可用日期"
      };
    }

    if (pageValue === target) {
      return { ok: true, value: pageValue, alreadySelected: true };
    }

    const written = await writeDateToInput(
      el,
      target,
      "到达日期 Arrival Date"
    );

    // 写入后页面可能回退（日期被禁用/超范围）：以稳定后的值为准。
    if (written.ok) {
      await sleep(350);

      if (el.value === target) {
        return {
          ...written,
          note: notes.join("；") || undefined
        };
      }
    }

    if (pageValue) {
      if (el.value !== pageValue) {
        await writeDateToInput(el, pageValue, "到达日期 Arrival Date");
      }

      return {
        ok: true,
        value: pageValue || el.value,
        usedPageValue: true,
        note: `配置日期 ${target} 不被页面接受，已保留页面可用日期 ${pageValue}`
      };
    }

    return written;
  }

  // 点击 Next 进入第二步 Travel Details，并等待其下拉框渲染完成。
  async function clickNextToTravelDetails() {
    const button = [...document.querySelectorAll("button, [role='button']")]
      .filter(visible)
      .filter(el => !el.closest('[role="listbox"]'))
      .find(el => /^next\b/.test(textOf(el)));

    if (!button) {
      return { ok: false, reason: "未找到可见的 Next 按钮" };
    }

    dispatchMouseSequence(button);

    // 只以第二步特有组件（Traveller Type 下拉框）出现为准；
    // 不能用标题判断——第一步的步骤条上也写着 Travel Details。
    const entered = await waitFor(() =>
      findStep2Combobox("travellerType") ? true : null
    , 10000);

    if (!entered) {
      return {
        ok: false,
        reason: "点击 Next 后 10 秒内未检测到 Travel Details 页面组件"
      };
    }

    await sleep(500);

    return { ok: true, value: "已进入 Travel Details（第二步）" };
  }

  // 填写第二步全部字段（Traveller Type 等 5 个下拉框 + Arrival Date）。
  async function fillTravelDetails(settings, root, record) {
    const sources = [settings, root];

    await record(
      "travellerType",
      selectMui(
        "travellertype",
        valueFrom(sources, ["travellerType", "travellertype"],
          "Travelling in my personal capacity"),
        "normal",
        () => findStep2Combobox("travellerType")
      )
    );

    await record(
      "travelReason",
      selectMui(
        "travelreason",
        valueFrom(sources, ["travelReason", "travelreason"], "Leisure"),
        "normal",
        () => findStep2Combobox("travelReason")
      )
    );

    await record(
      "travellingFrom",
      selectMui(
        "travellingfrom",
        valueFrom(sources, ["travellingFrom", "travellingfrom"], "China"),
        "normal",
        () => findStep2Combobox("travellingFrom")
      )
    );

    await record(
      "travellingVia",
      selectMui(
        "travellingvia",
        valueFrom(sources, ["travellingVia", "travellingvia"], "None"),
        "normal",
        () => findStep2Combobox("travellingVia")
      )
    );

    await record(
      "travellingTo",
      selectMui(
        "travellingto",
        valueFrom(sources, ["travellingTo", "travellingto"], "South Africa"),
        "normal",
        () => findStep2Combobox("travellingTo")
      )
    );

    await record(
      "arrivalDate",
      fillArrivalDate(valueFrom(sources, ["arrivalDate", "arrivaldate"], ""))
    );
  }

  function findDeclarationButtons() {
    return [...document.querySelectorAll("button, [role='button']")]
      .filter(visible)
      .filter(el => {
        const text = textOf(el);
        return /declare/.test(text) && (/\bnil\b/.test(text) || /\bfull\b/.test(text));
      });
  }

  // 收集 Declaration Type 的两个声明按钮（FULL / NIL）。
  async function collectDeclarationOptions() {
    const buttons = findDeclarationButtons();

    if (!buttons.length) {
      return { exists: false, current: "", options: [], type: "declaration" };
    }

    const seen = new Set();
    const options = [];

    for (const button of buttons) {
      const text = (button.innerText || button.textContent || "")
        .replace(/\s+/g, " ")
        .trim();

      if (!text || seen.has(text)) continue;
      seen.add(text);
      options.push(text);
    }

    return {
      exists: true,
      current: "",
      options,
      type: "declaration"
    };
  }

  // 按目标值（NIL / FULL / 页面按钮全文）点击对应声明按钮。
  // NIL 会弹出确认框；FULL 通常无弹窗，出现弹窗时同样确认。
  async function selectDeclarationType(wanted) {
    const target = cleanText(wanted || "NIL");
    const buttons = findDeclarationButtons();

    if (!buttons.length) {
      return {
        ok: false,
        reason: "未找到可见的 Declaration Type 声明按钮"
      };
    }

    const button =
      buttons.find(el => {
        const text = textOf(el);

        if (target.includes("nil")) return /\bnil\b/.test(text);
        if (target.includes("full")) return /\bfull\b/.test(text);
        return text === target;
      }) ||
      buttons.find(el => /\bnil\b/.test(textOf(el)));

    if (!button) {
      return {
        ok: false,
        reason: `未找到匹配的声明选项：${wanted || "NIL"}；` +
          `现有按钮：${buttons.map(el =>
            (el.innerText || "").replace(/\s+/g, " ").trim()
          ).join("、")}`
      };
    }

    dispatchMouseSequence(button);

    // 等待可能出现的确认弹窗；不出现也视为成功。
    const dialog = await waitFor(() => {
      const dialogs = [
        ...document.querySelectorAll(
          '[role="dialog"], [aria-modal="true"], .MuiDialog-root'
        )
      ].filter(visible);

      return dialogs.find(el => {
        const dialogButtons = [
          ...el.querySelectorAll("button, [role='button']")
        ].filter(visible);

        return dialogButtons.some(btn =>
          ["ok", "confirm", "yes"].includes(textOf(btn))
        );
      }) || null;
    }, 3000);

    if (dialog) {
      const okButton = [
        ...dialog.querySelectorAll("button, [role='button']")
      ]
        .filter(visible)
        .find(btn => ["ok", "confirm", "yes"].includes(textOf(btn)));

      if (!okButton) {
        return {
          ok: false,
          reason: "声明确认弹窗中未找到 OK/Confirm 按钮，已停止填表"
        };
      }

      dispatchMouseSequence(okButton);

      const closed = await waitFor(() => !visible(dialog), 5000);

      if (!closed) {
        return {
          ok: false,
          reason: "点击确认后声明弹窗仍未关闭，已停止填表"
        };
      }
    }

    await sleep(500);

    return {
      ok: true,
      value: (button.innerText || button.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
    };
  }

  // ================= 第三步：Payments Summary =================

  // 判断开关/复选框当前是否处于选中（YES）状态。
  function switchIsOn(el) {
    if (!el) return false;

    if (el.tagName === "INPUT") return Boolean(el.checked);

    const aria = el.getAttribute("aria-checked");

    if (aria === "true") return true;
    if (aria === "false") return false;

    return /checked/i.test(String(el.className || ""));
  }

  // 开关统一归一化：优先返回真实的 checkbox input，
  // 便于用 checked 属性判断状态（MUI 的选中类挂在内层节点上）。
  function normalizeSwitchEl(el) {
    if (!el) return null;

    const input = el.matches("input[type='checkbox']")
      ? el
      : el.querySelector?.("input[type='checkbox']");

    return input || el;
  }

  // 定位 Declaration 区域（同时包含标题与声明确认文案的最内层容器）。
  function findDeclarationTextContainer() {
    const candidates = [
      ...document.querySelectorAll("div, section, fieldset, form")
    ].filter(el =>
      visible(el) &&
      /declaration/i.test(textOf(el)) &&
      /true and correct/i.test(textOf(el))
    );

    if (!candidates.length) return null;

    return candidates.find(el =>
      !candidates.some(other => other !== el && el.contains(other))
    ) || candidates[0];
  }

  // 定位第三步 Declaration 的 YES/NO 开关。
  // 优先在声明文案容器内查找；找不到时按“祖先文本含 declare”兜底。
  const SWITCH_SELECTORS = [
    '[role="switch"]',
    'input[type="checkbox"]',
    ".MuiSwitch-root",
    ".ant-switch",
    '[class*="switch" i]'
  ];

  function findDeclarationSwitch() {
    const container = findDeclarationTextContainer();
    const scopes = container ? [container, document] : [document];

    for (const scope of scopes) {
      for (const selector of SWITCH_SELECTORS) {
        let nodes;

        try {
          nodes = [...scope.querySelectorAll(selector)];
        } catch (_) {
          continue;
        }

        const hit = nodes.filter(el => {
          if (el.tagName === "INPUT" && el.type !== "checkbox") {
            return false;
          }

          return visible(el) ||
            visible(el.closest("label") || el.parentElement);
        }).find(el => {
          let node = el;

          for (let depth = 0; depth < 5 && node; depth++) {
            node = node.parentElement;

            if (!node || node === document.body) break;

            if (/declar|true and correct/i.test(textOf(node))) {
              return true;
            }
          }

          return false;
        });

        if (hit) return normalizeSwitchEl(hit);

        // 声明容器内只有一个开关时直接采用（通常就是 Declaration 开关）。
        if (scope !== document) {
          const only = nodes.filter(el => {
            if (el.tagName === "INPUT" && el.type !== "checkbox") {
              return false;
            }

            return visible(el) ||
              visible(el.closest("label") || el.parentElement);
          });

          if (only.length === 1) return normalizeSwitchEl(only[0]);
        }
      }
    }

    return null;
  }

  // 把 Declaration 开关切换为 YES；已是 YES 时直接成功。
  async function setDeclarationToggleYes() {
    const sw = await waitFor(findDeclarationSwitch, 10000);

    if (!sw) {
      return {
        ok: false,
        reason: "未找到 Declaration 区域的 YES/NO 开关"
      };
    }

    if (switchIsOn(sw)) {
      return {
        ok: true,
        value: "Declaration 开关已为 YES",
        alreadySelected: true
      };
    }

    const clickRoot =
      sw.closest?.(".MuiSwitch-root") ||
      sw.closest?.("label") ||
      sw;

    // 优先原生 click()（能正确触发 React 状态更新），再补鼠标事件兜底。
    sw.click?.();

    let verified = await waitFor(() => (switchIsOn(sw) ? sw : null), 2500);

    if (!verified) {
      dispatchMouseSequence(clickRoot);

      verified = await waitFor(() => (switchIsOn(sw) ? sw : null), 2500);
    }

    if (!verified) {
      return {
        ok: false,
        reason: "已点击 Declaration 开关，但未能确认切换为 YES"
      };
    }

    await sleep(400);

    return { ok: true, value: "Declaration 开关已切换为 YES" };
  }

  // 从第二步点击 Next 进入第三步 Payments Summary，
  // 以 Declaration 开关出现为翻页成功的标志。
  async function clickNextToPaymentsSummary() {
    const button = [...document.querySelectorAll("button, [role='button']")]
      .filter(visible)
      .filter(el => !el.closest('[role="listbox"]'))
      .find(el => /^next\b/.test(textOf(el)));

    if (!button) {
      return { ok: false, reason: "未找到可见的 Next 按钮" };
    }

    dispatchMouseSequence(button);

    const entered = await waitFor(
      () => (findDeclarationSwitch() ? true : null),
      10000
    );

    if (!entered) {
      return {
        ok: false,
        reason: "点击 Next 后 10 秒内未检测到 Payments Summary 的 Declaration 开关"
      };
    }

    await sleep(500);

    return { ok: true, value: "已进入 Payments Summary（第三步）" };
  }

  // 第三步的 Next（Payments Summary → 下一页）。
  // 出现确认弹窗时自动确认；以 Next 按钮消失视为翻页成功。
  async function clickFinalNext() {
    const button = [...document.querySelectorAll("button, [role='button']")]
      .filter(visible)
      .filter(el => !el.closest('[role="listbox"]'))
      .find(el => /^next\b/.test(textOf(el)));

    if (!button) {
      return { ok: false, reason: "未找到可见的 Next 按钮" };
    }

    dispatchMouseSequence(button);

    const dialog = await waitFor(() => {
      const dialogs = [
        ...document.querySelectorAll(
          '[role="dialog"], [aria-modal="true"], .MuiDialog-root'
        )
      ].filter(visible);

      return dialogs.find(el =>
        [...el.querySelectorAll("button, [role='button']")]
          .filter(visible)
          .some(btn =>
            ["ok", "confirm", "yes", "proceed"].includes(textOf(btn))
          )
      ) || null;
    }, 3000);

    if (dialog) {
      const okButton = [...dialog.querySelectorAll("button, [role='button']")]
        .filter(visible)
        .find(btn =>
          ["ok", "confirm", "yes", "proceed"].includes(textOf(btn))
        );

      if (okButton) {
        dispatchMouseSequence(okButton);

        await waitFor(() => !visible(dialog), 5000);
      }
    }

    const advanced = await waitFor(() => {
      const still = [...document.querySelectorAll("button, [role='button']")]
        .filter(visible)
        .find(el => /^next\b/.test(textOf(el)));

      return still ? null : true;
    }, 6000);

    if (!advanced) {
      return {
        ok: false,
        reason: "已点击 Next，但页面未见翻页，可能仍有校验未通过，请人工检查"
      };
    }

    await sleep(500);

    return { ok: true, value: "已通过 Payments Summary 的 Next" };
  }

  function getSources(message) {
    const root = message?.payload || message?.data || message || {};

    const traveller =
      root.traveller ||
      root.traveler ||
      root.person ||
      root.passenger ||
      {};

    const settings =
      root.settings ||
      root.common ||
      root.shared ||
      root.publicInfo ||
      root.commonInfo ||
      {};

    return { root, traveller, settings };
  }

  function valueFrom(objects, keys, fallback = "") {
    for (const object of objects) {
      if (!object || typeof object !== "object") continue;

      for (const key of keys) {
        const value = object[key];
        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          return value;
        }
      }
    }
    return fallback;
  }

  function findFlightInput() {
    // 优先使用可能的字段名。
    const byName = findVisibleInput([
      'input[name="transportno"]',
      'input[name="flightNumber"]',
      'input[name="flightNo"]',
      'input[name="flight"]',
      'input[id*="transportno" i]',
      'input[id*="flight" i]'
    ].join(","));

    if (byName) return byName;

    // 其次尝试从标签、ARIA 标签或 placeholder 识别。
    const inputs = [...document.querySelectorAll("input")]
      .filter(el =>
        visible(el) &&
        !el.disabled &&
        !el.readOnly
      );

    return inputs.find(el => {
      const labelText = [
        el.getAttribute("aria-label"),
        el.getAttribute("placeholder"),
        el.labels ? [...el.labels].map(label => label.innerText).join(" ") : "",
        el.parentElement?.innerText || "",
        el.parentElement?.parentElement?.innerText || ""
      ].join(" ");

      return /flight\s*(number|no\.?|#)|transport\s*number/i.test(labelText);
    }) || null;
  }

  function fillFlightNumber(value) {
    if (value === undefined || value === null || String(value).trim() === "") {
      return { ok: false, reason: "没有提供航班号" };
    }

    const el = findFlightInput();

    if (!el) {
      return {
        ok: false,
        reason: "当前页面未找到可见的航班号输入框；未向其他字段写入航班号"
      };
    }

    const expected = String(value).trim();
    el.scrollIntoView({ block: "center" });
    el.focus();
    setReactValue(el, expected);
    el.blur();

    return el.value === expected
      ? { ok: true, value: el.value }
      : {
          ok: false,
          reason: `航班号写入校验失败；实际值：${el.value || "空"}`
        };
  }

  // 自查专用：包含只读输入框（页面可能把某些字段设为只读但仍已填值）。
  function findAnyVisibleInput(selector) {
    try {
      return [...document.querySelectorAll(selector)].find(el =>
        visible(el) && !el.disabled
      ) || null;
    } catch (_) {
      return null;
    }
  }

  // 第一步（Traveller Details）关键字段自查。
  // 页面上的 Next 并不校验必填，缺字段也会翻页，所以点击前必须自查。
  const STEP1_REQUIRED_FIELDS = [
    ["dateOfBirth", () => getDateInput() || findAnyVisibleInput('input[placeholder="CCYY/MM/DD"]'), "出生日期"],
    ["passport", () => findAnyVisibleInput('input[name="passport"]'), "护照号"],
    ["mobile", () => findAnyVisibleInput('input[name="mobile"]'), "手机号"],
    ["firstName", () => findAnyVisibleInput('input[name="name"]'), "名"],
    ["surname", () => findAnyVisibleInput('input[name="surname"]'), "姓"],
    ["street", () => findAnyVisibleInput('input[name="streetname"]'), "街道"],
    ["city", () => findAnyVisibleInput('input[name="city"]'), "城市"],
    ["postal", () => findAnyVisibleInput('input[name="postalcode"]'), "邮政编码"],
    ["email", () => findAnyVisibleInput('input[name="email"]'), "邮箱"]
  ];

  const STEP1_SELECT_CHECKS = [
    "modalitytype",
    "travelport",
    "travelmode",
    "traveldocumenttype",
    "passportcountry",
    "nationality",
    "occupation"
  ];

  function checkStep1Completeness() {
    const missing = [];
    const values = {};

    for (const [name, finder, label] of STEP1_REQUIRED_FIELDS) {
      const el = finder();

      if (!el) {
        missing.push(`${label}（未找到输入框）`);
        continue;
      }

      const value = String(el.value || "").trim();

      values[name] = value;

      if (!value) missing.push(label);
    }

    // 下拉框类字段：只要求页面已显示非空值（页面可能已自动选中）。
    for (const name of STEP1_SELECT_CHECKS) {
      const control = getSelectControl(name);

      if (!control) continue;

      const text = isNativeSelect(control)
        ? nativeSelectText(control.options[control.selectedIndex])
        : controlDisplayText(control);

      if (!String(text || "").trim()) {
        missing.push(`${name}（下拉框尚未选择）`);
      }
    }

    return { missing, values };
  }

  async function fillForm(message) {
    const { root, traveller, settings } = getSources(message);
    const sources = [traveller, settings, root];
    const results = [];

    function addResult(name, result) {
      results.push({
        name,
        ok: Boolean(result?.ok),
        reason: result?.reason || "",
        value: result?.value
      });
    }

    async function record(name, promise) {
      try {
        addResult(name, await promise);
      } catch (error) {
        addResult(name, {
          ok: false,
          reason: error?.message || String(error)
        });
      }
    }

    function buildResult() {
      const success = results.filter(item => item.ok);
      const failed = results.filter(item => !item.ok);

      return {
        ok: failed.length === 0,
        successCount: success.length,
        failedCount: failed.length,
        success: success.map(item => item.name),
        failed: failed.map(item => ({
          name: item.name,
          reason: item.reason
        })),
        details: results
      };
    }

    async function recordText(name, selector, keys) {
      const value = valueFrom(sources, keys);
      await record(name, fillText(selector, value));
    }

    // 1. 先处理 Declaration Type 声明（FULL / NIL）；失败时停止后续填写。
    const declarationWanted = valueFrom(
      sources,
      ["declarationType", "declarationtype", "declaration"],
      "NIL"
    );

    let declarationResult;
    try {
      declarationResult = await selectDeclarationType(declarationWanted);
    } catch (error) {
      declarationResult = {
        ok: false,
        reason: error?.message || String(error)
      };
    }

    // 页面可能已处于第二步（如重跑场景）：跳过第一步，直接填 Travel Details。
    if (!declarationResult.ok && findStep2Combobox("travellerType")) {
      await fillTravelDetails(settings, root, record);

      return buildResult();
    }

    // 页面可能已处于第三步 Payments Summary（如重跑场景）：
    // 跳过前两步，直接把 Declaration 开关置 YES 并自动 Next。
    if (!declarationResult.ok && findDeclarationSwitch()) {
      const toggleResult = await setDeclarationToggleYes();
      addResult("declarationToggle", toggleResult);

      if (toggleResult.ok) {
        await sleep(500);
        addResult("finalNext", await clickFinalNext());
      }

      return buildResult();
    }

    addResult("declarationType", declarationResult);

    if (!declarationResult.ok) {
      return buildResult();
    }

    await sleep(500);

    // 2. 出生日期。
    const dob = valueFrom(sources, [
      "dob",
      "dateOfBirth",
      "birthDate",
      "date_of_birth",
      "出生日期"
    ]);

    await record("dob", fillDate(dob));

    // 3. 从弹窗公共设置读取选项；保留合理默认值。
    const modeOfTravelType = valueFrom(
      [settings, root],
      ["modeOfTravelType", "modalitytype"],
      "Air"
    );

    const port = valueFrom(
      [settings, root],
      ["port", "travelPort", "travelport"],
      "O.R. Tambo International Airport"
    );

    const modeOfTransport = valueFrom(
      [settings, root],
      ["modeOfTransport", "travelMode", "travelmode"],
      "International Aircraft"
    );

    const documentType = valueFrom(
      [settings, root],
      ["travelDocumentType", "traveldocumenttype"],
      "Ordinary Passport"
    );

    let occupation = valueFrom(
      [settings, root],
      ["occupation"],
      "Trade/Business"
    );

    // 兼容旧弹窗中的 Trade-Business。
    if (cleanText(occupation) === "trade-business") {
      occupation = "Trade/Business";
    }

    await record(
      "modeOfTravelType",
      selectMui("modalitytype", modeOfTravelType)
    );

    await record(
      "port",
      selectMui("travelport", port)
    );

    await record(
      "modeOfTransport",
      selectMui("travelmode", modeOfTransport)
    );

    // 目前诊断未发现航班号输入框；找不到时会明确报告。
    addResult(
      "flightNumber",
      fillFlightNumber(valueFrom(
        [settings, root],
        ["flightNumber", "flightNo", "transportno", "flight", "航班号"]
      ))
    );

    await record(
      "travelDocumentType",
      selectMui("traveldocumenttype", documentType)
    );

    // 这两个字段分别代表证件签发国家和国籍。
    // 当前默认值为 China；若旅客情况不同，必须按实际情况调整。
    const documentCountry = valueFrom(
      [settings, root],
      ["travelDocumentCountry", "passportCountry", "passportcountry"],
      "China"
    );

    const nationality = valueFrom(
      [settings, root],
      ["nationality", "countryOfOrigin"],
      "China"
    );

    await record(
      "travelDocumentCountry",
      selectMui("passportcountry", documentCountry)
    );

    await record(
      "nationality",
      selectMui("nationality", nationality)
    );

    await record(
      "occupation",
      selectMui("occupation", occupation)
    );

    // 4. 旅客个人信息。
    await recordText(
      "passport",
      'input[name="passport"]',
      ["passport", "passportNumber", "travelDocumentNumber", "护照号"]
    );

    await record(
      "mobileCode",
      selectMui("mobilecode", "China (+86)", "dial-code")
    );

    await recordText(
      "mobile",
      'input[name="mobile"]',
      ["mobile", "mobileNumber", "phone", "手机号", "手机号码"]
    );

    await recordText(
      "firstName",
      'input[name="name"]',
      ["firstName", "givenName", "first_name", "名", "英文名"]
    );

    await recordText(
      "surname",
      'input[name="surname"]',
      ["surname", "lastName", "familyName", "last_name", "姓", "英文姓"]
    );

    // 5. 公共资料。
    await recordText(
      "street",
      'input[name="streetname"]',
      ["street", "streetName", "address", "streetAddress", "街道"]
    );

    await recordText(
      "city",
      'input[name="city"]',
      ["city", "town", "城市"]
    );

    await recordText(
      "postal",
      'input[name="postalcode"]',
      ["postal", "postalCode", "postcode", "zip", "邮编", "邮政编码"]
    );

    await recordText(
      "email",
      'input[name="email"]',
      ["email", "emailAddress", "邮箱", "电子邮箱"]
    );

    // 6. 点击 NEXT 前先自查第一步：页面 Next 不校验必填，
    // 有字段为空仍会翻页，因此缺失时先补填一次，仍缺则停止进入第二步。
    await sleep(400);

    async function refillMissingStep1() {
      const retryFields = [
        ['input[name="passport"]',
          ["passport", "passportNumber", "travelDocumentNumber", "护照号"]],
        ['input[name="mobile"]',
          ["mobile", "mobileNumber", "phone", "手机号", "手机号码"]],
        ['input[name="name"]',
          ["firstName", "givenName", "first_name", "名", "英文名"]],
        ['input[name="surname"]',
          ["surname", "lastName", "familyName", "last_name", "姓", "英文姓"]],
        ['input[name="streetname"]',
          ["street", "streetName", "address", "streetAddress", "街道"]],
        ['input[name="city"]',
          ["city", "town", "城市"]],
        ['input[name="postalcode"]',
          ["postal", "postalCode", "postcode", "zip", "邮编", "邮政编码"]],
        ['input[name="email"]',
          ["email", "emailAddress", "邮箱", "电子邮箱"]]
      ];

      for (const [selector, keys] of retryFields) {
        const el = findVisibleInput(selector);

        if (!el || String(el.value || "").trim()) continue;

        await fillText(selector, valueFrom(sources, keys));
      }

      const dobInput = getDateInput();

      if (dobInput && !String(dobInput.value || "").trim()) {
        await fillDate(dob);
      }
    }

    let step1Check = checkStep1Completeness();

    if (step1Check.missing.length) {
      // 页面重渲染可能清空已填内容：补填一次再校验。
      await refillMissingStep1();
      await sleep(400);
      step1Check = checkStep1Completeness();
    }

    if (step1Check.missing.length) {
      addResult("step1Completeness", {
        ok: false,
        reason: "第一步仍有字段为空，已停止进入第二步：" +
          step1Check.missing.join("、")
      });

      return buildResult();
    }

    addResult("step1Completeness", {
      ok: true,
      value: "第一步关键字段已全部填写"
    });

    // 7. 进入第二步 Travel Details 并填写其字段。
    const nextResult = await clickNextToTravelDetails();
    addResult("nextToTravelDetails", nextResult);

    if (nextResult.ok) {
      await fillTravelDetails(settings, root, record);
    }

    // 8. 第三步 Payments Summary：点击 Next 进入，
    //    把 Declaration 开关置为 YES 后自动点击 Next。
    await sleep(600);

    if (!findDeclarationSwitch()) {
      const step3Result = await clickNextToPaymentsSummary();
      addResult("nextToPaymentsSummary", step3Result);

      if (!step3Result.ok) {
        return buildResult();
      }
    }

    const declarationToggleResult = await setDeclarationToggleYes();
    addResult("declarationToggle", declarationToggleResult);

    if (declarationToggleResult.ok) {
      await sleep(500);
      addResult("finalNext", await clickFinalNext());
    }

    // 不填写 Hotel / Place of Residence。
    // 不点击最终的提交/申报确认按钮。

    return buildResult();
  }

  async function closeMuiDropdown(name) {
    const active = document.activeElement || document.body;

    for (const type of ["keydown", "keyup"]) {
      active.dispatchEvent(
        new KeyboardEvent(type, {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true
        })
      );
    }

    await sleep(250);

    const control = getSelectControl(name);

    if (control && control.getAttribute("aria-expanded") === "true") {
      dispatchMouseSequence(control);
    }

    await waitFor(
      () =>
        getSelectControl(name)?.getAttribute("aria-expanded") !== "true"
          ? true
          : null,
      1500
    );

    await sleep(200);
  }

  function readListboxOptions(listbox) {
    if (!listbox) return [];

    return [...listbox.querySelectorAll('[role="option"], li')]
      .filter(visible)
      .map(el => (el.innerText || el.textContent || "").trim())
      .filter(Boolean);
  }

  // 打开指定下拉框，读取全部可见选项后关闭，不改变当前选中值。
  async function collectSelectOptions(name) {
    const control = getSelectControl(name);

    if (!control) {
      return { exists: false, current: "", options: [], type: "select" };
    }

    // 原生 select：直接读取全部 option，无需展开。
    if (isNativeSelect(control)) {
      return {
        exists: true,
        type: "native-select",
        current: nativeSelectText(control.options[control.selectedIndex]),
        options: readNativeSelectOptions(control)
      };
    }

    const current = controlDisplayText(control);

    let listbox = null;

    if (control.getAttribute("aria-expanded") === "true") {
      listbox = getAssociatedListbox(control);
    } else {
      dispatchMouseSequence(control);

      listbox = await waitFor(() => {
        const currentControl = getSelectControl(name);

        if (currentControl?.getAttribute("aria-expanded") !== "true") {
          return null;
        }

        const associated = getAssociatedListbox(currentControl);
        if (associated) return associated;

        const lists = [...document.querySelectorAll('[role="listbox"]')]
          .filter(visible);

        return lists.length === 1 ? lists[0] : null;
      }, 3000);
    }

    // 第一种事件没展开时，尝试聚焦内部 input 后再点击。
    if (!listbox) {
      const retryControl = getSelectControl(name);
      const innerInput = retryControl?.querySelector("input");

      if (innerInput && visible(innerInput)) {
        innerInput.focus();
        innerInput.click();
      } else if (retryControl) {
        retryControl.focus?.();
        retryControl.click();
      }

      listbox = await waitFor(() => {
        const currentControl = getSelectControl(name);

        if (currentControl?.getAttribute("aria-expanded") !== "true") {
          return null;
        }

        const associated = getAssociatedListbox(currentControl);
        if (associated) return associated;

        const lists = [...document.querySelectorAll('[role="listbox"]')]
          .filter(visible);

        return lists.length === 1 ? lists[0] : null;
      }, 2200);
    }

    if (!listbox) {
      await closeMuiDropdown(name);
      return {
        exists: true,
        current,
        options: [],
        openFailed: true,
        type: "select"
      };
    }

    // 等待选项渲染完成。
    await waitFor(
      () => (readListboxOptions(listbox).length ? true : null),
      2500
    );

    const options = readListboxOptions(listbox);

    await closeMuiDropdown(name);

    return { exists: true, current, options, type: "select" };
  }

  // 有些字段（如 Mode of Travel Type）在页面上是单选按钮组而非下拉框。
  const RADIO_FIELD_ALIASES = {
    modalitytype: ["modalitytype", "modeoftraveltype", "traveltype"],
    travelport: ["travelport", "port", "airport"],
    travelmode: ["travelmode", "modeoftransport", "transport"],
    traveldocumenttype: ["traveldocumenttype", "documenttype"],
    occupation: ["occupation"]
  };

  // 向上收集最多 6 层祖先的文本，用于把零散控件归组到字段。
  function groupContainerText(el) {
    const parts = [];
    let node = el;

    for (let i = 0; i < 6 && node; i++) {
      node = node.parentElement;

      if (!node || node === document.body) break;

      parts.push(node.innerText || node.textContent || "");
    }

    return parts.join(" ");
  }

  function radioMatchesField(el, name) {
    const aliases = RADIO_FIELD_ALIASES[name] || [name];

    const context = cleanText([
      el.name,
      el.id,
      el.getAttribute("aria-label"),
      el.getAttribute("value"),
      groupContainerText(el)
    ].join(" "));

    return aliases.some(alias => context.includes(cleanText(alias)));
  }

  function findRadioGroup(name) {
    const radios = [...document.querySelectorAll('input[type="radio"]')]
      .filter(el => {
        if (!el.isConnected) return false;
        const wrapper = el.closest("label") || el.parentElement;
        return visible(el) || visible(wrapper);
      })
      .filter(el => radioMatchesField(el, name));

    if (radios.length) return radios;

    // 兜底：字段名无法定位时（如标签离控件较远），
    // 用已知取值（air/land/sea）就地归组。
    const known = KNOWN_GROUP_VALUES[name];

    if (!known) return null;

    const allRadios = [...document.querySelectorAll('input[type="radio"]')]
      .filter(el => {
        if (!el.isConnected) return false;
        const wrapper = el.closest("label") || el.parentElement;
        return visible(el) || visible(wrapper);
      });

    const byValue = allRadios.filter(el =>
      known.includes(cleanText(radioLabel(el)))
    );

    return byValue.length >= 2 ? byValue : null;
  }

  function radioLabel(el) {
    const label =
      el.closest("label") ||
      el.closest(".MuiFormControlLabel-root");

    return String(
      label?.innerText ||
      el.getAttribute("aria-label") ||
      el.value ||
      ""
    ).replace(/\s+/g, " ").trim();
  }

  async function selectRadioOption(name, wanted) {
    const radios = findRadioGroup(name);

    if (!radios) return null;

    const target = cleanText(wanted);

    const match =
      radios.find(el => cleanText(radioLabel(el)) === target) ||
      radios.find(el => {
        const text = cleanText(radioLabel(el));
        return text.includes(target) || target.includes(text);
      });

    if (!match) {
      return {
        ok: false,
        reason: `单选组中找不到选项：${wanted}；` +
          `现有选项：${radios.map(radioLabel).filter(Boolean).join("、")}`
      };
    }

    if (match.checked) {
      return {
        ok: true,
        value: radioLabel(match),
        alreadySelected: true,
        type: "radio"
      };
    }

    const clickTarget =
      match.closest("label") ||
      match.closest(".MuiFormControlLabel-root") ||
      match;

    dispatchMouseSequence(clickTarget);

    let verified = await waitFor(() => (match.checked ? match : null), 3000);

    if (!verified) {
      dispatchMouseSequence(match);

      verified = await waitFor(
        () => (match.checked ? match : null),
        3000
      );
    }

    if (!verified) {
      return {
        ok: false,
        reason: `已点击单选项，但未能确认选中：${wanted}`
      };
    }

    return { ok: true, value: radioLabel(match), type: "radio" };
  }

  // ToggleButton 组（aria-pressed / aria-checked / MuiToggleButton）。
  function findToggleGroup(name) {
    const aliases = RADIO_FIELD_ALIASES[name] || [name];

    const all = [...document.querySelectorAll(
      '[aria-pressed], [aria-checked], .MuiToggleButton-root'
    )]
      .filter(el => el.isConnected && visible(el));

    const byAlias = all.filter(el => {
      const context = cleanText(groupContainerText(el));
      return aliases.some(alias => context.includes(cleanText(alias)));
    });

    if (byAlias.length) return byAlias;

    // 兜底：按已知取值（air/land/sea）归组。
    const known = KNOWN_GROUP_VALUES[name];

    if (!known) return null;

    const byValue = all.filter(el =>
      known.includes(cleanText(toggleLabel(el)))
    );

    return byValue.length >= 2 ? byValue : null;
  }

  function isTogglePressed(el) {
    if (!el) return false;

    if (el.getAttribute("aria-pressed") === "true") return true;
    if (el.getAttribute("aria-checked") === "true") return true;

    return /Mui-selected|MuiToggleButton-selected/.test(
      String(el.className || "")
    );
  }

  function toggleLabel(el) {
    return String(el.innerText || el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function selectToggleOption(name, wanted) {
    const buttons = findToggleGroup(name);

    if (!buttons || !buttons.length) return null;

    const target = cleanText(wanted);

    const match =
      buttons.find(el => cleanText(toggleLabel(el)) === target) ||
      buttons.find(el => {
        const text = cleanText(toggleLabel(el));
        return text.includes(target) || target.includes(text);
      });

    if (!match) {
      return {
        ok: false,
        reason: `按钮组中找不到选项：${wanted}；` +
          `现有选项：${buttons.map(toggleLabel).filter(Boolean).join("、")}`
      };
    }

    if (isTogglePressed(match)) {
      return {
        ok: true,
        value: toggleLabel(match),
        alreadySelected: true,
        type: "toggle"
      };
    }

    dispatchMouseSequence(match);

    const verified = await waitFor(
      () => (isTogglePressed(match) ? match : null),
      3000
    );

    // 部分 ToggleButton 没有 aria-pressed 状态，点击后无法验证，
    // 此时视为已点击成功，由后续字段联动结果兜底。
    return {
      ok: true,
      value: toggleLabel(match),
      type: "toggle",
      unverified: !verified
    };
  }

  // 最后的兜底：某些字段的取值是固定的（如 Air/Land/Sea），
  // 直接按文本查找一组可见可点元素。
  const KNOWN_GROUP_VALUES = {
    modalitytype: ["air", "land", "sea"]
  };

  function findKnownValueGroup(name) {
    const candidates = KNOWN_GROUP_VALUES[name];

    if (!candidates) return null;

    const elements = [
      ...document.querySelectorAll(
        "button, [role='button'], label, .MuiFormControlLabel-root"
      )
    ].filter(el =>
      el.isConnected &&
      (visible(el) || visible(el.closest("label") || el.parentElement))
    );

    const matches = [];

    for (const candidate of candidates) {
      const el = elements.find(item =>
        cleanText(item.innerText || item.textContent || "") === candidate
      );

      if (el) {
        matches.push({
          value: candidate,
          text: (el.innerText || el.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          el
        });
      }
    }

    // 至少命中 2 个候选值才认定是一组选项，避免误点无关元素。
    return matches.length >= 2 ? matches : null;
  }

  async function selectKnownValueOption(name, wanted) {
    const matches = findKnownValueGroup(name);

    if (!matches) return null;

    const target = cleanText(wanted);

    const match =
      matches.find(item => item.value === target) ||
      matches.find(item =>
        item.value.includes(target) || target.includes(item.value)
      );

    if (!match) {
      return {
        ok: false,
        reason: `选项组中找不到：${wanted}；` +
          `现有选项：${matches.map(item => item.text).join("、")}`
      };
    }

    const clickTarget =
      match.el.closest("button") ||
      match.el.closest("label") ||
      match.el;

    dispatchMouseSequence(clickTarget);

    await sleep(400);

    return { ok: true, value: match.text, type: "known-values" };
  }

  async function collectOptions(name) {
    // 1. 先按 MUI 下拉框处理。
    const selectResult = await collectSelectOptions(name);

    if (selectResult.exists && selectResult.options.length) {
      return selectResult;
    }

    // 2. 降级：识别单选按钮组。
    const radios = findRadioGroup(name);

    if (radios) {
      const checked = radios.find(el => el.checked);

      return {
        exists: true,
        type: "radio",
        current: checked ? radioLabel(checked) : "",
        options: radios.map(radioLabel).filter(Boolean)
      };
    }

    // 3. 降级：识别 ToggleButton 按钮组。
    const toggles = findToggleGroup(name);

    if (toggles && toggles.length) {
      const pressed = toggles.find(el => isTogglePressed(el));

      const options = [];
      for (const label of toggles.map(toggleLabel)) {
        if (label && !options.includes(label)) options.push(label);
      }

      return {
        exists: true,
        type: "toggle",
        current: pressed ? toggleLabel(pressed) : "",
        options
      };
    }

    // 4. 兜底：按已知取值（如 Air/Land/Sea）查找选项组。
    const known = findKnownValueGroup(name);

    if (known) {
      return {
        exists: true,
        type: "known-values",
        current: "",
        options: known.map(item => item.text)
      };
    }

    // 5. 组件存在但读不到选项（如只显值的控件）：
    // 用当前显示值本身作为唯一可用选项，保证弹窗不空白且仍可批量填写。
    if (selectResult.exists && selectResult.current) {
      return {
        ...selectResult,
        options: [selectResult.current],
        fromCurrentValue: true
      };
    }

    return selectResult;
  }

  // 统一入口：下拉框 → 单选组 → ToggleButton 组 → 已知取值。
  async function selectAny(name, wanted, mode = "normal") {
    if (getSelectControl(name)) {
      return await selectMui(name, wanted, mode);
    }

    const radioResult = await selectRadioOption(name, wanted);

    if (radioResult) return radioResult;

    const toggleResult = await selectToggleOption(name, wanted);

    if (toggleResult) return toggleResult;

    const knownResult = await selectKnownValueOption(name, wanted);

    if (knownResult) return knownResult;

    return {
      ok: false,
      reason: `未找到可用的下拉框、单选组或选项按钮：${name}`
    };
  }

  function diagnose() {
    const names = [
      "modalitytype",
      "travelport",
      "travelmode",
      "transportno",
      "traveldocumenttype",
      "passportcountry",
      "nationality",
      "occupation",
      "mobilecode",
      "passport",
      "name",
      "surname",
      "mobile",
      "streetname",
      "city",
      "postalcode",
      "email"
    ];

    const visibleInputs = [...document.querySelectorAll("input")]
      .filter(visible)
      .map(el => ({
        name: el.name || "",
        id: el.id || "",
        type: el.type || "",
        placeholder: el.placeholder || "",
        value: el.value || "",
        label: el.labels
          ? [...el.labels].map(label => label.innerText.trim()).join(" ")
          : "",
        parentText: (
          el.parentElement?.parentElement?.innerText || ""
        ).replace(/\s+/g, " ").trim().slice(0, 120)
      }));

    return {
      url: location.href,
      title: document.title,
      contentScriptInstalled: true,

      fields: names.map(name => {
        const control = document.getElementById(`${name}-select`);
        const input = document.querySelector(
          `input[name="${CSS.escape(name)}"]`
        );

        return {
          name,
          selectExists: Boolean(control),
          selectVisible: visible(control),
          ariaExpanded: control?.getAttribute("aria-expanded") ?? null,
          ariaControls: control?.getAttribute("aria-controls") ?? null,
          inputExists: Boolean(input),
          inputVisible: visible(input),
          inputValue: input?.value ?? null,
          displayText: controlDisplayText(control)
        };
      }),

      dateOfBirth: (() => {
        const input = getDateInput();
        return {
          exists: Boolean(input),
          visible: visible(input),
          value: input?.value ?? null,
          placeholder: input?.placeholder ?? null
        };
      })(),

      flightNumberField: (() => {
        const input = findFlightInput();
        return {
          found: Boolean(input),
          name: input?.name || null,
          id: input?.id || null,
          placeholder: input?.placeholder || null,
          label: input?.labels
            ? [...input.labels].map(label => label.innerText.trim()).join(" ")
            : null
        };
      })(),

      modeOfTravelTypeProbe: (() => {
        const control =
          document.getElementById("modalitytype-select") ||
          document.getElementById("ModalityType-select") ||
          [...document.querySelectorAll('[role="combobox"], select')]
            .find(el =>
              String(el.id || "").toLowerCase().includes("modalitytype")
            ) ||
          null;

        const candidates = [
          ...document.querySelectorAll(
            "button, [role='button'], label, [role='radio'], [role='option']"
          )
        ]
          .filter(visible)
          .filter(item => /^(air|land|sea)$/.test(textOf(item)))
          .slice(0, 10)
          .map(item => ({
            tag: item.tagName,
            text: textOf(item),
            role: item.getAttribute("role"),
            ariaPressed: item.getAttribute("aria-pressed"),
            ariaChecked: item.getAttribute("aria-checked"),
            className: String(item.className || "").slice(0, 120)
          }));

        return {
          selectExists: Boolean(control),
          selectTag: control?.tagName ?? null,
          selectId: control?.id ?? null,
          selectClass: control
            ? String(control.className || "").slice(0, 160)
            : null,
          selectValue: isNativeSelect(control) ? control.value : null,
          selectOptions: isNativeSelect(control)
            ? readNativeSelectOptions(control).slice(0, 20)
            : null,
          selectOuterHtml: control
            ? String(control.outerHTML || "").slice(0, 320)
            : null,
          airLandSeaCandidates: candidates
        };
      })(),

      visibleInputs,

      radioGroups: [
        ...document.querySelectorAll('input[type="radio"]')
      ]
        .filter(el => {
          if (!el.isConnected) return false;
          const wrapper = el.closest("label") || el.parentElement;
          return visible(el) || visible(wrapper);
        })
        .map(el => ({
          name: el.name || "",
          checked: Boolean(el.checked),
          label: radioLabel(el),
          groupName:
            el.closest('[role="radiogroup"]')?.getAttribute("aria-label") ||
            el.closest("fieldset")?.querySelector("legend")?.innerText ||
            null
        })),

      visibleListboxes: [
        ...document.querySelectorAll('[role="listbox"]')
      ]
        .filter(visible)
        .map(list => ({
          id: list.id || null,
          options: [
            ...list.querySelectorAll('[role="option"]')
          ]
            .filter(visible)
            .map(el => (el.innerText || el.textContent || "").trim())
        }))
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== "object") return;

    if (message.type === "FILL_FORM") {
      fillForm(message)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({
          ok: false,
          error: error?.message || String(error)
        }));

      return true;
    }

    if (message.type === "DIAGNOSE_FIELDS") {
      sendResponse(diagnose());
    }

    if (message.type === "GET_DROPDOWN_OPTIONS") {
      (async () => {
        const names = Array.isArray(message.names)
          ? message.names
          : [];

        const dropdowns = {};

        for (const name of names) {
          try {
            dropdowns[name] = String(name) === "declarationtype"
              ? await collectDeclarationOptions()
              : await collectOptions(String(name));
          } catch (error) {
            dropdowns[name] = {
              exists: false,
              current: "",
              options: [],
              error: error?.message || String(error)
            };
          }

          await sleep(150);
        }

        sendResponse({ ok: true, dropdowns });
      })();

      return true;
    }

    if (message.type === "GET_ARRIVAL_DATE_INFO") {
      collectArrivalDateAvailability()
        .then(result => sendResponse({ ok: true, ...result }))
        .catch(error => sendResponse({
          ok: false,
          message: error?.message || String(error)
        }));

      return true;
    }

    if (message.type === "SET_DROPDOWN_VALUE") {
      selectAny(message.name, message.value, message.mode || "normal")
        .then(result => sendResponse({ ok: true, result }))
        .catch(error => sendResponse({
          ok: false,
          error: error?.message || String(error)
        }));

      return true;
    }
  });
})();
