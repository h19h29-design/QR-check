// installer/assets/site.js - shared static shell enhancement. No network, no storage.
export function currentPageFromPath(path) {
  const p = String(path || '/');
  if (p.includes('/maker')) return 'maker';
  if (p.includes('/update')) return 'update';
  if (p.includes('/demo')) return 'demo';
  if (p.includes('/guide')) return 'guide';
  if (p.includes('/help')) return 'help';
  return 'home';
}

export function footerYear() {
  return String(new Date().getFullYear());
}

let toastTimer;

function toast(message) {
  const node = typeof document !== 'undefined' ? document.getElementById('toast') : null;
  if (!node) return;
  clearTimeout(toastTimer);
  node.textContent = String(message ?? '');
  node.hidden = false;
  toastTimer = setTimeout(() => { node.hidden = true; }, 3500);
}

function initMenu() {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  if (!menu || !nav) return;
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    nav.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', '메뉴 열기');
      menu.focus();
    }
  });
}

function initTabs() {
  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    if (tabs.length === 0) return;
    function select(tab, moveFocus = false) {
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        const panelId = item.getAttribute('data-tab-target');
        const panel = panelId ? document.getElementById(panelId) : null;
        if (panel) panel.hidden = !selected;
      });
      if (moveFocus) tab.focus();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (event) => {
        let target;
        if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = tabs.length - 1;
        if (target !== undefined) { event.preventDefault(); select(tabs[target], true); }
      });
    });
  });
  document.querySelectorAll('[data-switch-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = document.getElementById(button.getAttribute('data-switch-tab'));
      if (tab) {
        tab.click();
        tab.focus();
        if (typeof tab.scrollIntoView === 'function') {
          tab.scrollIntoView({ block: 'center' });
        }
      }
    });
  });
}

function activateAnchor(anchor) {
  if (!anchor) return;
  let node = null;
  try {
    node = document.getElementById(anchor);
  } catch {
    return;
  }
  if (!node) return;
  if (node.getAttribute('role') === 'tabpanel') {
    const labelledBy = node.getAttribute('aria-labelledby');
    const tab = labelledBy ? document.getElementById(labelledBy) : null;
    if (tab) tab.click();
  }
  if (node.tagName === 'DETAILS') node.open = true;
  if (typeof node.scrollIntoView === 'function') {
    node.scrollIntoView({ block: 'start' });
  }
}

function initAnchorLinks() {
  const apply = () => {
    let anchor = '';
    try {
      anchor = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      anchor = '';
    }
    if (anchor) activateAnchor(anchor);
  };
  window.addEventListener('hashchange', apply);
  apply();
}

function initHelp() {
  const search = document.getElementById('help-search');
  if (!search) return;
  let category = 'all';
  const questions = [...document.querySelectorAll('[data-faq-category]')];
  if (questions.length === 0) return;
  const labels = { all: '전체 도움말', install: '설치·시작하기', account: 'Google 계정·권한', storage: '데이터 보관·관리', use: '점검·체험하기' };
  const normalize = (text) => String(text).toLocaleLowerCase('ko').replace(/\s+/g, ' ').trim();
  function filter() {
    const terms = normalize(search.value).split(' ').filter(Boolean);
    let count = 0;
    questions.forEach((question) => {
      const inCategory = category === 'all' || question.getAttribute('data-faq-category') === category;
      const found = terms.every((term) => normalize(question.textContent).includes(term));
      question.hidden = !(inCategory && found);
      if (!question.hidden) count += 1;
    });
    const heading = document.getElementById('help-category-heading');
    if (heading) heading.textContent = labels[category] || labels.all;
    const summary = document.getElementById('help-search-summary');
    if (summary) summary.textContent = `${search.value.trim() ? '검색 결과' : '질문'} ${count}개`;
    const empty = document.getElementById('help-empty');
    if (empty) empty.hidden = count > 0;
  }
  document.querySelectorAll('[data-help-category]').forEach((button) => button.addEventListener('click', () => {
    category = button.getAttribute('data-help-category') || 'all';
    document.querySelectorAll('[data-help-category]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    filter();
  }));
  search.addEventListener('input', filter);
  filter();
}

async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (!navigator.clipboard) throw new Error('Clipboard API not available');
    await navigator.clipboard.writeText(value);
  } catch (_) {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.append(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    area.remove();
    if (!copied) { toast('자동 복사가 제한되어 있습니다. 화면의 텍스트를 직접 선택해 복사하세요.'); return; }
  }
  toast('복사했습니다.');
}

function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', () => copyText(button.getAttribute('data-copy')));
  });
}

function initPrint() {
  document.querySelectorAll('[data-print]').forEach((button) => {
    button.addEventListener('click', () => {
      const visiblePanel = document.querySelector('[role="tabpanel"]:not([hidden])');
      const details = visiblePanel ? [...visiblePanel.querySelectorAll('details')] : [];
      const states = details.map((detail) => detail.open);
      details.forEach((detail) => { detail.open = true; });
      window.addEventListener('afterprint', () => {
        details.forEach((detail, index) => { detail.open = states[index]; });
      }, { once: true });
      window.print();
    });
  });
}

// Presentation-only maker stage indicator: driven by real install state via
// the `qr-maker-stage` event dispatched from maker/maker.js. Never advances
// install state itself.
function initDisplayStage() {
  const bar = document.getElementById('wizard-progress-bar');
  if (!bar) return;
  window.addEventListener('qr-maker-stage', (event) => {
    const stage = event && event.detail ? event.detail.stage : null;
    if (Number.isInteger(stage) && stage >= 1 && stage <= 4) {
      bar.style.width = `${stage * 25}%`;
    }
  });
}

function boot() {
  const nav = document.querySelector('[data-site-nav]');
  if (nav) {
    const page = currentPageFromPath(window.location.pathname);
    const links = nav.querySelectorAll('a[data-page]');
    links.forEach((a) => {
      if (a.getAttribute('data-page') === page) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = footerYear();
  initMenu();
  initTabs();
  initAnchorLinks();
  initHelp();
  initCopy();
  initPrint();
  initDisplayStage();
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
