// ==UserScript==
// @name         PT勋章扫描器
// @namespace    https://github.com/schalkiii/medal-checker
// @version      1.3.0
// @description  油猴版 PT 勋章扫描器，批量检测 PT 站点可购买勋章
// @author       medal-checker
// @match        http://*/*
// @match        https://*/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @connect      *
// ==/UserScript==

(() => {
  'use strict';

  const KEY_SITES = 'ptms_sites';
  const KEY_RESULTS = 'ptms_scanResults';
  const KEY_HISTORY = 'ptms_scanHistory';
  const KEY_DEBUG = 'ptms_debugData';
  const KEY_SCAN_FAILURES = 'ptms_scanFailures';
  const KEY_SCHEDULE = 'ptms_scheduleConfig';
  const MAX_HISTORY = 60;
  const SCAN_TIMEOUT = 10000;
  const DETECT_TIMEOUT = 15000;

  const DEFAULT_SITES = [
   '春天|https://springsunday.net/badges.php',
   '杜比|https://www.hddolby.com/medals.php',
   '猫站|https://pterclub.net/medal.php',
   '梓喵|https://azusa.wiki/medal.php',
   'Ultra|https://ultrahd.net/medal.php',
   '熊猫|https://pandapt.net/medal.php',
   '烧包|https://ptsbao.club/medal.php',
   '时光|https://hdtime.org/medal.php',
   '优比|https://ubits.club/medal.php',
   '麒麟|https://www.hdkyl.in/medal.php',
   '1pt|https://1ptba.com/medal.php',
   '库菲|https://kufei.org/medal.php',
   '咖啡|https://ptcafe.club/medal.php',
   '野马|https://www.yemapt.org/#/consumer/badge',
   '青蛙|https://qingwapt.com/medal.php',
   '雨|https://raingfh.top/medal.php',
   '织梦|https://zmpt.cc/medal.php',
   'ptfans|https://ptfans.cc/medal.php',
   '葡萄汁|https://ptzone.xyz/medal.php',
   '蟹黄堡|https://crabpt.vip/medal.php',
   '劳改所|https://ptlgs.org/medal.php',
   'GGPT|https://www.gamegamept.com/medal.php',
   'OKPT|https://www.okpt.net/medal.php',
   '蝶粉|https://discfan.net/medal.php',
   '车站|https://carpt.net/medal.php',
   '末日|https://www.agsvpt.com/medal.php',
   '杏坛|https://xingtan.one/medal.php',
   '红豆饭|https://hdfans.org/medal.php',
   '农场|https://pt.0ff.cc/medal.php',
   '憨憨|https://hhanclub.net/medal.php',
   '大青虫|https://cyanbug.net/medal.php',
   'sunny|https://sunnypt.top/medal.php',
   '红豆包|https://hdbao.cc/medal.php',
   '老师|https://www.nicept.net/medal.php',
   '星陨阁|https://pt.xingyungept.org/medal.php',
   '财神|https://cspt.cc/medal.php',
   '冬樱|https://wintersakura.net/medal.php',
   '柠檬不甜|https://lemonhd.net/medal.php',
   '独自|https://pt.hdclone.top/medal.php',
   '电磁炮|https://bilibili.download/medal.php',
   '下水道|https://sewerpt.com/medal.php',
   '龟|https://kamept.com/medal.php',
   '猪猪|https://piggo.me/medal.php',
   '海棠|https://www.htpt.cc/buycenter.php',
   '樱花|https://pt.ying.us.kg/medal.php',
   'pts|https://www.ptskit.org/medal.php',
   '三月|https://duckboobee.org/medal.php',
   '垃圾堆|https://pt.lajidui.top/medal.php',
   '13city|https://13city.org/medal.php',
   '藏宝阁|https://cangbao.ge/medal.php',
   '爱玲|https://pt.aling.de/medal.php',
   '龙|https://longpt.org/medal.php',
   '思齐|https://si-qi.xyz/medal.php',
   'luck|https://pt.luckpt.de/medal.php',
   '好学|https://www.hxpt.org/medal.php',
   'nova|https://pt.novahd.top/medal.php',
   '昆仑|https://www.yhpp.cc/medal.php',
   '暮雪阁|https://pt.muxuege.org/medal.php',
   '太乙|https://pt.tey.cc/medal.php',
   '自然|https://zrpt.cc/medal.php',
   '天枢|https://dubhe.site/medal.php',
   '瞬间|https://www.momentpt.top/medal.php',
   'hdv|https://hdvideo.top/medal.php',
   '躺平|https://www.tangpt.top/medal.php',
   '包子|https://p.t-baozi.cc/medal.php',
   '肉丝|https://rousi.pro/medals',
   '爱萝莉|https://mua.xloli.cc/medal.php',
   'playlet|https://playlet.cc/medal.php',
   'DPS|https://dstudio.me/medal.php',
  ];

  const state = {
    root: null,
    panel: null,
    launcher: null,
    fileInput: null,
    elements: {},
    currentResults: [],
    previousResults: [],
    scanFailures: [],
    diffMode: false,
    filterPermanent: false,
    filterLimited: false,
    filterPositive: false,
    scanning: false,
    detecting: false,
    scheduleTimer: null
  };

  function gmGet(key, fallback) {
    const value = GM_getValue(key);
    return value === undefined ? fallback : value;
  }

  function gmSet(key, value) {
    GM_setValue(key, value);
  }

  function gmDelete(key) {
    GM_deleteValue(key);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function splitSite(siteLine) {
    const idx = siteLine.indexOf('|');
    if (idx < 0) return null;
    const name = siteLine.slice(0, idx).trim();
    const url = siteLine.slice(idx + 1).trim();
    if (!name || !/^https?:\/\//i.test(url)) return null;
    return { siteName: name, siteUrl: url, line: `${name}|${url}` };
  }

  function parseSitesText(text) {
    const seen = new Set();
    const sites = [];
    text.split('\n').forEach(line => {
      const parsed = splitSite(line.trim());
      if (!parsed || seen.has(parsed.line)) return;
      seen.add(parsed.line);
      sites.push(parsed.line);
    });
    return sites;
  }

  function getColumnLayout(tdsLength) {
    if (tdsLength <= 0) return null;
    if (tdsLength % 10 === 0) return { stride: 10, actionIdx: 8, nameIdx: 2, priceIdx: 6, durationIdx: 4, bonusIdx: 5, stockIdx: 7, timeIdx: 3 };
    if (tdsLength % 9 === 0) return { stride: 9, actionIdx: 7, nameIdx: 1, priceIdx: 5, durationIdx: 3, bonusIdx: 4, stockIdx: 6, timeIdx: 2 };
    return null;
  }

  function extractTdText(tdHtml) {
    return tdHtml
      .replace(/<h1[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractMedalsFromCards(html) {
    const medals = [];
    const cards = [];
    const cardTagRegex = /<div[^>]*\bclass=["']medal-card\b[^>]*>/gi;
    let cardMatch;

    while ((cardMatch = cardTagRegex.exec(html)) !== null) {
      const cardStart = cardMatch.index;
      let d = 0;
      let cardEnd = -1;
      for (let i = cardStart; i < html.length; i++) {
        if (html[i] === '<') {
          const tagEnd = html.indexOf('>', i);
          if (tagEnd < 0) break;
          const tag = html.substring(i, tagEnd + 1);
          if (tag.startsWith('<div ') || tag.startsWith('<div>')) d++;
          else if (tag.startsWith('</div>')) {
            d--;
            if (d === 0) {
              cardEnd = tagEnd + 1;
              break;
            }
          }
          i = tagEnd;
        }
      }
      if (cardEnd > 0) {
        cards.push(html.substring(cardStart, cardEnd));
      }
    }

    for (const card of cards) {
      const actionMatch = card.match(/<(?:input|button)[^>]*\bclass="([^"]*\bbuy\b[^"]*)"[^>]*\/?\s*>/i);
      if (!actionMatch) continue;

      const actionHtml = actionMatch[0];
      const isButton = actionHtml.startsWith('<button');

      let hasPurchaseText = false;
      if (isButton) {
        const btnClose = card.indexOf('</button>', actionMatch.index);
        if (btnClose < 0) continue;
        const btnText = card.substring(actionMatch.index + actionHtml.length, btnClose).trim();
        if (btnText.includes('购买') || btnText.includes('購買')) hasPurchaseText = true;
      } else if (actionHtml.includes('value="购买"') || actionHtml.includes('value="購買"')) {
        hasPurchaseText = true;
      }
      if (!hasPurchaseText) continue;
      if (actionHtml.includes('disabled')) continue;

      const dataIdMatch = actionHtml.match(/data-id="(\d+)"/);
      const medalId = dataIdMatch ? dataIdMatch[1] : '';

      let name = '';
      const namePattern = /<(?:h[1-4]|div|span)\s+class="(?:medal-name|medal-title|medal-card__name)"[^>]*>([\s\S]*?)<\/(?:h[1-4]|div|span)>/i;
      const nameMatch = card.match(namePattern);
      if (nameMatch) {
        name = nameMatch[1].trim();
      } else {
        const imgAlt = card.match(/<img[^>]*\balt="([^"]*)"[^>]*>/i);
        if (imgAlt) name = imgAlt[1].trim();
      }
      if (!name) {
        const fallbackH = card.match(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/i);
        if (fallbackH) name = fallbackH[2].replace(/<[^>]+>/g, '').trim().replace(/\s*\(#\d+\)\s*$/, '');
      }

      let price = '';
      let duration = '';
      let bonus = '';
      let stock = '';
      let timeRange = '';
      const labelValuePatterns = [
        /<span\s+class="detail-label">([^<]*)<\/span>\s*<span\s+class="detail-value">([^<]*)<\/span>/gi,
        /<span\s+class="meta-label">([^<]*)<\/span>\s*<span\s+class="meta-value">([^<]*)<\/span>/gi,
        /<span\s+class="medal-card__label">([^<]*)<\/span>\s*<span\s+class="medal-card__value">([^<]*)<\/span>/gi,
        /<div\s+class="meta-label">([^<]*)<\/div>\s*<div\s+class="meta-value">([^<]*)<\/div>/gi,
        /<span\s+class="stat-label">([^<]*)<\/span>\s*<span\s+class="stat-value">([^<]*)<\/span>/gi
      ];

      for (const lvRegex of labelValuePatterns) {
        lvRegex.lastIndex = 0;
        let lvMatch;
        while ((lvMatch = lvRegex.exec(card)) !== null) {
          const label = lvMatch[1].trim();
          const val = lvMatch[2].trim();
          if (label.includes('价格') || label.includes('價格')) price = val;
          else if (label.includes('有效期')) duration = val;
          else if (label.includes('加成')) bonus = val;
          else if (label.includes('库存') || label.includes('庫存')) stock = val;
          else if (label.includes('可购买') || label.includes('可購買')) timeRange = val;
        }
      }

      if (!price && !duration && !bonus && !stock && !timeRange) {
        const fieldPairs = card.match(/<strong>([^<]+)<\/strong>([\s\S]*?)<\/div>/g) || [];
        for (const pair of fieldPairs) {
          const labelMatch = pair.match(/<strong>([^<]+)<\/strong>/);
          if (!labelMatch) continue;
          const label = labelMatch[1].replace(/[：:]/g, '').trim();
          let val = pair.replace(/<[^>]+>/g, '');
          const labelClean = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          val = val.replace(new RegExp('^' + labelClean + '\\s*[:：]?\\s*'), '').trim();
          if (!val) val = pair.replace(/<[^>]+>/g, '').replace(/：/g, ':').replace(/^[^:]*[:：]\s*/, '').trim();
          if (label.includes('价格') || label.includes('價格')) price = val;
          else if (label.includes('有效期')) duration = val;
          else if (label.includes('加成')) bonus = val;
          else if (label.includes('库存') || label.includes('庫存')) stock = val;
          else if (label.includes('可购买') || label.includes('可購買')) timeRange = val;
        }
      }

      if (name) medals.push({ name, price, duration, bonus, stock, timeRange, medalId });
    }
    return medals;
  }

  function extractMedalsFromHtml(html) {
    const medals = [];
    const rows = html.match(/<tr[\s\S]*?(?=<tr|$)/gi) || [];

    for (const row of rows) {
      const tds = [];
      const tdRegex = /<td[^>]*>[\s\S]*?<\/td>/gi;
      let tdMatch;
      while ((tdMatch = tdRegex.exec(row)) !== null) tds.push(tdMatch[0]);

      const layout = getColumnLayout(tds.length);
      if (!layout) continue;

      for (let i = 0; i + layout.stride - 1 < tds.length; i += layout.stride) {
        const group = tds.slice(i, i + layout.stride);
        const actionTd = group[layout.actionIdx] || '';
        if (!actionTd.includes('value="购买"') && !actionTd.includes('value="購買"')) continue;

        const medalIdMatch = actionTd.match(/name="medal"\s+value="(\d+)"/);
        const medalId = medalIdMatch ? medalIdMatch[1] : '';
        const nameText = extractTdText(group[layout.nameIdx] || '');
        const nameH1 = nameText.match(/^(.+?)(?:\n|$)/);
        const name = nameH1 ? nameH1[1].trim() : '未知勋章';
        const price = extractTdText(group[layout.priceIdx] || '').trim();
        const durationRaw = extractTdText(group[layout.durationIdx] || '').trim();
        const duration = durationRaw === '不限' ? '不限' : durationRaw;
        const bonus = extractTdText(group[layout.bonusIdx] || '').trim();
        const stock = extractTdText(group[layout.stockIdx] || '').trim();
        const timeRaw = extractTdText(group[layout.timeIdx] || '').trim();
        const timeRange = timeRaw === '不限 ~ 不限' ? '不限' : timeRaw;

        medals.push({ name, price, duration, bonus, stock, timeRange, medalId });
      }
    }

    if (medals.length === 0) {
      const cardMedals = extractMedalsFromCards(html);
      if (cardMedals.length > 0) return cardMedals;
    }

    return medals;
  }

  function extractMedalsFromBuyCenter(html) {
    const medals = [];
    const rows = html.match(/<tr[\s\S]*?(?=<tr|$)/gi) || [];

    for (const row of rows) {
      const tds = [];
      const tdRegex = /<td[^>]*>[\s\S]*?<\/td>/gi;
      let tdMatch;
      while ((tdMatch = tdRegex.exec(row)) !== null) tds.push(tdMatch[0]);

      if (tds.length < 6) continue;

      const actionTd = tds[5] || '';
      if (!actionTd.includes('交换') || actionTd.includes('disabled')) continue;

      const nameText = extractTdText(tds[1] || '');
      if (nameText.length < 10 || nameText === '简介') continue;

      const markerIdx = nameText.indexOf(' ⠀');
      const name = markerIdx > 0 ? nameText.substring(0, markerIdx).trim() : nameText;
      const price = extractTdText(tds[4] || '').trim();
      const stock = extractTdText(tds[2] || '').trim();
      const durationMatch = nameText.match(/(\d+)\s*天|永久/);
      const duration = durationMatch ? durationMatch[0] : '';
      const timeMatch = nameText.match(/可购买时间:\s*([^)]+)/);
      const timeRange = timeMatch ? timeMatch[1].trim() : '';

      medals.push({ name, price, duration, stock, timeRange });
    }

    return medals;
  }

  function requestText(url, options = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: options.method || 'GET',
        url,
        data: options.data,
        headers: options.headers || {},
        timeout: options.timeout || SCAN_TIMEOUT,
        anonymous: false,
        onload: response => resolve({
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          finalUrl: response.finalUrl || url,
          responseText: response.responseText || ''
        }),
        ontimeout: () => {
          const err = new Error('请求超时');
          err.name = 'TimeoutError';
          reject(err);
        },
        onabort: () => reject(new Error('请求已中止')),
        onerror: error => reject(new Error(error?.error || '网络请求失败'))
      });
    });
  }

  function pageUrl(url, page) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set('page', String(page));
      return parsed.toString();
    } catch {
      return `${url}${url.includes('?') ? '&' : '?'}page=${page}`;
    }
  }

  function getMedalFingerprint(siteName, medal) {
    return `${siteName}::${medal.name}`;
  }

  function computeDiff(current, previous) {
    if (!previous || previous.length === 0) return {};

    const prevFingerprints = new Set();
    previous.forEach(site => {
      (site.medals || []).forEach(medal => {
        prevFingerprints.add(getMedalFingerprint(site.siteName, medal));
      });
    });

    const diffMap = {};
    current.forEach(site => {
      const newMedals = (site.medals || []).filter(medal =>
        !prevFingerprints.has(getMedalFingerprint(site.siteName, medal))
      );
      if (newMedals.length > 0) {
        diffMap[site.siteName] = new Set(newMedals.map(medal => getMedalFingerprint(site.siteName, medal)));
      }
    });
    return diffMap;
  }

  function addLog(message, isError = false) {
    const logElement = state.elements.log;
    if (!logElement) return;
    const entry = document.createElement('div');
    entry.className = `ptms-log-entry${isError ? ' ptms-error' : ''}`;
    const time = document.createElement('span');
    time.className = 'ptms-time';
    time.textContent = `[${new Date().toLocaleTimeString()}]`;
    const text = document.createElement('span');
    text.textContent = message;
    entry.append(time, text);
    logElement.appendChild(entry);
    logElement.scrollTop = logElement.scrollHeight;
  }

  function clearLog() {
    if (state.elements.log) state.elements.log.innerHTML = '';
  }

  function loadSavedState() {
    const sites = gmGet(KEY_SITES, []);
    const results = gmGet(KEY_RESULTS, []);
    const history = gmGet(KEY_HISTORY, []);
    const scanFailures = gmGet(KEY_SCAN_FAILURES, []);
    const scheduleConfig = gmGet(KEY_SCHEDULE, { enabled: false, time: '08:00', webhookUrl: '' });

    state.currentResults = results;
    state.previousResults = history.length >= 2 ? history[history.length - 2].results : [];
    state.scanFailures = scanFailures;
    state.elements.sites.value = sites.join('\n');
    state.elements.scheduleEnabled.checked = Boolean(scheduleConfig.enabled);
    state.elements.scheduleTime.value = scheduleConfig.time || '08:00';
    state.elements.webhookUrl.value = scheduleConfig.webhookUrl || '';
    renderScheduleStatus();
    renderResults(results);
  }

  function saveSitesFromTextarea() {
    const sites = parseSitesText(state.elements.sites.value);
    if (sites.length === 0) {
      addLog('配置保存失败：未检测到有效站点', true);
      return [];
    }
    gmSet(KEY_SITES, sites);
    state.elements.sites.value = sites.join('\n');
    addLog(`配置已保存（${sites.length} 个站点）`);
    return sites;
  }

  async function scanOneSite(siteLine, allPageHtmls) {
    const parsed = splitSite(siteLine);
    if (!parsed) throw new Error('站点格式无效');

    const { siteName, siteUrl } = parsed;
    const response = await requestText(siteUrl, { timeout: SCAN_TIMEOUT });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = response.responseText;
    allPageHtmls.push({ url: siteUrl, html });

    let medals = siteUrl.includes('buycenter.php')
      ? extractMedalsFromBuyCenter(html)
      : extractMedalsFromHtml(html);
    let pageCount = 1;

    for (let i = 1; i < 15; i++) {
      const re = new RegExp(`href\\s*=\\s*["']\\?page=${i}["']`, 'g');
      if ((html.match(re) || []).length === 0) break;

      const nextUrl = pageUrl(siteUrl, i);
      try {
        const pageResponse = await requestText(nextUrl, { timeout: SCAN_TIMEOUT });
        if (!pageResponse.ok) break;
        const pageHtml = pageResponse.responseText;
        allPageHtmls.push({ url: nextUrl, html: pageHtml });
        medals = medals.concat(extractMedalsFromHtml(pageHtml));
        pageCount++;
      } catch (error) {
        addLog(`分页请求失败：${siteName} 第 ${i} 页（${error.message}）`, true);
        break;
      }
    }

    return { siteName, count: medals.length, url: siteUrl, medals, pageCount };
  }

  async function startScan(options = {}) {
    if (state.scanning) {
      addLog('扫描正在进行中', true);
      return state.currentResults;
    }

    const sites = options.sites || saveSitesFromTextarea();
    if (!sites || sites.length === 0) return [];

    state.scanning = true;
    setBusy(state.elements.scanBtn, true, '⏳ 扫描中...');
    if (!options.keepLog) clearLog();
    addLog(`开始扫描 ${sites.length} 个站点`);

    const results = [];
    const scanFailures = [];
    const allPageHtmls = [];

    for (let i = 0; i < sites.length; i++) {
      const parsed = splitSite(sites[i]);
      if (!parsed) {
        scanFailures.push({ siteName: sites[i] || '无效配置', url: '', error: '站点格式无效' });
        continue;
      }
      addLog(`[${i + 1}/${sites.length}] 请求 ${parsed.siteName}`);

      try {
        const result = await scanOneSite(sites[i], allPageHtmls);
        results.push({
          siteName: result.siteName,
          count: result.count,
          url: result.url,
          medals: result.medals
        });
        addLog(`${result.siteName}: 共 ${result.pageCount} 页，发现 ${result.count} 个可购买勋章`);
      } catch (error) {
        const message = error.name === 'TimeoutError'
          ? `请求超时：${parsed.siteName}`
          : `扫描失败：${parsed.siteName}（${error.message}）`;
        scanFailures.push({ siteName: parsed.siteName, url: parsed.siteUrl, error: error.message });
        addLog(message, true);
      }
    }

    const timestamp = Date.now();
    const dateStr = new Date(timestamp).toISOString().slice(0, 10);
    const history = gmGet(KEY_HISTORY, []);
    history.push({ timestamp, dateStr, results });
    while (history.length > MAX_HISTORY) history.shift();

    gmSet(KEY_RESULTS, results);
    gmSet(KEY_HISTORY, history);
    gmSet(KEY_DEBUG, { timestamp, dateStr, pages: allPageHtmls });
    gmSet(KEY_SCAN_FAILURES, scanFailures);

    state.currentResults = results;
    state.previousResults = history.length >= 2 ? history[history.length - 2].results : [];
    state.scanFailures = scanFailures;
    renderResults(results);
    addLog('扫描完成');

    state.scanning = false;
    setBusy(state.elements.scanBtn, false, '🚀 开始扫描');
    return results;
  }

  function hasLoggedInSignals(html) {
    const sample = html.slice(0, 24000);
    const lower = sample.toLowerCase();
    return /logout|userdetails|mybonus|usercp|messages|bonus\.php|logout\.php|userdetails\.php|attendance|invite|upload\.php|torrents\.php|uploaded|downloaded/.test(lower)
      || /退出|登出|注销|控制面板|个人资料|魔力|上传量|下载量|做种|邀请|消息|短讯|我的账户|积分/.test(sample);
  }

  function looksLikeLoginPage(html, finalUrl) {
    const sample = html.slice(0, 24000);
    const lower = sample.toLowerCase();
    const url = String(finalUrl || '').toLowerCase();

    if (hasLoggedInSignals(sample)) return false;

    const urlLooksLogin = /\/(login|signin|takelogin)(?:[/?#]|$)/.test(url)
      || /[?&](?:login|signin)=/.test(url);
    const titleLooksLogin = /<title>[^<]*(?:login|signin|登录|登入)[^<]*<\/title>/i.test(sample);
    const hasPasswordInput = /<input[^>]+type\s*=\s*["']?password/i.test(sample);
    const hasLoginAction = /<form[^>]+action\s*=\s*["'][^"']*(?:login|takelogin|signin)/i.test(sample);
    const hasUsernameInput = /<input[^>]+name\s*=\s*["']?(?:username|user|email|uid)/i.test(sample);
    const hasLoginText = /登录|登入|sign in|signin/.test(lower);
    const hasCaptcha = /验证码|captcha/i.test(sample);

    return urlLooksLogin
      || titleLooksLogin
      || (hasPasswordInput && (hasLoginAction || hasUsernameInput || hasLoginText || hasCaptcha));
  }

  async function detectDefaultSites() {
    if (state.detecting) {
      addLog('内置站点检测正在进行中', true);
      return;
    }

    state.detecting = true;
    setBusy(state.elements.detectBtn, true, '⏳ 检测中...');
    clearLog();
    addLog(`开始检测内置站点。油猴无法枚举 Cookie，这里以页面是否可访问作为判断，单站超时 ${Math.round(DETECT_TIMEOUT / 1000)} 秒。`);

    const found = [];
    const notFound = [];
    for (let i = 0; i < DEFAULT_SITES.length; i++) {
      const parsed = splitSite(DEFAULT_SITES[i]);
      if (!parsed) continue;

      try {
        const started = Date.now();
        const response = await requestText(parsed.siteUrl, { timeout: DETECT_TIMEOUT });
        const medals = parsed.siteUrl.includes('buycenter.php')
          ? extractMedalsFromBuyCenter(response.responseText)
          : extractMedalsFromHtml(response.responseText);
        const loginPage = looksLikeLoginPage(response.responseText, response.finalUrl);
        const httpOk = response.status >= 200 && response.status < 400;
        const hasBody = response.responseText.trim().length > 0;
        const accessible = medals.length > 0 || (httpOk && hasBody && !loginPage);
        const elapsed = Date.now() - started;

        if (accessible) {
          found.push(parsed.line);
          addLog(`[${i + 1}/${DEFAULT_SITES.length}] ${parsed.siteName}: 可访问，${medals.length} 个可购候选（${elapsed}ms）`);
        } else {
          const reason = !httpOk ? `HTTP ${response.status}` : (loginPage ? '疑似登录页' : '页面为空或不可用');
          notFound.push({ siteName: parsed.siteName, url: parsed.siteUrl, reason });
          addLog(`[${i + 1}/${DEFAULT_SITES.length}] ${parsed.siteName}: ${reason}`, true);
        }
      } catch (error) {
        notFound.push({ siteName: parsed.siteName, url: parsed.siteUrl, reason: error.message });
        addLog(`[${i + 1}/${DEFAULT_SITES.length}] ${parsed.siteName}: ${error.message}`, true);
      }
    }

    const existing = parseSitesText(state.elements.sites.value);
    const existingUrls = new Set(existing.map(line => splitSite(line)?.siteUrl).filter(Boolean));
    const newSites = found.filter(line => {
      const parsed = splitSite(line);
      return parsed && !existingUrls.has(parsed.siteUrl);
    });
    const merged = existing.concat(newSites);
    state.elements.sites.value = merged.join('\n');
    gmSet(KEY_SITES, merged);

    state.elements.detectSummary.innerHTML = `
      <div>检测 <strong>${DEFAULT_SITES.length}</strong> 个内置站点，可访问 <strong>${found.length}</strong> 个，新增 <strong>${newSites.length}</strong> 个，未通过 <strong>${notFound.length}</strong> 个。</div>
      ${renderSiteLinkList('未通过站点：', notFound, '没有未通过站点')}
    `;
    addLog(`内置站点检测完成：新增 ${newSites.length} 个站点`);
    state.detecting = false;
    setBusy(state.elements.detectBtn, false, '🔍 检测内置站点');
  }

  function getFilteredSites(results) {
    const diffMap = state.diffMode ? computeDiff(results, state.previousResults) : {};
    const filtered = [];

    results.forEach(site => {
      let medals = site.medals || [];

      if (state.diffMode) {
        const siteNewFps = diffMap[site.siteName];
        medals = siteNewFps
          ? medals.filter(medal => siteNewFps.has(getMedalFingerprint(site.siteName, medal)))
          : [];
      }
      if (state.filterPermanent) {
        medals = medals.filter(medal => medal.duration && (medal.duration.includes('不限') || medal.duration.includes('永久')));
      }
      if (state.filterLimited) {
        medals = medals.filter(medal => medal.timeRange && !medal.timeRange.includes('不限'));
      }
      if (state.filterPositive) {
        medals = medals.filter(medal => medal.bonus && parseFloat(medal.bonus) > 0);
      }
      if (medals.length > 0) filtered.push({ ...site, medals, count: medals.length });
    });

    return { filtered, diffMap };
  }

  function renderSiteLinkList(title, sites, emptyText = '') {
    if (!sites || sites.length === 0) {
      return emptyText ? `<div class="ptms-site-link-list ptms-site-link-empty">${escapeHtml(emptyText)}</div>` : '';
    }

    const items = sites.map(site => {
      const siteName = escapeHtml(site.siteName || site.name || '未知站点');
      const reason = site.error || site.reason ? `<small>${escapeHtml(site.error || site.reason)}</small>` : '';
      const link = site.url
        ? `<a href="${escapeHtml(site.url)}" target="_blank" rel="noopener noreferrer">打开勋章页</a>`
        : '<span class="ptms-no-link">无有效链接</span>';
      return `<span class="ptms-site-link-item"><strong>${siteName}</strong>${link}${reason}</span>`;
    }).join('');

    return `<div class="ptms-site-link-list"><b>${escapeHtml(title)}</b>${items}</div>`;
  }

  function renderResults(results = []) {
    const resultList = state.elements.resultList;
    const resultStats = state.elements.resultStats;
    if (!resultList || !resultStats) return;

    state.currentResults = results;
    resultList.innerHTML = '';
    const validResults = results.filter(item => item.count > 0);
    const scanFailures = state.scanFailures || [];

    if (results.length === 0) {
      resultList.innerHTML = '<div class="ptms-empty">🎯 点击扫描按钮开始检测</div>';
      resultStats.innerHTML = `
        <div class="ptms-stats-main">
          <span>🎯 有效站点：<strong>0</strong></span>
          <span>🏅 总勋章数：<strong>0</strong></span>
          <span>👁️ 当前显示：<strong>0</strong></span>
        </div>
        ${renderSiteLinkList('扫描失败：', scanFailures)}
      `;
      return;
    }

    const { filtered, diffMap } = getFilteredSites(validResults);
    const totalBadges = validResults.reduce((sum, item) => sum + item.count, 0);
    const totalVisible = filtered.reduce((sum, item) => sum + item.count, 0);
    const totalNew = Object.values(diffMap).reduce((sum, set) => sum + set.size, 0);

    resultStats.innerHTML = `
      <div class="ptms-stats-main">
        ${[
          `<span>🎯 有效站点：<strong>${validResults.length}</strong></span>`,
          `<span>🏅 总勋章数：<strong class="ptms-total-badges">${totalBadges}</strong></span>`,
          `<span>👁️ 当前显示：<strong>${totalVisible}</strong></span>`,
          state.diffMode ? `<span>🆕 新增勋章：<strong class="ptms-new-count">${totalNew}</strong></span>` : '',
          state.diffMode ? '<span class="ptms-stats-note">差异模式下仅显示新增勋章</span>' : '',
          state.filterPermanent ? '<span class="ptms-stats-note">♾️ 仅永久勋章</span>' : '',
          state.filterLimited ? '<span class="ptms-stats-note">⏳ 仅限时售卖</span>' : '',
          state.filterPositive ? '<span class="ptms-stats-note">📈 仅正收益</span>' : ''
        ].filter(Boolean).join('')}
      </div>
      ${renderSiteLinkList('扫描失败：', scanFailures)}
    `;

    if (filtered.length === 0) {
      resultList.innerHTML = '<div class="ptms-empty">当前过滤条件下没有匹配结果</div>';
      return;
    }

    filtered.forEach(site => {
      const siteEl = document.createElement('section');
      siteEl.className = 'ptms-result-site';
      siteEl.innerHTML = `
        <div class="ptms-result-head">
          <div>
            <strong>${escapeHtml(site.siteName)}</strong>
            <a href="${escapeHtml(site.url)}" target="_blank" rel="noopener noreferrer" title="点击跳转到勋章页面">🔗 ${escapeHtml(site.url)}</a>
          </div>
          <span>${site.medals.length} 勋章</span>
        </div>
        <div class="ptms-medals"></div>
      `;

      const list = siteEl.querySelector('.ptms-medals');
      site.medals.forEach(medal => {
        const fp = getMedalFingerprint(site.siteName, medal);
        const isNew = state.diffMode && diffMap[site.siteName] && diffMap[site.siteName].has(fp);
        const medalUrl = medal.medalId ? `${site.url}${site.url.includes('?') ? '&' : '?'}medal=${encodeURIComponent(medal.medalId)}` : site.url;
        const meta = [];
        if (medal.price) meta.push(`<span class="ptms-meta-price">💰 ${escapeHtml(medal.price)}</span>`);
        if (medal.duration) meta.push(`<span class="ptms-meta-duration">⏱ ${escapeHtml(medal.duration)}</span>`);
        if (medal.bonus) meta.push(`<span class="ptms-meta-bonus">📈 ${escapeHtml(medal.bonus)}</span>`);
        if (medal.stock) meta.push(`<span class="ptms-meta-stock">📦 ${escapeHtml(medal.stock)}</span>`);

        const medalEl = document.createElement('div');
        medalEl.className = `ptms-medal${isNew ? ' ptms-new' : ''}`;
        medalEl.innerHTML = `
          <a href="${escapeHtml(medalUrl)}" target="_blank" rel="noopener noreferrer" title="点击跳转到领取页面">
            ${escapeHtml(medal.name)}${isNew ? '<em>NEW</em>' : ''}
          </a>
          <div class="ptms-meta">${meta.join('')}</div>
          ${medal.timeRange && medal.timeRange !== '不限' ? `<div class="ptms-time-range">🕐 可购买时间: ${escapeHtml(medal.timeRange)}</div>` : ''}
        `;
        list.appendChild(medalEl);
      });

      resultList.appendChild(siteEl);
    });
  }

  function openTab(url, active = false) {
    if (typeof GM_openInTab === 'function') {
      GM_openInTab(url, { active, insert: true, setParent: true });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  function openAllResults() {
    const validSites = state.currentResults.filter(site => site.count > 0);
    if (validSites.length === 0) {
      addLog('没有可打开的扫描结果', true);
      return;
    }
    validSites.forEach(site => openTab(site.url, false));
    addLog(`已打开 ${validSites.length} 个站点`);
  }

  function openFilteredResults() {
    const { filtered } = getFilteredSites(state.currentResults);
    const urls = [];
    filtered.forEach(site => {
      site.medals.forEach(medal => {
        const url = medal.medalId ? `${site.url}${site.url.includes('?') ? '&' : '?'}medal=${encodeURIComponent(medal.medalId)}` : site.url;
        urls.push(url);
      });
    });

    if (urls.length === 0) {
      addLog('当前过滤条件下没有可打开的勋章页面', true);
      return;
    }
    urls.forEach(url => openTab(url, false));
    addLog(`已打开 ${urls.length} 个过滤结果页面`);
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportConfig() {
    const sites = parseSitesText(state.elements.sites.value).map(line => {
      const parsed = splitSite(line);
      return {
        name: parsed.siteName,
        url: parsed.siteUrl.replace(/\/medal\.php$/, '')
      };
    });
    if (sites.length === 0) {
      addLog('无有效配置可导出', true);
      return;
    }
    downloadJson(`PT_Config_${new Date().toISOString().slice(0, 10)}.json`, { sites });
    addLog(`已导出 ${sites.length} 个站点配置`);
  }

  function exportDebugData() {
    const debugData = gmGet(KEY_DEBUG, null);
    if (!debugData || !debugData.pages || debugData.pages.length === 0) {
      addLog('没有可导出的调试数据，请先执行一次扫描', true);
      return;
    }
    downloadJson(`PT_Debug_${debugData.dateStr}.json`, {
      exportVersion: 1,
      timestamp: debugData.timestamp,
      dateStr: debugData.dateStr,
      pages: debugData.pages
    });
    addLog(`调试包已导出（${debugData.pages.length} 个页面）`);
  }

  function importConfigFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        if (!data?.sites || !Array.isArray(data.sites)) throw new Error('缺少 sites 数组');
        const sites = data.sites.map(site => {
          if (!site.name || !site.url) throw new Error('无效的站点格式');
          const url = String(site.url).replace(/\/+$/, '');
          const finalUrl = /\/(medal|badges|mall|buycenter)\.php$/i.test(url) ? url : `${url}/medal.php`;
          return `${site.name}|${finalUrl}`;
        });
        state.elements.sites.value = sites.join('\n');
        gmSet(KEY_SITES, sites);
        addLog(`已导入 ${sites.length} 个站点`);
      } catch (error) {
        addLog(`导入失败：${error.message}`, true);
      } finally {
        state.fileInput.value = '';
      }
    };
    reader.onerror = () => addLog('文件读取失败', true);
    reader.readAsText(file);
  }

  function saveSchedule() {
    const scheduleConfig = {
      enabled: state.elements.scheduleEnabled.checked,
      time: state.elements.scheduleTime.value || '08:00',
      webhookUrl: state.elements.webhookUrl.value.trim()
    };
    gmSet(KEY_SCHEDULE, scheduleConfig);
    renderScheduleStatus();
    setupSchedule();
    addLog(`定时配置已保存（${scheduleConfig.enabled ? '已启用' : '已禁用'}，每日 ${scheduleConfig.time} 执行）`);
  }

  function renderScheduleStatus() {
    const enabled = state.elements.scheduleEnabled?.checked;
    if (!state.elements.scheduleStatus) return;
    state.elements.scheduleStatus.textContent = enabled ? '已启用（页面打开期间有效）' : '已禁用';
    state.elements.scheduleStatus.classList.toggle('ptms-active', Boolean(enabled));
  }

  function setupSchedule() {
    if (state.scheduleTimer) {
      clearTimeout(state.scheduleTimer);
      state.scheduleTimer = null;
    }

    const config = gmGet(KEY_SCHEDULE, { enabled: false });
    if (!config.enabled) return;

    const [hour, minute] = String(config.time || '08:00').split(':').map(Number);
    const now = new Date();
    const scheduled = new Date(now);
    scheduled.setHours(hour || 0, minute || 0, 0, 0);
    if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1);

    state.scheduleTimer = setTimeout(async () => {
      openPanel();
      addLog('定时任务触发。油猴版只有在页面保持打开时才会执行定时任务。');
      const results = await startScan({ keepLog: true });
      if (config.webhookUrl) {
        try {
          await sendToFeishu(config.webhookUrl, results, formatScanTime(new Date()));
          addLog('定时扫描结果已推送');
        } catch (error) {
          addLog(`定时推送失败：${error.message}`, true);
        }
      }
      setupSchedule();
    }, scheduled - now);
  }

  function formatScanTime(date) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  async function sendToFeishu(webhookUrl, results, scanTime) {
    const totalMedals = results.reduce((sum, result) => sum + result.count, 0);
    const validSites = results.filter(result => result.count > 0);
    const lines = [
      [{ tag: 'text', text: `扫描时间: ${scanTime}` }],
      [{ tag: 'text', text: `共扫描 ${results.length} 个站点，发现 ${totalMedals} 个可购买勋章` }],
      [{ tag: 'text', text: '' }]
    ];

    if (validSites.length === 0) {
      lines.push([{ tag: 'text', text: '没有发现可购买的勋章' }]);
    } else {
      validSites.forEach(site => {
        lines.push([{ tag: 'text', text: `\n${site.siteName}（${site.count}个）` }]);
        site.medals.forEach(medal => {
          const parts = [`  - ${medal.name}`];
          if (medal.price) parts.push(`价格 ${medal.price}`);
          if (medal.duration) parts.push(`有效期 ${medal.duration}`);
          if (medal.bonus) parts.push(`加成 ${medal.bonus}`);
          lines.push([{ tag: 'text', text: parts.join(' ') }]);
        });
      });
    }

    const payload = {
      msg_type: 'post',
      content: {
        post: {
          zh_cn: {
            title: 'PT勋章扫描报告',
            content: lines
          }
        }
      }
    };

    const response = await requestText(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
      timeout: 15000
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.responseText.slice(0, 160)}`);
  }

  async function testWebhook() {
    const webhookUrl = state.elements.webhookUrl.value.trim();
    if (!webhookUrl) {
      addLog('请先填写 Webhook URL', true);
      return;
    }
    setBusy(state.elements.testWebhookBtn, true, '⏳ 发送中...');
    try {
      await sendToFeishu(webhookUrl, [], formatScanTime(new Date()));
      addLog('测试推送成功');
    } catch (error) {
      addLog(`测试推送失败：${error.message}`, true);
    } finally {
      setBusy(state.elements.testWebhookBtn, false, '📤 测试推送');
    }
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = label;
  }

  function toggleFilter(key, button, activeText, inactiveText) {
    state[key] = !state[key];
    button.classList.toggle('ptms-active', state[key]);
    button.textContent = state[key] ? activeText : inactiveText;
    renderResults(state.currentResults);
  }

  function buildPanel() {
    const root = document.createElement('div');
    root.id = 'ptms-root';
    root.innerHTML = `
      <button type="button" id="ptms-launcher" title="打开 PT 勋章扫描器">🏅</button>
      <div id="ptms-overlay" hidden>
        <div class="ptms-panel" role="dialog" aria-modal="true" aria-label="PT 勋章扫描器">
          <header class="ptms-header">
            <div class="ptms-header-icon">🏅</div>
            <h2>PT 勋章扫描器</h2>
            <span class="ptms-subtitle">批量检测各站点可购买勋章</span>
            <button type="button" id="ptms-close" class="ptms-icon-btn" title="关闭">x</button>
          </header>
          <main class="ptms-main-container">
            <section class="ptms-card ptms-config">
              <h3>站点配置</h3>
              <div class="ptms-action-buttons">
                <button type="button" id="ptms-detect" class="ptms-btn-detect">🔍 检测内置站点</button>
                <button type="button" id="ptms-load-defaults" class="ptms-btn-open">📋 载入全部内置站点</button>
              </div>
              <div id="ptms-detect-summary" class="ptms-config-tip">油猴版不能读取其它域名 Cookie，检测结果以页面是否可访问为准。</div>
              <textarea id="ptms-sites" spellcheck="false" placeholder="格式：站点名称|完整URL&#10;示例：&#10;春天PT|https://springpt.net/medal.php"></textarea>
              <div class="ptms-action-buttons">
                <button type="button" id="ptms-import" class="ptms-btn-import">⬆️ 导入</button>
                <button type="button" id="ptms-export" class="ptms-btn-export">⬇️ 导出</button>
                <button type="button" id="ptms-save" class="ptms-btn-save">💾 保存</button>
              </div>
            </section>

            <section class="ptms-card ptms-work">
              <h3>扫描控制</h3>
              <div class="ptms-action-buttons">
                <button type="button" id="ptms-scan" class="ptms-btn-scan">🚀 开始扫描</button>
                <button type="button" id="ptms-open-all" class="ptms-btn-open">🌐 打开全部站点</button>
                <button type="button" id="ptms-open-filtered" class="ptms-btn-open">🔍 打开过滤结果</button>
              </div>
              <div class="ptms-action-buttons ptms-filters">
                <button type="button" id="ptms-diff" class="ptms-btn-diff">🔄 差异模式</button>
                <button type="button" id="ptms-filter-permanent" class="ptms-btn-filter">♾️ 永久勋章</button>
                <button type="button" id="ptms-filter-limited" class="ptms-btn-filter">⏳ 限时售卖</button>
                <button type="button" id="ptms-filter-positive" class="ptms-btn-filter">📈 正收益</button>
                <button type="button" id="ptms-debug-export" class="ptms-btn-debug">🐛 导出调试包</button>
              </div>

              <h3 class="ptms-log-title">实时日志</h3>
              <div id="ptms-log" class="ptms-log"></div>
            </section>

            <section class="ptms-card ptms-results-card">
              <h3 class="ptms-result-title">
                <span>扫描结果</span>
                <button type="button" id="ptms-clear" class="ptms-btn-clear">🗑️ 清除结果</button>
              </h3>
              <div class="ptms-result-box">
                <div id="ptms-result-list" class="ptms-results"></div>
                <div id="ptms-result-stats" class="ptms-stats"></div>
              </div>
            </section>
          </main>

          <section class="ptms-card ptms-schedule-card">
            <h3>⏰ 定时任务配置</h3>
            <div class="ptms-schedule-row">
              <label>启用定时</label>
              <label class="ptms-toggle-switch">
                <input type="checkbox" id="ptms-schedule-enabled">
                <span class="ptms-toggle-slider"></span>
              </label>
              <span id="ptms-schedule-status" class="ptms-status">已禁用</span>
            </div>
            <div class="ptms-schedule-row">
              <label>执行时间</label>
              <input type="time" id="ptms-schedule-time" value="08:00">
              <span class="ptms-hint-inline">每日固定时间自动扫描；油猴版仅在页面打开期间有效</span>
            </div>
            <div class="ptms-schedule-row">
              <label>Webhook URL</label>
              <input type="url" id="ptms-webhook-url" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxx">
              <span class="ptms-hint-inline">飞书机器人 webhook 地址</span>
            </div>
            <div class="ptms-action-buttons">
              <button type="button" id="ptms-save-schedule" class="ptms-btn-save">💾 保存定时配置</button>
              <button type="button" id="ptms-test-webhook" class="ptms-btn-scan">📤 测试推送</button>
            </div>
          </section>
        </div>
      </div>
    `;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.hidden = true;
    root.appendChild(fileInput);

    document.body.appendChild(root);
    state.root = root;
    state.panel = root.querySelector('#ptms-overlay');
    state.launcher = root.querySelector('#ptms-launcher');
    state.fileInput = fileInput;
    state.elements = {
      sites: root.querySelector('#ptms-sites'),
      log: root.querySelector('#ptms-log'),
      detectBtn: root.querySelector('#ptms-detect'),
      detectSummary: root.querySelector('#ptms-detect-summary'),
      scanBtn: root.querySelector('#ptms-scan'),
      resultList: root.querySelector('#ptms-result-list'),
      resultStats: root.querySelector('#ptms-result-stats'),
      scheduleEnabled: root.querySelector('#ptms-schedule-enabled'),
      scheduleTime: root.querySelector('#ptms-schedule-time'),
      scheduleStatus: root.querySelector('#ptms-schedule-status'),
      webhookUrl: root.querySelector('#ptms-webhook-url'),
      testWebhookBtn: root.querySelector('#ptms-test-webhook')
    };

    root.querySelector('#ptms-close').addEventListener('click', closePanel);
    state.launcher.addEventListener('click', togglePanel);
    root.querySelector('#ptms-save').addEventListener('click', saveSitesFromTextarea);
    root.querySelector('#ptms-import').addEventListener('click', () => fileInput.click());
    root.querySelector('#ptms-export').addEventListener('click', exportConfig);
    root.querySelector('#ptms-detect').addEventListener('click', detectDefaultSites);
    root.querySelector('#ptms-load-defaults').addEventListener('click', () => {
      state.elements.sites.value = DEFAULT_SITES.join('\n');
      gmSet(KEY_SITES, DEFAULT_SITES);
      addLog(`已载入 ${DEFAULT_SITES.length} 个内置站点`);
    });
    root.querySelector('#ptms-scan').addEventListener('click', () => startScan());
    root.querySelector('#ptms-open-all').addEventListener('click', openAllResults);
    root.querySelector('#ptms-open-filtered').addEventListener('click', openFilteredResults);
    root.querySelector('#ptms-debug-export').addEventListener('click', exportDebugData);
    root.querySelector('#ptms-clear').addEventListener('click', () => {
      if (!window.confirm('确定要清除扫描结果和历史记录吗？')) return;
      gmDelete(KEY_RESULTS);
      gmDelete(KEY_HISTORY);
      gmDelete(KEY_DEBUG);
      gmDelete(KEY_SCAN_FAILURES);
      state.currentResults = [];
      state.previousResults = [];
      state.scanFailures = [];
      renderResults([]);
      addLog('已清除扫描结果和历史记录');
    });
    root.querySelector('#ptms-diff').addEventListener('click', event => toggleFilter('diffMode', event.currentTarget, '🔄 差异模式 ✓', '🔄 差异模式'));
    root.querySelector('#ptms-filter-permanent').addEventListener('click', event => toggleFilter('filterPermanent', event.currentTarget, '♾️ 永久勋章 ✓', '♾️ 永久勋章'));
    root.querySelector('#ptms-filter-limited').addEventListener('click', event => toggleFilter('filterLimited', event.currentTarget, '⏳ 限时售卖 ✓', '⏳ 限时售卖'));
    root.querySelector('#ptms-filter-positive').addEventListener('click', event => toggleFilter('filterPositive', event.currentTarget, '📈 正收益 ✓', '📈 正收益'));
    root.querySelector('#ptms-save-schedule').addEventListener('click', saveSchedule);
    root.querySelector('#ptms-test-webhook').addEventListener('click', testWebhook);
    state.elements.scheduleEnabled.addEventListener('change', renderScheduleStatus);
    fileInput.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) importConfigFile(file);
    });
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = `
      #ptms-root, #ptms-root * {
        box-sizing: border-box;
        letter-spacing: 0;
      }

      #ptms-overlay[hidden] {
        display: none !important;
      }

      #ptms-root {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }

      #ptms-root button {
        padding: 9px 16px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font: 500 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s, background 0.2s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        white-space: nowrap;
      }

      #ptms-root button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      }

      #ptms-root button:active {
        transform: translateY(0);
      }

      #ptms-root button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      #ptms-root #ptms-launcher {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483646;
        width: 42px;
        height: 42px;
        padding: 0;
        border-radius: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        font-size: 21px;
        box-shadow: 0 8px 24px rgba(102,126,234,0.35);
      }

      #ptms-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        padding: 22px;
        overflow: auto;
        background: rgba(15, 23, 42, 0.46);
        color: #2c3e50;
      }

      .ptms-panel {
        width: min(1160px, calc(100vw - 44px));
        max-height: calc(100vh - 44px);
        margin: 0 auto;
        padding: 30px;
        overflow: auto;
        border-radius: 12px;
        background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f0 100%);
        box-shadow: 0 24px 72px rgba(15, 23, 42, 0.32);
      }

      .ptms-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid rgba(0,0,0,0.06);
      }

      .ptms-header-icon {
        width: 42px;
        height: 42px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        color: white;
        flex: 0 0 auto;
      }

      .ptms-header h2 {
        margin: 0;
        color: #2c3e50;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.2;
      }

      .ptms-subtitle {
        color: #888;
        font-size: 13px;
        margin-left: auto;
      }

      #ptms-root .ptms-icon-btn {
        width: 34px;
        height: 34px;
        padding: 0;
        border: 1px solid rgba(0,0,0,0.08);
        background: #fff;
        color: #555;
        font-size: 16px;
        flex: 0 0 auto;
      }

      .ptms-main-container {
        display: grid;
        grid-template-columns: 380px 1fr;
        gap: 25px;
      }

      .ptms-card {
        background: white;
        padding: 25px;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        border: 1px solid rgba(0,0,0,0.04);
      }

      .ptms-config {
        grid-row: span 2;
      }

      .ptms-card h3 {
        color: #2c3e50;
        font-size: 15px;
        font-weight: 600;
        margin: 0 0 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        line-height: 1.3;
      }

      .ptms-card h3::before {
        content: '';
        width: 4px;
        height: 18px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-radius: 2px;
        display: inline-block;
        flex: 0 0 auto;
      }

      .ptms-action-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 16px 0;
      }

      .ptms-config > .ptms-action-buttons:first-of-type button {
        flex: 1 1 150px;
        padding: 11px;
        font-size: 14px;
      }

      #ptms-root .ptms-btn-detect {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
      }

      #ptms-root .ptms-btn-scan {
        background: linear-gradient(135deg, #43e97b, #38f9d7);
        color: #1a3a2a;
        font-weight: 600;
      }

      #ptms-root .ptms-btn-open {
        background: #17a2b8;
        color: white;
      }

      #ptms-root .ptms-btn-save {
        background: #2196F3;
        color: white;
      }

      #ptms-root .ptms-btn-import {
        background: #FF9800;
        color: white;
      }

      #ptms-root .ptms-btn-export {
        background: #9C27B0;
        color: white;
      }

      #ptms-root .ptms-btn-diff,
      #ptms-root .ptms-btn-filter {
        background: #6c757d;
        color: white;
      }

      #ptms-root .ptms-btn-diff.ptms-active {
        background: #28a745;
        color: white;
      }

      #ptms-root .ptms-btn-filter.ptms-active {
        background: #17a2b8;
        color: white;
      }

      #ptms-root .ptms-btn-debug {
        background: #e91e63;
        color: white;
      }

      #ptms-root .ptms-btn-clear {
        background: #dc3545;
        color: white;
        font-size: 12px;
        padding: 5px 10px;
        margin-left: auto;
      }

      #ptms-sites {
        width: 100%;
        height: 220px;
        padding: 12px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        font: 12px/1.7 "SF Mono", "Fira Code", Consolas, monospace;
        margin: 12px 0;
        resize: vertical;
        background: #fafbfc;
        color: #555;
      }

      #ptms-sites:focus,
      #ptms-webhook-url:focus,
      #ptms-schedule-time:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .ptms-config-tip {
        background: #fafbfc;
        border-radius: 8px;
        padding: 12px;
        margin: 12px 0;
        font-size: 12px;
        color: #888;
        border: 1px dashed #e0e0e0;
        line-height: 1.6;
      }

      .ptms-config-tip strong {
        color: #667eea;
      }

      .ptms-log-title {
        margin-top: 10px !important;
      }

      .ptms-log {
        height: 260px;
        overflow-y: auto;
        border: 1px solid #eee;
        border-radius: 8px;
        padding: 14px;
        background: #fafbfc;
        color: #555;
      }

      .ptms-log-entry {
        padding: 6px 10px;
        margin: 4px 0;
        background: white;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        font-size: 13px;
        display: flex;
        align-items: baseline;
        gap: 8px;
        line-height: 1.45;
      }

      .ptms-log-entry.ptms-error {
        color: #e53935;
      }

      .ptms-time {
        color: #aaa;
        font-size: 11px;
        flex: 0 0 auto;
      }

      .ptms-result-title {
        margin-bottom: 0 !important;
      }

      .ptms-result-title > span {
        display: inline-flex;
        align-items: center;
      }

      .ptms-result-box {
        margin-top: 14px;
        border: 1px solid #e8e8e8;
        border-radius: 10px;
        overflow: hidden;
      }

      .ptms-results {
        max-height: 420px;
        overflow-y: auto;
        padding: 16px;
        background: #fff;
      }

      .ptms-empty {
        text-align: center;
        color: #9ca3af;
        padding: 30px 20px;
        font-size: 14px;
      }

      .ptms-result-site {
        margin-bottom: 14px;
        border: 1px solid #e8e8e8;
        border-radius: 8px;
        overflow: hidden;
        transition: box-shadow 0.2s;
      }

      .ptms-result-site:last-child {
        margin-bottom: 0;
      }

      .ptms-result-site:hover {
        box-shadow: 0 2px 10px rgba(0,0,0,0.06);
      }

      .ptms-result-head {
        padding: 10px 14px;
        background: linear-gradient(135deg, #f8f9fc, #f0f2f7);
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        border-bottom: 1px solid #eee;
      }

      .ptms-result-head strong {
        font-weight: 600;
        font-size: 14px;
        color: #2c3e50;
      }

      .ptms-result-head a {
        font-size: 12px;
        color: #667eea;
        text-decoration: none;
        margin-left: 8px;
      }

      .ptms-result-head a:hover {
        text-decoration: underline;
        color: #764ba2;
      }

      .ptms-result-head span {
        color: #4CAF50;
        font-weight: 700;
        font-size: 13px;
        background: rgba(76,175,80,0.08);
        padding: 3px 10px;
        border-radius: 12px;
        white-space: nowrap;
      }

      .ptms-medals {
        padding: 6px 14px;
      }

      .ptms-medal {
        padding: 10px 12px;
        margin: 4px 0;
        background: #fafbfc;
        border-radius: 6px;
        font-size: 13px;
        border-left: 3px solid #e0e0e0;
        transition: background 0.2s, border-color 0.2s;
      }

      .ptms-medal:hover {
        background: #f0f4f8;
      }

      .ptms-medal.ptms-new {
        border-left-color: #FF9800;
        background: #fff8e1;
      }

      .ptms-medal a {
        font-weight: 500;
        color: #2c3e50;
        text-decoration: none;
        cursor: pointer;
        font-size: 13px;
      }

      .ptms-medal a:hover {
        color: #667eea;
        text-decoration: underline;
      }

      .ptms-medal em {
        display: inline-block;
        background: linear-gradient(135deg, #FF9800, #F44336);
        color: white;
        font-size: 10px;
        padding: 2px 7px;
        border-radius: 10px;
        margin-left: 6px;
        font-weight: 600;
        font-style: normal;
      }

      .ptms-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: 4px;
        font-size: 12px;
      }

      .ptms-meta span {
        white-space: nowrap;
      }

      .ptms-meta-price {
        color: #e65100;
        font-weight: 500;
      }

      .ptms-meta-duration {
        color: #1565C0;
      }

      .ptms-meta-bonus {
        color: #2e7d32;
      }

      .ptms-meta-stock {
        color: #6a1b9a;
      }

      .ptms-time-range {
        font-size: 11px;
        color: #888;
        margin-top: 2px;
      }

      .ptms-stats {
        background: linear-gradient(135deg, rgba(76,175,80,0.06), rgba(102,126,234,0.04));
        padding: 14px 16px;
        border-top: 1px solid #eee;
        font-size: 13px;
        color: #555;
      }

      .ptms-stats-main {
        display: flex;
        justify-content: space-between;
        padding: 8px;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ptms-total-badges {
        color: #4CAF50;
      }

      .ptms-new-count {
        color: #FF9800;
      }

      .ptms-stats-note {
        color: #17a2b8;
        font-size: 12px;
      }

      .ptms-site-link-list {
        width: 100%;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #e0e0e0;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
        color: #888;
        line-height: 1.5;
      }

      .ptms-site-link-list b {
        color: #555;
      }

      .ptms-site-link-empty {
        border-top: 0;
        padding-top: 0;
      }

      .ptms-site-link-item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        max-width: 100%;
        padding: 3px 7px;
        border: 1px solid #e8e8e8;
        background: #fafbfc;
        border-radius: 5px;
      }

      .ptms-site-link-item a {
        color: #667eea;
        text-decoration: none;
      }

      .ptms-site-link-item a:hover {
        text-decoration: underline;
      }

      .ptms-site-link-item small,
      .ptms-no-link {
        color: #aaa;
      }

      .ptms-schedule-card {
        margin-top: 25px;
      }

      .ptms-schedule-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 12px 0;
        flex-wrap: wrap;
      }

      .ptms-schedule-row label {
        font-size: 13px;
        color: #555;
        min-width: 80px;
        font-weight: 500;
      }

      #ptms-schedule-time,
      #ptms-webhook-url {
        padding: 8px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        font-size: 13px;
        background: #fafbfc;
        color: #555;
        font-family: inherit;
      }

      #ptms-schedule-time {
        font-size: 14px;
      }

      #ptms-webhook-url {
        flex: 1;
        min-width: 240px;
      }

      .ptms-hint-inline {
        font-size: 11px;
        color: #aaa;
        margin-left: 4px;
      }

      .ptms-toggle-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
        min-width: 44px !important;
      }

      .ptms-toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .ptms-toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #ccc;
        border-radius: 24px;
        transition: 0.3s;
      }

      .ptms-toggle-slider::before {
        content: '';
        position: absolute;
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background: white;
        border-radius: 50%;
        transition: 0.3s;
      }

      .ptms-toggle-switch input:checked + .ptms-toggle-slider {
        background: linear-gradient(135deg, #667eea, #764ba2);
      }

      .ptms-toggle-switch input:checked + .ptms-toggle-slider::before {
        left: auto;
        right: 3px;
        transform: none;
      }

      .ptms-status {
        font-size: 13px;
        color: #888;
      }

      .ptms-status.ptms-active {
        color: #4CAF50;
        font-weight: 500;
      }

      @media (max-width: 900px) {
        #ptms-overlay {
          padding: 8px;
        }

        .ptms-panel {
          width: calc(100vw - 16px);
          max-height: calc(100vh - 16px);
          padding: 18px;
        }

        .ptms-header {
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 18px;
          padding-bottom: 16px;
        }

        .ptms-subtitle {
          display: none;
        }

        .ptms-main-container {
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .ptms-config {
          grid-row: auto;
        }

        .ptms-card {
          padding: 18px;
        }

        .ptms-result-head {
          align-items: flex-start;
          flex-direction: column;
        }

        #ptms-webhook-url {
          min-width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function openPanel() {
    if (!state.panel) return;
    state.panel.hidden = false;
  }

  function closePanel() {
    if (!state.panel) return;
    state.panel.hidden = true;
  }

  function togglePanel() {
    if (!state.panel) return;
    state.panel.hidden = !state.panel.hidden;
  }

  function init() {
    if (!document.body || document.getElementById('ptms-root')) return;
    injectStyle();
    buildPanel();
    loadSavedState();
    setupSchedule();

    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('打开 PT 勋章扫描器', openPanel);
      GM_registerMenuCommand('开始扫描配置站点', () => {
        openPanel();
        startScan();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
