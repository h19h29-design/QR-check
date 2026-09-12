import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentPageFromPath } from '../assets/site.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const htmlPath = path.resolve(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function norm(s) {
  return String(s ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleText(source) {
  const withoutScripts = String(source ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');
  const decoded = withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return norm(decoded);
}

function anchorElements(source) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(source)) !== null) {
    const attrs = m[1] ?? '';
    const inner = m[2] ?? '';
    const hrefMatch = /href\s*=\s*(['"])(.*?)\1/i.exec(attrs);
    const href = hrefMatch ? hrefMatch[2] : '';
    const text = norm(inner.replace(/<[^>]+>/g, ' '));
    out.push({ attrs, href: String(href).trim(), text });
  }
  return out;
}

function hrefsFromAnchors() {
  return anchorElements(html).map((a) => a.href);
}

const text = visibleText(html);
const lowered = html.toLowerCase();

describe('site shell basics', () => {
  it('declares lang="ko"', () => {
    assert.match(html, /<html\b[^>]*\blang\s*=\s*["']ko["']/i);
  });

  it('has a viewport meta', () => {
    assert.match(html, /<meta\b[^>]*\bname\s*=\s*["']viewport["'][^>]*>/i);
    assert.match(html, /width\s*=\s*device-width/i);
  });

  it('has a skip link to #main', () => {
    assert.match(html, /<a\b[^>]*\bhref\s*=\s*["']#main["'][^>]*>/i);
  });

  it('has main with id="main"', () => {
    assert.match(html, /<main\b[^>]*\bid\s*=\s*["']main["']/i);
  });

  it('has a footer', () => {
    assert.match(html, /<footer\b/i);
  });

  it('links relative assets/site.css', () => {
    const re = /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi;
    const links = html.match(re) ?? [];
    assert.ok(links.length > 0, 'expected a stylesheet link');
    const hasSiteCss = links.some((tag) => {
      const href = /href\s*=\s*(['"])(.*?)\1/i.exec(tag)?.[2]?.trim() ?? '';
      return href === 'assets/site.css' || href === './assets/site.css';
    });
    assert.ok(hasSiteCss, 'expected relative href assets/site.css');
  });

  it('loads relative module assets/site.js', () => {
    const re = /<script\b[^>]*>(?:[\s\S]*?)<\/script>|<script\b[^>]*\/>/gi;
    const scripts = html.match(/<script\b[^>]*>/gi) ?? [];
    assert.ok(scripts.length > 0, 'expected a script tag');
    const hasSiteJs = scripts.some((tag) => {
      const isModule = /type\s*=\s*["']module["']/i.test(tag);
      const src = /src\s*=\s*(['"])(.*?)\1/i.exec(tag)?.[2]?.trim() ?? '';
      const isSiteJs = src === 'assets/site.js' || src === './assets/site.js';
      return isModule && isSiteJs;
    });
    assert.ok(hasSiteJs, `expected <script type="module" src="assets/site.js">, got: ${scripts.join(' ')}`);
    void re;
  });
});

describe('primary CTA', () => {
  it('has exact text 우리 학교용 만들기 linking to maker/', () => {
    const anchors = anchorElements(html);
    const match = anchors.find((a) => norm(a.text) === '우리 학교용 만들기');
    assert.ok(match, `expected an anchor with exact text "우리 학교용 만들기", got: ${anchors.map((a) => JSON.stringify(a.text)).join(', ')}`);
    assert.ok(
      match.href.includes('maker/'),
      `expected CTA href to contain maker/, got: ${JSON.stringify(match.href)}`,
    );
  });
});

describe('route links', () => {
  for (const route of ['maker/', 'demo/', 'guide/', 'help/']) {
    it(`links to ${route}`, () => {
      const hrefs = hrefsFromAnchors();
      assert.ok(
        hrefs.some((h) => h.includes(route)),
        `expected an anchor href containing ${route}, got: ${JSON.stringify(hrefs)}`,
      );
    });
  }
});

describe('visible content', () => {
  it('describes the workflow', () => {
    assert.ok(text.includes('우리 학교 점검 준비 끝'), `expected approved workflow heading, got excerpt: ${text.slice(0, 200)}`);
    for (const n of ['01', '02', '03', '04']) {
      assert.ok(text.includes(n), `expected approved flow stage ${n}`);
    }
  });

  it('describes school-owned Google/data handling', () => {
    assert.ok(text.includes('학교 소유'), 'expected 학교 소유');
    assert.ok(text.includes('Google'), 'expected Google');
    assert.ok(text.includes('데이터'), 'expected 데이터');
  });

  it('lists preparation items', () => {
    assert.ok(text.includes('학교 계정 준비'), 'expected approved preparation step (학교 계정 준비)');
  });

  it('covers roles', () => {
    assert.ok(text.includes('역할'), 'expected 역할');
    assert.ok(text.includes('관리자'), 'expected 관리자');
    assert.ok(text.includes('점검'), 'expected 점검');
  });

  it('covers update guidance', () => {
    assert.ok(text.includes('업데이트'), 'expected 업데이트');
    assert.ok(
      hrefsFromAnchors().some((h) => h.includes('update/') || h.includes('update')),
      'expected an update route link',
    );
  });

  it('covers FAQ/help', () => {
    assert.ok(text.includes('자주 묻는 질문'), 'expected 자주 묻는 질문');
    assert.ok(text.includes('도움말'), 'expected 도움말');
  });

  it('states setup prerequisite truth', () => {
    assert.ok(text.includes('연결 설정'), 'expected 연결 설정 (connection-setup truth)');
    assert.ok(text.includes('권한 심사와 학교별 정책 확인이 남아'), 'expected setup-readiness truth (no fake connected claims)');
  });
});

describe('no external or exaggerated claims', () => {
  it('has no script/link URL starting with http', () => {
    const urls = [];
    for (const tag of html.match(/<(script|link)\b[^>]*>/gi) ?? []) {
      const src = /(?:src|href)\s*=\s*(['"])(.*?)\1/i.exec(tag)?.[2]?.trim() ?? '';
      if (src) urls.push(src);
    }
    assert.ok(urls.length > 0, 'expected at least one script/link URL to inspect');
    for (const u of urls) {
      assert.ok(!/^https?:/i.test(u), `expected relative URL, got http URL: ${u}`);
    }
  });

  it('has no analytics/tracker/CDN references', () => {
    for (const needle of ['analytics', 'googletagmanager', 'googletag', 'gtag', 'tracker', 'tracking', 'cdn', 'jsdelivr', 'unpkg']) {
      assert.ok(!lowered.includes(needle), `unexpected tracker/CDN reference: ${needle}`);
    }
  });

  it('makes no fake claims', () => {
    for (const claim of ['무제한 무료', '1분 완성', '공식 교육', '수상', '자동 업데이트', '완벽 보장']) {
      assert.ok(!norm(html).includes(claim), `unexpected fake claim: ${claim}`);
    }
  });
});

describe('currentPageFromPath', () => {
  it('maps root to home', () => {
    assert.equal(currentPageFromPath('/'), 'home');
    assert.equal(currentPageFromPath(''), 'home');
    assert.equal(currentPageFromPath('/index.html'), 'home');
  });

  it('maps nested maker paths', () => {
    assert.equal(currentPageFromPath('/maker/'), 'maker');
    assert.equal(currentPageFromPath('/maker/index.html'), 'maker');
    assert.equal(currentPageFromPath('/installer/maker/'), 'maker');
  });

  it('maps nested demo paths', () => {
    assert.equal(currentPageFromPath('/demo/'), 'demo');
    assert.equal(currentPageFromPath('/demo/index.html'), 'demo');
    assert.equal(currentPageFromPath('/installer/demo/'), 'demo');
  });

  it('maps nested guide paths', () => {
    assert.equal(currentPageFromPath('/guide/'), 'guide');
    assert.equal(currentPageFromPath('/guide/index.html'), 'guide');
    assert.equal(currentPageFromPath('/installer/guide/'), 'guide');
  });

  it('maps nested help paths', () => {
    assert.equal(currentPageFromPath('/help/'), 'help');
    assert.equal(currentPageFromPath('/help/index.html'), 'help');
    assert.equal(currentPageFromPath('/installer/help/'), 'help');
  });
});
