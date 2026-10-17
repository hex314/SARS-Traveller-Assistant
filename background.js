"use strict";

const SARS_URL = "https://tools.sars.gov.za/sarsonlinequery/traveller/";
const SARS_ORIGIN = "https://tools.sars.gov.za";
const TRAVELLER_KEY_PREFIX = "traveller_";

function isSarsTravellerUrl(url) {
  try {
    const parsed = new URL(url);

    return parsed.origin === SARS_ORIGIN &&
      /^\/sarsonlinequery\/traveller\/?$/.test(parsed.pathname);
  } catch (_) {
    return false;
  }
}

// 常规页面（非 traveller 表单页）也包含下拉框等组件，
// 选项获取、联动与诊断只需在 sarsonlinequery 域下即可。
function isSarsQueryUrl(url) {
  try {
    const parsed = new URL(url);

    return parsed.origin === SARS_ORIGIN &&
      parsed.pathname.toLowerCase().startsWith("/sarsonlinequery");
  } catch (_) {
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getActiveSarsQueryTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });

  if (!tab?.id || !isSarsQueryUrl(tab.url || "")) {
    throw new Error(
      "请先切换到 SARS 表单相关页面（tools.sars.gov.za/sarsonlinequery 域下）。"
    );
  }

  return tab;
}

async function waitForTabComplete(tabId, timeoutMs = 45000) {
  const tab = await chrome.tabs.get(tabId);

  if (tab.status === "complete") {
    await sleep(500);
    return;
  }

  await new Promise((resolve, reject) => {
    let finished = false;

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
    };

    const finish = error => {
      if (finished) return;

      finished = true;
      cleanup();

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish();
      }
    };

    const timer = setTimeout(() => {
      finish(new Error("等待页面加载超时。"));
    }, timeoutMs);

    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs.get(tabId)
      .then(currentTab => {
        if (currentTab.status === "complete") {
          finish();
        }
      })
      .catch(finish);
  });

  await sleep(500);
}

async function sendToContentScript(tabId, message) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);

    if (response !== undefined) {
      return response;
    }
  } catch (_) {
    // 内容脚本未响应时，尝试注入。
  }

  const tab = await chrome.tabs.get(tabId);

  if (!isSarsQueryUrl(tab.url || "")) {
    throw new Error("当前标签页不是 SARS 表单相关页面，已停止操作。");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  await sleep(300);

  try {
    const response = await chrome.tabs.sendMessage(tabId, message);

    if (response !== undefined) {
      return response;
    }
  } catch (_) {
    // 交由下方统一报告错误。
  }

  throw new Error(
    "页面脚本没有返回结果。请刷新 SARS 页面后重试。"
  );
}

function formatFillResult(result) {
  if (!result || typeof result !== "object") {
    return {
      ok: false,
      message: "页面没有返回有效的填表结果。"
    };
  }

  const success = Array.isArray(result.success)
    ? result.success
    : [];

  const failed = Array.isArray(result.failed)
    ? result.failed
    : [];

  const lines = [
    `填表处理完成：成功 ${success.length} 项，未完成 ${failed.length} 项。`
  ];

  if (success.length) {
    lines.push("", "已填写：", success.join("、"));
  }

  if (failed.length) {
    lines.push("", "未完成：");

    for (const item of failed) {
      lines.push(
        `- ${item.name || item.field || "未知字段"}：${item.reason || "原因未知"}`
      );
    }
  }

  return {
    ...result,
    message: lines.join("\n")
  };
}

async function openTravellerTabs(message) {
  if (!Array.isArray(message.travellers) || !message.travellers.length) {
    throw new Error("没有可打开的旅客数据。");
  }

  if (!message.settings || typeof message.settings !== "object") {
    throw new Error("缺少公共信息，请先填写并保存。");
  }

  const tabIds = [];

  for (let i = 0; i < message.travellers.length; i++) {
    const tab = await chrome.tabs.create({
      url: SARS_URL,
      active: i === 0
    });

    await chrome.storage.local.set({
      [TRAVELLER_KEY_PREFIX + tab.id]: {
        traveller: message.travellers[i],
        settings: message.settings
      }
    });

    tabIds.push(tab.id);
  }

  return {
    ok: true,
    message: `已打开 ${tabIds.length} 个旅客标签页。`,
    tabIds
  };
}

async function getBoundTravellerTabs() {
  const allData = await chrome.storage.local.get(null);
  const targets = [];

  for (const [key, payload] of Object.entries(allData)) {
    const match = key.match(/^traveller_(\d+)$/);

    if (!match || !payload?.traveller || !payload?.settings) {
      continue;
    }

    const tabId = Number(match[1]);

    try {
      const tab = await chrome.tabs.get(tabId);

      if (isSarsTravellerUrl(tab.url || "")) {
        targets.push({
          tabId,
          payload,
          name: [
            payload.traveller.firstName,
            payload.traveller.surname
          ].filter(Boolean).join(" ") || `标签页 ${tabId}`
        });
      }
    } catch (_) {
      // 标签页已关闭，清理对应的过期旅客数据。
      await chrome.storage.local.remove(key);
    }
  }

  targets.sort((a, b) => a.tabId - b.tabId);

  return targets;
}

async function fillAllTabs() {
  const targets = await getBoundTravellerTabs();

  if (!targets.length) {
    throw new Error(
      "没有找到已绑定旅客数据的 SARS 标签页。请先点击“为所有旅客打开表单标签页”。"
    );
  }

  const results = [];

  // 逐页处理，单页失败不会中断其他旅客。
  for (const target of targets) {
    try {
      await waitForTabComplete(target.tabId);

      const tab = await chrome.tabs.get(target.tabId);

      if (!isSarsTravellerUrl(tab.url || "")) {
        throw new Error("标签页已离开南非申报页面（SARS Traveller）。");
      }

      const rawResult = await sendToContentScript(target.tabId, {
        type: "FILL_FORM",
        payload: target.payload
      });

      const result = formatFillResult(rawResult);

      results.push({
        traveller: target.name,
        tabId: target.tabId,
        ok: result.ok !== false,
        successCount: Array.isArray(result.success)
          ? result.success.length
          : 0,
        failedCount: Array.isArray(result.failed)
          ? result.failed.length
          : 0,
        message: result.message || "页面已处理，但没有详细结果。"
      });
    } catch (error) {
      results.push({
        traveller: target.name,
        tabId: target.tabId,
        ok: false,
        successCount: 0,
        failedCount: 0,
        message: error?.message || String(error)
      });
    }

    // 逐页间隔，避免连续操作过快触发网站限制。
    if (target !== targets[targets.length - 1]) {
      await sleep(800);
    }
  }

  const completed = results.filter(item => item.ok).length;
  const errors = results.length - completed;

  const lines = [
    `批量填写结束：共 ${results.length} 位旅客，处理成功 ${completed} 位，出现错误 ${errors} 位。`
  ];

  for (const result of results) {
    lines.push(
      "",
      `${result.ok ? "✓" : "✗"} ${result.traveller}`,
      result.message
    );
  }

  return {
    ok: errors === 0,
    message: lines.join("\n"),
    results
  };
}

async function openAndFillAll(message) {
  const opened = await openTravellerTabs(message);

  // 给首屏渲染留出时间，fillAllTabs 内部还会逐页等待加载完成。
  await sleep(1000);

  const filled = await fillAllTabs();

  return {
    ok: filled.ok,
    message: `${opened.message}\n${filled.message}`,
    tabIds: opened.tabIds,
    results: filled.results
  };
}

async function fetchDropdownOptions(message) {
  const tab = await getActiveSarsQueryTab();

  return await sendToContentScript(tab.id, {
    type: "GET_DROPDOWN_OPTIONS",
    names: Array.isArray(message.names) ? message.names : []
  });
}

// 在页面下拉框中真实选中某值；随后回读联动子级字段的最新选项。
async function setDropdownValue(message) {
  const tab = await getActiveSarsQueryTab();

  const set = await sendToContentScript(tab.id, {
    type: "SET_DROPDOWN_VALUE",
    name: message.name,
    value: message.value,
    mode: message.mode || "normal"
  });

  let refreshed = null;

  if (Array.isArray(message.refreshNames) && message.refreshNames.length) {
    refreshed = await sendToContentScript(tab.id, {
      type: "GET_DROPDOWN_OPTIONS",
      names: message.refreshNames
    });
  }

  return { ok: true, set, refreshed };
}

async function handleMessage(message) {
  switch (message.type) {
    case "OPEN_AND_FILL":
      return await openAndFillAll(message);

    case "FETCH_OPTIONS":
      return await fetchDropdownOptions(message);

    case "FETCH_ARRIVAL_DATE_INFO": {
      const tab = await getActiveSarsQueryTab();

      return await sendToContentScript(tab.id, {
        type: "GET_ARRIVAL_DATE_INFO"
      });
    }

    case "SET_FIELD_AND_REFRESH":
      return await setDropdownValue(message);

    default:
      throw new Error(
        "不支持的操作：" + String(message.type || "")
      );
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  handleMessage(message)
    .then(sendResponse)
    .catch(error => {
      sendResponse({
        ok: false,
        message: error?.message || String(error)
      });
    });

  return true;
});