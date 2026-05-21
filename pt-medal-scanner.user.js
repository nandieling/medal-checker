// ==UserScript==
// @name         PT勋章扫描器
// @namespace    https://github.com/schalkiii/medal-checker
// @version      1.0.0
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
    const startTag = '<div class="medal-cards">';
    const startIdx = html.indexOf(startTag);
    if (startIdx < 0) return medals;

    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < html.length; i++) {
      if (html[i] !== '<') continue;
      const tagEnd = html.indexOf('>', i);
      if (tagEnd < 0) break;
      const tag = html.substring(i, tagEnd + 1);
      if (tag.startsWith('<div ') || tag.startsWith('<div>')) depth++;
      else if (tag.startsWith('</div>')) {
        depth--;
        if (depth === 0) {
          endIdx = tagEnd + 1;
          break;
        }
      }
      i = tagEnd;
    }
    if (endIdx < 0) return medals;

    const section = html.substring(startIdx, endIdx);
    const cards = [];
    let pos = 0;
    while (pos < section.length) {
      const cardStart = section.indexOf('<div class="medal-card ', pos);
      if (cardStart < 0) break;

      let cardDepth = 0;
      let cardEnd = -1;
      for (let i = cardStart; i < section.length; i++) {
        if (section[i] !== '<') continue;
        const tagEnd = section.indexOf('>', i);
        if (tagEnd < 0) break;
        const tag = section.substring(i, tagEnd + 1);
        if (tag.startsWith('<div ') || tag.startsWith('<div>')) cardDepth++;
        else if (tag.startsWith('</div>')) {
          cardDepth--;
          if (cardDepth === 0) {
            cardEnd = tagEnd + 1;
            break;
          }
        }
        i = tagEnd;
      }
      if (cardEnd <= 0) break;
      cards.push(section.substring(cardStart, cardEnd));
      pos = cardEnd;
    }

    for (const card of cards) {
      const actionMatch = card.match(/<input[^>]*\bclass="btn buy"[^>]*\/?\s*>/i);
      if (!actionMatch) continue;

      const actionHtml = actionMatch[0];
      if (!actionHtml.includes('value="购买"') && !actionHtml.includes('value="購買"')) continue;
      if (actionHtml.includes('disabled')) continue;

      const dataIdMatch = actionHtml.match(/data-id="(\d+)"/);
      const medalId = dataIdMatch ? dataIdMatch[1] : '';
      const nameMatch = card.match(/<div class="medal-name">([\s\S]*?)<\/div>/);
      const name = nameMatch ? nameMatch[1].trim() : '';

      let price = '';
      let duration = '';
      let bonus = '';
      let stock = '';
      let timeRange = '';
      const fieldPairs = card.match(/<strong>([^<]+)<\/strong>([\s\S]*?)<\/div>/g) || [];
      for (const pair of fieldPairs) {
        const labelMatch = pair.match(/<strong>([^<]+)<\/strong>/);
        const val = pair.replace(/<[^>]+>/g, '').replace(/：/g, ':').replace(/^[^:]*[:：]\s*/, '').trim();
        if (!labelMatch) continue;
        const label = labelMatch[1].replace(/[：:]/g, '').trim();
        if (label.includes('价格') || label.includes('價格')) price = val;
        else if (label.includes('有效期')) duration = val;
        else if (label.includes('加成')) bonus = val;
        else if (label.includes('库存') || label.includes('庫存')) stock = val;
        else if (label.includes('可购买') || label.includes('可購買')) timeRange = val;
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
    setBusy(state.elements.scanBtn, true, '扫描中...');
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
    setBusy(state.elements.scanBtn, false, '开始扫描');
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
    setBusy(state.elements.detectBtn, true, '检测中...');
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
    setBusy(state.elements.detectBtn, false, '检测内置站点');
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
      resultList.innerHTML = '<div class="ptms-empty">暂无扫描结果</div>';
      resultStats.innerHTML = `
        <div class="ptms-stats-main">
          <span>有效站点：<strong>0</strong></span>
          <span>总勋章数：<strong>0</strong></span>
          <span>当前显示：<strong>0</strong></span>
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
          `<span>有效站点：<strong>${validResults.length}</strong></span>`,
          `<span>总勋章数：<strong>${totalBadges}</strong></span>`,
          `<span>当前显示：<strong>${totalVisible}</strong></span>`,
          state.diffMode ? `<span>新增：<strong>${totalNew}</strong></span>` : '',
          state.filterPermanent ? '<span>仅永久</span>' : '',
          state.filterLimited ? '<span>仅限时</span>' : '',
          state.filterPositive ? '<span>仅正收益</span>' : ''
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
            <a href="${escapeHtml(site.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(site.url)}</a>
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
        if (medal.price) meta.push(`<span>价格：${escapeHtml(medal.price)}</span>`);
        if (medal.duration) meta.push(`<span>有效期：${escapeHtml(medal.duration)}</span>`);
        if (medal.bonus) meta.push(`<span>加成：${escapeHtml(medal.bonus)}</span>`);
        if (medal.stock) meta.push(`<span>库存：${escapeHtml(medal.stock)}</span>`);

        const medalEl = document.createElement('div');
        medalEl.className = `ptms-medal${isNew ? ' ptms-new' : ''}`;
        medalEl.innerHTML = `
          <a href="${escapeHtml(medalUrl)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(medal.name)}${isNew ? '<em>NEW</em>' : ''}
          </a>
          <div class="ptms-meta">${meta.join('')}</div>
          ${medal.timeRange && medal.timeRange !== '不限' ? `<div class="ptms-time-range">可购买时间：${escapeHtml(medal.timeRange)}</div>` : ''}
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
    setBusy(state.elements.testWebhookBtn, true, '发送中...');
    try {
      await sendToFeishu(webhookUrl, [], formatScanTime(new Date()));
      addLog('测试推送成功');
    } catch (error) {
      addLog(`测试推送失败：${error.message}`, true);
    } finally {
      setBusy(state.elements.testWebhookBtn, false, '测试推送');
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
      <button type="button" id="ptms-launcher" title="打开 PT 勋章扫描器">PT</button>
      <div id="ptms-overlay" hidden>
        <div class="ptms-panel" role="dialog" aria-modal="true" aria-label="PT 勋章扫描器">
          <header class="ptms-header">
            <div>
              <h2>PT 勋章扫描器</h2>
              <p>油猴版使用 GM_xmlhttpRequest 请求页面，Cookie 由浏览器随请求发送。</p>
            </div>
            <button type="button" id="ptms-close" class="ptms-icon-btn" title="关闭">x</button>
          </header>
          <main class="ptms-body">
            <section class="ptms-config">
              <div class="ptms-section-title">站点配置</div>
              <div class="ptms-stack">
                <button type="button" id="ptms-detect">检测内置站点</button>
                <button type="button" id="ptms-load-defaults">载入全部内置站点</button>
              </div>
              <div id="ptms-detect-summary" class="ptms-hint">油猴版不能读取其它域名 Cookie，检测结果以页面是否可访问为准。</div>
              <textarea id="ptms-sites" spellcheck="false" placeholder="格式：站点名称|完整URL&#10;示例：&#10;春天PT|https://springpt.net/medal.php"></textarea>
              <div class="ptms-row">
                <button type="button" id="ptms-import">导入</button>
                <button type="button" id="ptms-export">导出</button>
                <button type="button" id="ptms-save">保存</button>
              </div>
              <div class="ptms-section-title">推送和定时</div>
              <label class="ptms-check"><input type="checkbox" id="ptms-schedule-enabled"> 启用定时</label>
              <div class="ptms-row">
                <input type="time" id="ptms-schedule-time" value="08:00">
                <span id="ptms-schedule-status" class="ptms-status">已禁用</span>
              </div>
              <input type="url" id="ptms-webhook-url" placeholder="飞书机器人 Webhook URL">
              <div class="ptms-row">
                <button type="button" id="ptms-save-schedule">保存定时</button>
                <button type="button" id="ptms-test-webhook">测试推送</button>
              </div>
            </section>
            <section class="ptms-work">
              <div class="ptms-toolbar">
                <button type="button" id="ptms-scan" class="ptms-primary">开始扫描</button>
                <button type="button" id="ptms-open-all">打开全部站点</button>
                <button type="button" id="ptms-open-filtered">打开过滤结果</button>
                <button type="button" id="ptms-debug-export">导出调试包</button>
                <button type="button" id="ptms-clear">清除结果</button>
              </div>
              <div class="ptms-toolbar ptms-filters">
                <button type="button" id="ptms-diff">差异模式</button>
                <button type="button" id="ptms-filter-permanent">永久勋章</button>
                <button type="button" id="ptms-filter-limited">限时售卖</button>
                <button type="button" id="ptms-filter-positive">正收益</button>
              </div>
              <div id="ptms-result-stats" class="ptms-stats"></div>
              <div id="ptms-result-list" class="ptms-results"></div>
              <div class="ptms-section-title">实时日志</div>
              <div id="ptms-log" class="ptms-log"></div>
            </section>
          </main>
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
    root.querySelector('#ptms-diff').addEventListener('click', event => toggleFilter('diffMode', event.currentTarget, '差异模式 已启用', '差异模式'));
    root.querySelector('#ptms-filter-permanent').addEventListener('click', event => toggleFilter('filterPermanent', event.currentTarget, '永久勋章 已启用', '永久勋章'));
    root.querySelector('#ptms-filter-limited').addEventListener('click', event => toggleFilter('filterLimited', event.currentTarget, '限时售卖 已启用', '限时售卖'));
    root.querySelector('#ptms-filter-positive').addEventListener('click', event => toggleFilter('filterPositive', event.currentTarget, '正收益 已启用', '正收益'));
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
      #ptms-root, #ptms-root * { box-sizing: border-box; }
      #ptms-launcher {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483646;
        width: 42px;
        height: 42px;
        border: 0;
        border-radius: 8px;
        background: #2f6fed;
        color: #fff;
        font: 700 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25);
      }
      #ptms-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(15, 23, 42, 0.46);
        padding: 22px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #1f2937;
      }
      .ptms-panel {
        width: min(1160px, calc(100vw - 44px));
        height: min(820px, calc(100vh - 44px));
        margin: 0 auto;
        background: #f8fafc;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 24px 72px rgba(15, 23, 42, 0.32);
        border: 1px solid rgba(148, 163, 184, 0.32);
        display: flex;
        flex-direction: column;
      }
      .ptms-header {
        min-height: 72px;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #e5e7eb;
        background: #fff;
      }
      .ptms-header h2 {
        margin: 0;
        font-size: 19px;
        line-height: 1.2;
        color: #111827;
      }
      .ptms-header p {
        margin: 5px 0 0;
        font-size: 12px;
        color: #6b7280;
      }
      .ptms-icon-btn {
        width: 34px;
        height: 34px;
        border: 1px solid #d1d5db;
        background: #fff;
        color: #374151;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
      }
      .ptms-body {
        min-height: 0;
        flex: 1;
        display: grid;
        grid-template-columns: 360px 1fr;
      }
      .ptms-config, .ptms-work {
        min-height: 0;
        padding: 16px;
        overflow: auto;
      }
      .ptms-config {
        border-right: 1px solid #e5e7eb;
        background: #fff;
      }
      .ptms-section-title {
        margin: 2px 0 10px;
        font-size: 13px;
        font-weight: 700;
        color: #111827;
      }
      .ptms-row, .ptms-stack, .ptms-toolbar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      .ptms-stack {
        margin-bottom: 10px;
      }
      #ptms-root button {
        min-height: 32px;
        padding: 7px 11px;
        border: 1px solid #cbd5e1;
        background: #fff;
        color: #1f2937;
        border-radius: 6px;
        cursor: pointer;
        font: 500 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #ptms-root button:hover {
        border-color: #94a3b8;
        background: #f8fafc;
      }
      #ptms-root button:disabled {
        cursor: not-allowed;
        opacity: 0.62;
      }
      #ptms-root #ptms-launcher {
        min-height: 42px;
        padding: 0;
        border: 0;
        background: #2f6fed;
        color: #fff;
        border-radius: 8px;
        font-weight: 700;
      }
      #ptms-root #ptms-launcher:hover {
        border: 0;
        background: #2459c7;
      }
      #ptms-root button.ptms-primary, #ptms-root button.ptms-active {
        background: #2f6fed;
        border-color: #2f6fed;
        color: #fff;
      }
      .ptms-hint {
        margin: 8px 0 10px;
        padding: 10px;
        background: #f1f5f9;
        border: 1px dashed #cbd5e1;
        border-radius: 6px;
        color: #64748b;
        font-size: 12px;
        line-height: 1.5;
      }
      #ptms-sites {
        width: 100%;
        height: 240px;
        margin: 0 0 12px;
        resize: vertical;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 10px;
        background: #fbfdff;
        color: #111827;
        font: 12px/1.6 "SF Mono", Consolas, monospace;
      }
      #ptms-webhook-url, #ptms-schedule-time {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        min-height: 32px;
        padding: 7px 9px;
        color: #111827;
        background: #fff;
        font: 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #ptms-webhook-url {
        width: 100%;
        margin: 8px 0;
      }
      .ptms-check {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #374151;
      }
      .ptms-status {
        color: #64748b;
        font-size: 12px;
      }
      .ptms-status.ptms-active {
        color: #15803d;
        font-weight: 600;
      }
      .ptms-toolbar {
        margin-bottom: 10px;
      }
      .ptms-filters {
        padding-bottom: 10px;
        border-bottom: 1px solid #e5e7eb;
      }
      .ptms-stats {
        min-height: 38px;
        margin: 0 0 10px;
        padding: 9px 10px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 12px;
        color: #475569;
      }
      .ptms-stats-main {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      }
      .ptms-site-link-list {
        width: 100%;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #dbe2ea;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
        color: #64748b;
        line-height: 1.5;
      }
      .ptms-site-link-list b {
        color: #334155;
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
        border: 1px solid #e5e7eb;
        background: #f8fafc;
        border-radius: 5px;
      }
      .ptms-site-link-item a {
        color: #2f6fed;
        text-decoration: none;
      }
      .ptms-site-link-item a:hover {
        text-decoration: underline;
      }
      .ptms-site-link-item small {
        color: #94a3b8;
      }
      .ptms-no-link {
        color: #94a3b8;
      }
      .ptms-results {
        max-height: 380px;
        overflow: auto;
        border: 1px solid #e5e7eb;
        background: #fff;
        border-radius: 6px;
        margin-bottom: 14px;
      }
      .ptms-empty {
        padding: 28px;
        text-align: center;
        color: #94a3b8;
        font-size: 13px;
      }
      .ptms-result-site {
        border-bottom: 1px solid #e5e7eb;
      }
      .ptms-result-site:last-child {
        border-bottom: 0;
      }
      .ptms-result-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        padding: 10px 12px;
        background: #f8fafc;
      }
      .ptms-result-head strong {
        display: inline-block;
        margin-right: 8px;
        color: #111827;
        font-size: 13px;
      }
      .ptms-result-head a {
        color: #2f6fed;
        font-size: 12px;
        text-decoration: none;
      }
      .ptms-result-head span {
        color: #15803d;
        font-weight: 700;
        font-size: 12px;
        white-space: nowrap;
      }
      .ptms-medals {
        padding: 8px 12px;
      }
      .ptms-medal {
        padding: 9px 10px;
        margin: 6px 0;
        background: #f8fafc;
        border-left: 3px solid #cbd5e1;
        border-radius: 6px;
      }
      .ptms-medal.ptms-new {
        border-left-color: #f97316;
        background: #fff7ed;
      }
      .ptms-medal a {
        color: #111827;
        text-decoration: none;
        font-weight: 600;
        font-size: 13px;
      }
      .ptms-medal a:hover {
        color: #2f6fed;
        text-decoration: underline;
      }
      .ptms-medal em {
        margin-left: 6px;
        padding: 1px 5px;
        border-radius: 5px;
        background: #f97316;
        color: #fff;
        font-size: 10px;
        font-style: normal;
      }
      .ptms-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 5px;
        color: #475569;
        font-size: 12px;
      }
      .ptms-time-range {
        margin-top: 5px;
        color: #64748b;
        font-size: 12px;
      }
      .ptms-log {
        height: 170px;
        overflow: auto;
        background: #0f172a;
        border-radius: 6px;
        padding: 9px;
        color: #e2e8f0;
        font: 12px/1.6 "SF Mono", Consolas, monospace;
      }
      .ptms-log-entry {
        display: flex;
        gap: 8px;
      }
      .ptms-log-entry.ptms-error {
        color: #fca5a5;
      }
      .ptms-time {
        color: #94a3b8;
        flex: 0 0 auto;
      }
      @media (max-width: 860px) {
        #ptms-overlay { padding: 8px; }
        .ptms-panel {
          width: calc(100vw - 16px);
          height: calc(100vh - 16px);
        }
        .ptms-body {
          grid-template-columns: 1fr;
        }
        .ptms-config {
          border-right: 0;
          border-bottom: 1px solid #e5e7eb;
          max-height: 45vh;
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
