const state = {
  token: window.__PORTFOLIO_STUDIO_TOKEN__ || new URLSearchParams(location.search).get('token') || sessionStorage.getItem('portfolioStudioToken') || '',
  data: null,
  route: 'overview',
  activePath: null,
  document: null,
  pendingPreview: null,
  pendingAction: null,
  search: '',
  widgetSession: null,
  frontWidgetSessions: {},
};

if (state.token) {
  sessionStorage.setItem('portfolioStudioToken', state.token);
  history.replaceState({}, '', '/');
}

const main = document.querySelector('#main');
const nav = document.querySelector('#primary-nav');
const reviewDialog = document.querySelector('#review-dialog');
const createDialog = document.querySelector('#create-dialog');

const icons = {
  experience: '▤', sitecopy: '▤', skills: '◇', overview: '⌂', pages: '▤', projects: '◇', publications: '◫', talks: '◖', teaching: '⌁',
  leadership: '★', portfolio: '▦', posts: '✎', drafts: '◌', media: '▧', profile: '◉',
  navigation: '↕', history: '↶', health: '✓'
};

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const formatBytes = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
const formatDate = value => value ? new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: value.includes?.('T') ? 'short' : undefined}).format(new Date(value)) : 'No Studio changes yet';
const titleCase = value => String(value).replace(/[_-]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
const decodeHtml = value => { const template = document.createElement('template'); template.innerHTML = String(value); return template.content.textContent.trim(); };
const buttonStyle = "border-radius:12px;background-color:rgb(203, 195, 227);border:none";

function overlaps(range, ranges) {
  return ranges.some(other => range.start < other.end && range.end > other.start);
}

function matchUrl(attributes = '') {
  const windowOpen = attributes.match(/window\.open\(\s*['\"]([^'\"]+)/i);
  const locationHref = attributes.match(/location\.href\s*=\s*['\"]([^'\"]+)/i);
  return (windowOpen || locationHref || [])[1] || '';
}

function findSkillSection(body, path) {
  let boundaryStart = -1, boundaryEnd = -1, label = 'Skills used';
  const projectMarker = /<b>\s*Skills:\s*<\/b>/i.exec(body);
  if (projectMarker) {
    boundaryStart = projectMarker.index + projectMarker[0].length;
    const end = /(?:\s*<br\s*\/?\s*>\s*){2}/i.exec(body.slice(boundaryStart));
    boundaryEnd = end ? boundaryStart + end.index : body.length;
  } else {
    const cloudMarker = /<summary\b[^>]*>\s*<b>\s*Skill Cloud\s*<\/b>\s*<\/summary>/i.exec(body);
    if (cloudMarker) {
      boundaryStart = cloudMarker.index + cloudMarker[0].length;
      const end = /<hr\b[^>]*>/i.exec(body.slice(boundaryStart));
      boundaryEnd = end ? boundaryStart + end.index : body.length;
      label = 'Global skill cloud';
    }
  }
  if (boundaryStart < 0) return path.startsWith('_projects/') ? {label, skills: [], originalSkills: [], range: null, isProject: true} : null;
  const segment = body.slice(boundaryStart, boundaryEnd);
  const matches = [...segment.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)];
  const skills = matches.map(match => decodeHtml(match[1])).filter(Boolean);
  const range = matches.length ? {
    start: boundaryStart + matches[0].index,
    end: boundaryStart + matches.at(-1).index + matches.at(-1)[0].length,
  } : {start: boundaryStart, end: boundaryEnd};
  return {label, skills, originalSkills: [...skills], range, isProject: path.startsWith('_projects/')};
}

function inspectWidgets(body, path) {
  const skills = state.data?.capabilities?.modernSkills && path.startsWith('_projects/') ? null : findSkillSection(body, path);
  const reserved = skills?.range ? [skills.range] : [];
  const model = {sourceBody: body, skills, buttons: [], links: [], images: [], embeds: [], expanders: []};
  const addMatches = (regex, callback) => {
    for (const match of body.matchAll(regex)) {
      const range = {start: match.index, end: match.index + match[0].length};
      if (!overlaps(range, reserved)) callback(match, range);
    }
  };

  addMatches(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, (match, range) => {
    const template = document.createElement('template');
    template.innerHTML = match[0];
    const element = template.content.firstElementChild;
    const image = element?.querySelector('img');
    model.buttons.push({range, raw: match[0], label: element?.textContent.trim() || '', url: matchUrl(match[1]), disabled: element?.hasAttribute('disabled') || false, image: image?.getAttribute('src') || '', original: null});
  });
  reserved.push(...model.buttons.map(item => item.range));

  addMatches(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, range) => {
    const template = document.createElement('template'); template.innerHTML = match[0];
    const element = template.content.firstElementChild;
    model.links.push({range, raw: match[0], format: 'html', label: element?.textContent.trim() || '', url: element?.getAttribute('href') || '', original: null});
  });
  addMatches(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, (match, range) => model.links.push({range, raw: match[0], format: 'markdown', label: match[1], url: match[2], original: null}));
  reserved.push(...model.links.map(item => item.range));

  addMatches(/<img\b[^>]*>/gi, (match, range) => {
    const template = document.createElement('template'); template.innerHTML = match[0];
    const element = template.content.firstElementChild;
    model.images.push({range, raw: match[0], format: 'html', alt: element?.getAttribute('alt') || '', src: element?.getAttribute('src') || '', original: null});
  });
  addMatches(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, range) => model.images.push({range, raw: match[0], format: 'markdown', alt: match[1], src: match[2], original: null}));
  reserved.push(...model.images.map(item => item.range));

  addMatches(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (match, range) => {
    const template = document.createElement('template'); template.innerHTML = match[0];
    const element = template.content.firstElementChild;
    model.embeds.push({range, raw: match[0], src: element?.getAttribute('src') || '', title: element?.getAttribute('title') || '', height: element?.getAttribute('height') || '', width: element?.getAttribute('width') || '', original: null});
  });

  for (const match of body.matchAll(/<details\b([^>]*)>[\s\S]*?<summary\b[^>]*>([\s\S]*?)<\/summary>/gi)) {
    const detailsTag = match[0].match(/^<details\b[^>]*>/i)?.[0] || '<details>';
    const summaryTag = /<summary\b[^>]*>/i.exec(match[0]);
    if (!summaryTag) continue;
    const summaryStart = match.index + summaryTag.index + summaryTag[0].length;
    model.expanders.push({
      detailsRange: {start: match.index, end: match.index + detailsTag.length},
      summaryRange: {start: summaryStart, end: summaryStart + match[2].length},
      detailsTag,
      summaryRaw: match[2],
      label: decodeHtml(match[2]),
      open: /\bopen\b/i.test(match[1]),
      original: null,
    });
  }
  for (const kind of ['buttons','links','images','embeds','expanders']) {
    model[kind].forEach(item => { item.original = {...item}; });
  }
  return model;
}

function widgetSection(title, copy, kind, items, addLabel = '') {
  const rows = items.map((item, index) => item.removed ? '' : widgetRow(kind, item, index)).join('');
  return `<section class="widget-section"><div class="widget-section-head"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></div>${addLabel ? `<button type="button" class="quiet-button" data-add-widget="${kind}">${escapeHtml(addLabel)}</button>` : ''}</div><div class="widget-list" data-widget-list="${kind}">${rows || '<p class="widget-empty">None on this page yet.</p>'}</div></section>`;
}

function widgetRow(kind, item, index) {
  const remove = `<button type="button" class="remove-field" data-remove-widget aria-label="Remove">×</button>`;
  if (kind === 'buttons') return `<div class="widget-row" data-kind="buttons" data-index="${index}"><label><span>Button label</span><input data-prop="label" value="${escapeHtml(item.label)}"></label><label><span>Destination (optional)</span><input data-prop="url" value="${escapeHtml(item.url)}" placeholder="https://…"></label><label><span>Icon image (optional)</span><input data-prop="image" value="${escapeHtml(item.image)}"></label><label class="compact-toggle"><input type="checkbox" data-prop="disabled" ${item.disabled ? 'checked' : ''}> Disabled</label>${remove}</div>`;
  if (kind === 'links') return `<div class="widget-row two" data-kind="links" data-index="${index}"><label><span>Link text</span><input data-prop="label" value="${escapeHtml(item.label)}"></label><label><span>Destination</span><input data-prop="url" value="${escapeHtml(item.url)}"></label>${remove}</div>`;
  if (kind === 'images') return `<div class="widget-row two" data-kind="images" data-index="${index}"><label><span>Image file or address</span><input data-prop="src" value="${escapeHtml(item.src)}" list="portfolio-images"></label><label><span>Alternative text</span><input data-prop="alt" value="${escapeHtml(item.alt)}"></label>${remove}</div>`;
  if (kind === 'embeds') return `<div class="widget-row" data-kind="embeds" data-index="${index}"><label><span>Embedded page address</span><input data-prop="src" value="${escapeHtml(item.src)}"></label><label><span>Title</span><input data-prop="title" value="${escapeHtml(item.title)}"></label><label><span>Width</span><input data-prop="width" value="${escapeHtml(item.width)}"></label><label><span>Height</span><input data-prop="height" value="${escapeHtml(item.height)}"></label>${remove}</div>`;
  return `<div class="widget-row two" data-kind="expanders" data-index="${index}"><label><span>Expandable section heading</span><input data-prop="label" value="${escapeHtml(item.label)}"></label><label class="compact-toggle"><input type="checkbox" data-prop="open" ${item.open ? 'checked' : ''}> Open by default</label>${remove}</div>`;
}

function frontMatterWidgetModels(frontMatter, path) {
  const result = {};
  for (const [key, value] of Object.entries(frontMatter)) {
    if (typeof value !== 'string' || !/[<[]/.test(value)) continue;
    const model = inspectWidgets(value, `${path}#${key}`);
    const count = ['buttons','links','images','embeds','expanders'].reduce((total, kind) => total + model[kind].length, 0);
    if (count) result[key] = model;
  }
  return result;
}

function frontMatterWidgetsMarkup(models) {
  return Object.entries(models).map(([key, model]) => {
    const rows = ['buttons','links','images','embeds','expanders'].flatMap(kind => model[kind].map((item, index) => item.removed ? '' : widgetRow(kind, item, index).replace('class="widget-row', `class="front-widget-row widget-row`).replace(`data-kind="${kind}"`, `data-front-key="${escapeHtml(key)}" data-kind="${kind}"`))).join('');
    return rows ? `<section class="widget-section front-widget-group" data-front-group="${escapeHtml(key)}"><div class="widget-section-head"><div><h3>${escapeHtml(titleCase(key))} elements</h3><p>These appear in the page summary or listing card.</p></div></div><div class="widget-list">${rows}</div></section>` : '';
  }).join('');
}

function widgetsMarkup(model) {
  const imageOptions = (state.data?.assets || []).filter(asset => asset.kind === 'image').map(asset => `<option value="../${escapeHtml(asset.path)}"></option><option value="/${escapeHtml(asset.path)}"></option>`).join('');
  const skills = model.skills ? `<section class="widget-section featured"><div class="widget-section-head"><div><h3>${escapeHtml(model.skills.label)}</h3><p>${model.skills.isProject ? 'Add or remove project skills here. New skills are also added to the global skill cloud.' : 'These skills appear in the expandable Skill Cloud on the Projects page.'}</p></div><button type="button" class="quiet-button" id="add-skill">Add skill</button></div><div class="skill-editor" id="skill-list">${model.skills.skills.map((skill, index) => `<div class="skill-row" data-skill-index="${index}"><input aria-label="Skill" value="${escapeHtml(skill)}"><button type="button" class="remove-field" data-remove-skill aria-label="Remove ${escapeHtml(skill)}">×</button></div>`).join('')}</div></section>` : '';
  return `<datalist id="portfolio-images">${imageOptions}</datalist>${frontMatterWidgetsMarkup(state.frontWidgetSessions)}<div id="body-widget-sections">${skills}
    ${widgetSection('Buttons & badges', 'Edit visible labels, destinations, icons, and disabled states without touching HTML.', 'buttons', model.buttons, 'Add button')}
    ${widgetSection('Links', 'Edit linked text and destinations from both regular and Markdown links.', 'links', model.links, 'Add link')}
    ${widgetSection('Images', 'Choose an existing media file or enter an image address and alternative text.', 'images', model.images, 'Add image')}
    ${widgetSection('Embedded pages', 'Manage maps and other embedded pages.', 'embeds', model.embeds, 'Add embed')}
    ${widgetSection('Expandable sections', 'Rename collapsible panels and choose whether they start open.', 'expanders', model.expanders)}</div>`;
}

async function api(path, options = {}) {
  const headers = {'X-Studio-Token': state.token, ...(options.body ? {'Content-Type': 'application/json'} : {})};
  const response = await fetch(path, {...options, headers: {...headers, ...(options.headers || {})}});
  const payload = await response.json().catch(() => ({error: 'Portfolio Studio returned an unreadable response.'}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function toast(message, kind = 'success') {
  const item = document.createElement('div');
  item.className = `toast ${kind}`;
  item.textContent = message;
  document.querySelector('#toast-region').append(item);
  setTimeout(() => item.remove(), 4200);
}

async function loadStudio({preserveRoute = false} = {}) {
  try {
    state.data = await api('/api/bootstrap');
    document.querySelector('#site-name').textContent = state.data.site.name;
    document.querySelector('#site-path').textContent = state.data.site.root;
    renderNav();
    if (!preserveRoute || !state.route) state.route = 'overview';
    render();
  } catch (error) {
    main.innerHTML = `<div class="empty-state"><div><h1>Portfolio Studio couldn’t open</h1><p>${escapeHtml(error.message)}</p></div></div>`;
  }
}

function renderNav() {
  const content = state.data.groups.map(group => navButton(group.key, group.label, group.count)).join('');
  nav.innerHTML = `
    ${navButton('overview', 'Overview')}
    <div class="nav-section-label">Content</div>${content}
    <div class="nav-section-label">Website</div>
    ${navButton('media', 'Media', state.data.assets.length)}
    ${state.data.capabilities?.modernSkills ? navButton('skills', 'Skills, languages & degrees') : ''}
    ${navButton('profile', 'Profile & settings')}
    ${navButton('navigation', 'Navigation')}
    <div class="nav-section-label">Safety</div>
    ${navButton('history', 'Change history', state.data.history.length)}
    ${navButton('health', 'Site health', state.data.issues.length)}
  `;
  nav.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.route)));
}

function navButton(route, label, count = null) {
  return `<button class="nav-button ${state.route === route ? 'active' : ''}" data-route="${escapeHtml(route)}">
    <span class="nav-icon" aria-hidden="true">${icons[route] || '•'}</span><span>${escapeHtml(label)}</span>
    ${count !== null ? `<span class="count">${count}</span>` : ''}</button>`;
}

function navigate(route) {
  state.route = route;
  state.activePath = null;
  state.document = null;
  state.search = '';
  document.querySelector('#sidebar').classList.remove('open');
  renderNav();
  render();
  main.focus({preventScroll: true});
}

function render() {
  const group = state.data.groups.find(entry => entry.key === state.route);
  if (group) return renderCollection(group);
  const renderers = {skills: renderSkills, overview: renderOverview, media: renderMedia, profile: renderProfile, navigation: renderNavigation, history: renderHistory, health: renderHealth};
  (renderers[state.route] || renderOverview)();
}

function pageHead(kicker, title, copy = '', action = '') {
  return `<div class="page-head"><div><span class="eyebrow">${escapeHtml(kicker)}</span><h1>${escapeHtml(title)}</h1>${copy ? `<p>${escapeHtml(copy)}</p>` : ''}</div>${action}</div>`;
}

function renderOverview() {
  const {summary, history, issues, groups} = state.data;
  const recent = history.slice(0, 5);
  main.innerHTML = `${pageHead('Today', `Welcome back, ${state.data.site.name.split(' ')[0]}`, 'Manage the words, work, and links on your public portfolio from one safe workspace.')}
    <section class="stat-grid" aria-label="Portfolio summary">
      <div class="stat"><span>Content entries</span><strong>${summary.content}</strong></div>
      <div class="stat"><span>Images & files</span><strong>${summary.media}</strong></div>
      <div class="stat"><span>Items to review</span><strong>${summary.issues}</strong></div>
      <div class="stat"><span>Last Studio change</span><strong style="font-size:18px">${escapeHtml(formatDate(summary.lastChange))}</strong></div>
    </section>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-head"><h2>Recent changes</h2><button class="quiet-button" data-go="history">View all</button></div><div class="panel-body">
        ${recent.length ? `<ul class="activity-list">${recent.map(historyRow).join('')}</ul>` : `<div class="empty-state" style="min-height:190px"><div><strong>No Studio changes yet</strong><p>Your first saved edit will appear here with a restore option.</p></div></div>`}
      </div></section>
      <section class="panel"><div class="panel-head"><h2>Quick edit</h2></div><div class="panel-body"><div class="quick-grid">
        ${groups.filter(group => ['pages','projects','publications','talks'].includes(group.key)).map(group => `<button class="quick-button" data-go="${group.key}"><strong>${escapeHtml(group.label)}</strong><span>${group.count} entries</span></button>`).join('')}
        <button class="quick-button" data-go="profile"><strong>Profile</strong><span>Name, bio & links</span></button>
        <button class="quick-button" data-go="media"><strong>Media</strong><span>Images & downloads</span></button>
      </div></div></section>
      <section class="panel"><div class="panel-head"><h2>Site health</h2><button class="quiet-button" data-go="health">Review</button></div><div class="panel-body">
        ${issues.length ? `<ul class="issue-list">${issues.slice(0,5).map(issueRow).join('')}</ul>` : '<p>No structural issues found.</p>'}
      </div></section>
    </div>`;
  main.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
}

function historyRow(entry) {
  return `<li class="activity-row"><div><div class="row-title">${escapeHtml(entry.label)}</div><div class="row-meta">${escapeHtml(entry.path)} · ${escapeHtml(formatDate(entry.timestamp))}</div></div><span class="status-label">${escapeHtml(entry.action)}</span></li>`;
}

function issueRow(issue) {
  return `<li class="issue-row"><div><div class="row-title">${escapeHtml(issue.title)}</div><div class="row-meta">${escapeHtml(issue.paths.join(', '))}</div></div><span class="status-label ${issue.level === 'error' ? 'error' : ''}">${escapeHtml(issue.level)}</span></li>`;
}

function renderCollection(group) {
  const filtered = group.items.filter(item => `${item.title} ${item.path}`.toLowerCase().includes(state.search.toLowerCase()));
  main.innerHTML = `${pageHead('Content library', group.label, `Edit any ${group.label.toLowerCase()} entry. Nothing changes until you review and confirm the exact difference.`, group.fixed ? '' : `<button class="primary-button" data-create-group="${group.key}">New ${group.label.replace(/s$/, '')}</button>`)}
    <section class="content-workspace">
      <aside class="library-pane"><div class="library-tools"><input class="search-input" id="library-search" type="search" value="${escapeHtml(state.search)}" placeholder="Search ${escapeHtml(group.label.toLowerCase())}" aria-label="Search ${escapeHtml(group.label)}"></div>
        <ul class="item-list">${filtered.map(item => `<li><button class="item-button ${state.activePath === item.path ? 'active' : ''}" data-path="${escapeHtml(item.path)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.date || item.permalink || item.name)}${item.invalid ? ' · Needs repair' : ''}</span></button></li>`).join('') || '<li class="editor-empty">No matching entries.</li>'}</ul>
      </aside>
      <div class="editor-pane" id="editor-pane">${state.document ? editorMarkup(state.document) : '<div class="editor-empty"><div><strong>Select an entry to edit</strong><p>Its details and content will open here.</p></div></div>'}</div>
    </section>`;
  document.querySelector('[data-create-group]')?.addEventListener('click', event => openCreate(event.currentTarget.dataset.createGroup));
  document.querySelector('#library-search').addEventListener('input', event => { state.search = event.target.value; renderCollection(group); document.querySelector('#library-search').focus(); });
  main.querySelectorAll('[data-path]').forEach(button => button.addEventListener('click', () => openDocument(button.dataset.path)));
  if (state.document) wireEditor();
}

async function openDocument(path) {
  try {
    state.activePath = path;
    state.document = await api(`/api/document?path=${encodeURIComponent(path)}`);
    state.widgetSession = null;
    render();
  } catch (error) { toast(error.message, 'error'); }
}

function editorMarkup(doc) {
  const entries = Object.entries(doc.frontMatter);
  const shared = state.route === 'sitecopy';
  state.widgetSession = inspectWidgets(doc.body, doc.path);
  state.frontWidgetSessions = frontMatterWidgetModels(doc.frontMatter, doc.path);
  state.originalProjectSkills = state.widgetSession.skills?.isProject ? [...state.widgetSession.skills.originalSkills] : [];
  const bodyWidgetCount = ['buttons','links','images','embeds','expanders'].reduce((count, kind) => count + state.widgetSession[kind].length, state.widgetSession.skills?.skills.length || 0);
  const frontWidgetCount = Object.values(state.frontWidgetSessions).reduce((total, model) => total + ['buttons','links','images','embeds','expanders'].reduce((count, kind) => count + model[kind].length, 0), 0);
  const widgetCount = bodyWidgetCount + frontWidgetCount;
  const initialTab = !shared && (widgetCount || doc.path.startsWith('_projects/')) ? 'widgets' : 'writing';
  state.editorTab = initialTab;
  return `<div class="editor-head"><div><span class="eyebrow">${escapeHtml(doc.path)}</span><h2>${escapeHtml(doc.frontMatter.title || doc.path.split('/').pop())}</h2></div><div class="editor-actions">${shared ? '' : '<button class="danger-button" id="delete-entry">Remove</button>'}<button class="primary-button" id="review-entry">Review changes</button></div></div>
    ${shared ? '<p class="field-note">Shared content contains HTML and Jekyll tags. Edit wording or media paths; keep template tags intact. The content preview does not render Jekyll. Every save is reviewed and can be restored.</p>' : ''}
    ${state.data.capabilities?.modernSkills && doc.path.startsWith('_projects/') ? '<p class="field-note">Project skills are the tags in Page details (one per line). Manage the global cloud separately under Skills, languages &amp; degrees.</p>' : ''}
    <form class="editor-form" id="document-form">
      <div class="tabs"><button type="button" class="tab" data-tab="details">Page details</button><button type="button" class="tab ${initialTab === 'widgets' ? 'active' : ''}" data-tab="widgets">Visual elements <span class="tab-count">${widgetCount}</span></button><button type="button" class="tab ${initialTab === 'writing' ? 'active' : ''}" data-tab="writing">Writing</button><button type="button" class="tab" data-tab="preview">Page preview</button></div>
      <div id="details-tab" class="hidden">
        <div id="field-list">${entries.map(([key, value]) => fieldRow(key, value)).join('')}</div>
        <button type="button" class="quiet-button" id="add-field">Add detail</button>
      </div>
      <div id="widgets-tab" class="${initialTab === 'widgets' ? '' : 'hidden'}">${widgetsMarkup(state.widgetSession)}</div>
      <div id="writing-tab" class="${initialTab === 'writing' ? '' : 'hidden'}">
        <label><span>Page content</span></label>
        <div class="body-toolbar" aria-label="Formatting tools"><button type="button" data-format="bold" title="Bold">B</button><button type="button" data-format="italic" title="Italic"><em>I</em></button><button type="button" data-format="heading" title="Heading">H2</button><button type="button" data-format="link" title="Link">↗</button><button type="button" data-format="list" title="List">•</button></div>
        <textarea id="body-editor" class="body-editor" aria-label="Page content">${escapeHtml(doc.body)}</textarea>
      </div>
      <div id="preview-tab" class="hidden"><iframe id="preview-frame" class="preview-frame" sandbox="allow-scripts" title="Content preview"></iframe><p class="field-note">This preview focuses on the entry’s content. The public website supplies its final navigation, fonts, and page layout.</p></div>
    </form>`;
}

function fieldRow(key, value) {
  let serialized = value;
  let kind = typeof value;
  if (Array.isArray(value)) { serialized = value.join('\n'); kind = 'list'; }
  else if (value && typeof value === 'object') { serialized = JSON.stringify(value, null, 2); kind = 'object'; }
  const control = kind === 'boolean'
    ? `<select class="field-value" data-kind="boolean"><option value="true" ${value === true ? 'selected' : ''}>Yes</option><option value="false" ${value === false ? 'selected' : ''}>No</option></select>`
    : (kind === 'list' || kind === 'object' || String(serialized ?? '').length > 100)
      ? `<textarea class="field-value" data-kind="${kind}" rows="${kind === 'object' ? 5 : 2}">${escapeHtml(serialized ?? '')}</textarea>`
      : `<input class="field-value" data-kind="${kind}" value="${escapeHtml(serialized ?? '')}">`;
  return `<div class="field-row"><input class="field-key" aria-label="Detail name" value="${escapeHtml(key)}">${control}<button type="button" class="remove-field" aria-label="Remove ${escapeHtml(key)}">×</button></div>`;
}

function wireEditor() {
  document.querySelector('#review-entry').addEventListener('click', reviewDocument);
  document.querySelector('#delete-entry')?.addEventListener('click', reviewDelete);
  document.querySelector('#add-field').addEventListener('click', () => {
    document.querySelector('#field-list').insertAdjacentHTML('beforeend', fieldRow('', ''));
    wireRemoveFields();
  });
  wireRemoveFields();
  wireWidgets();
  wireFrontWidgets();
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => switchEditorTab(button.dataset.tab)));
  document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => formatBody(button.dataset.format)));
}

function captureWidgetInputs() {
  if (!state.widgetSession) return;
  document.querySelectorAll('#body-widget-sections .widget-row[data-kind]').forEach(row => {
    const item = state.widgetSession[row.dataset.kind]?.[Number(row.dataset.index)];
    if (!item) return;
    row.querySelectorAll('[data-prop]').forEach(input => { item[input.dataset.prop] = input.type === 'checkbox' ? input.checked : input.value; });
  });
  if (state.widgetSession.skills) state.widgetSession.skills.skills = [...document.querySelectorAll('#skill-list input')].map(input => input.value.trim()).filter(Boolean);
}

function wireWidgets() {
  document.querySelector('#add-skill')?.addEventListener('click', () => {
    captureWidgetInputs();
    state.widgetSession.skills.skills.push('');
    refreshWidgets();
    document.querySelector('#skill-list .skill-row:last-child input')?.focus();
  });
  document.querySelectorAll('[data-remove-skill]').forEach(button => button.addEventListener('click', () => {
    captureWidgetInputs();
    state.widgetSession.skills.skills.splice(Number(button.closest('.skill-row').dataset.skillIndex), 1);
    refreshWidgets();
  }));
  document.querySelectorAll('[data-add-widget]').forEach(button => button.addEventListener('click', () => {
    captureWidgetInputs();
    const kind = button.dataset.addWidget;
    const defaults = {
      buttons: {label:'New button', url:'', image:'', disabled:false},
      links: {label:'New link', url:'https://', format:'markdown'},
      images: {alt:'', src:'../images/', format:'markdown'},
      embeds: {src:'https://', title:'Embedded content', width:'850', height:'700'},
    };
    state.widgetSession[kind].push({...defaults[kind], isNew:true, original:null});
    refreshWidgets();
    document.querySelector(`[data-widget-list="${kind}"] .widget-row:last-child input`)?.focus();
  }));
  document.querySelectorAll('#body-widget-sections [data-remove-widget]').forEach(button => button.addEventListener('click', () => {
    captureWidgetInputs();
    const row = button.closest('.widget-row');
    state.widgetSession[row.dataset.kind][Number(row.dataset.index)].removed = true;
    refreshWidgets();
  }));
}

function refreshWidgets() {
  const panel = document.querySelector('#widgets-tab');
  if (!panel) return;
  for (const kind of ['buttons','links','images','embeds','expanders']) state.widgetSession[kind] = state.widgetSession[kind].filter(item => !item.removed || !item.isNew);
  panel.innerHTML = widgetsMarkup(state.widgetSession);
  wireWidgets();
  wireFrontWidgets();
}

function captureFrontWidgetInputs() {
  document.querySelectorAll('.front-widget-row').forEach(row => {
    const model = state.frontWidgetSessions[row.dataset.frontKey];
    const item = model?.[row.dataset.kind]?.[Number(row.dataset.index)];
    if (!item) return;
    row.querySelectorAll('[data-prop]').forEach(input => { item[input.dataset.prop] = input.type === 'checkbox' ? input.checked : input.value; });
  });
}

function wireFrontWidgets() {
  document.querySelectorAll('.front-widget-row [data-remove-widget]').forEach(button => button.addEventListener('click', () => {
    captureFrontWidgetInputs();
    const row = button.closest('.front-widget-row');
    state.frontWidgetSessions[row.dataset.frontKey][row.dataset.kind][Number(row.dataset.index)].removed = true;
    refreshWidgets();
  }));
}

function changed(item, keys) {
  return !item.original || keys.some(key => item[key] !== item.original[key]);
}

function renderedButton(item) {
  if (item.original && !changed(item, ['label','url','image','disabled'])) return item.raw;
  const template = document.createElement('template');
  template.innerHTML = item.raw || `<button style="${buttonStyle}"></button>`;
  const button = template.content.firstElementChild;
  button.innerHTML = '';
  if (item.image) {
    const image = document.createElement('img'); image.setAttribute('src', item.image); image.alt = ''; image.style.height = '20px';
    button.append(image, document.createTextNode(' '));
  }
  button.append(document.createTextNode(item.label.trim()));
  button.toggleAttribute('disabled', Boolean(item.disabled));
  button.removeAttribute('onclick');
  if (item.url.trim()) {
    const safe = item.url.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    button.setAttribute('onclick', `window.open('${safe}','_blank');`);
    button.setAttribute('type', 'button');
  }
  return button.outerHTML;
}

function renderedLink(item) {
  if (item.original && !changed(item, ['label','url'])) return item.raw;
  return item.format === 'html' ? `<a href="${escapeHtml(item.url.trim())}">${escapeHtml(item.label.trim())}</a>` : `[${item.label.trim()}](${item.url.trim()})`;
}

function renderedImage(item) {
  if (item.original && !changed(item, ['alt','src'])) return item.raw;
  if (item.format === 'html') {
    const template = document.createElement('template'); template.innerHTML = item.raw || '<img>';
    const image = template.content.firstElementChild; image.setAttribute('src', item.src.trim()); image.setAttribute('alt', item.alt.trim());
    return image.outerHTML;
  }
  return `![${item.alt.trim()}](${item.src.trim()})`;
}

function renderedEmbed(item) {
  if (item.original && !changed(item, ['src','title','width','height'])) return item.raw;
  const template = document.createElement('template'); template.innerHTML = item.raw || '<iframe></iframe>';
  const frame = template.content.firstElementChild;
  for (const [key, value] of [['src',item.src],['title',item.title],['width',item.width],['height',item.height]]) value.trim() ? frame.setAttribute(key, value.trim()) : frame.removeAttribute(key);
  return frame.outerHTML;
}

function skillButtons(skills) {
  return [...new Map(skills.map(skill => [skill.trim().toLowerCase(), skill.trim()])).values()].filter(Boolean).map(skill => `<button style='${buttonStyle}'> ${escapeHtml(skill)}</button>`).join(' ');
}

function applySkillList(body, section, skills) {
  if (section?.range) return body.slice(0, section.range.start) + skillButtons(skills) + body.slice(section.range.end);
  if (section?.isProject && skills.length) return `${body.trimEnd()}\n<br>\n<br>\n<b>Skills:</b> ${skillButtons(skills)}\n`;
  return body;
}

function renderWidgetModel(model) {
  const edits = [];
  const additions = [];
  if (model.skills) {
    const skillsChanged = JSON.stringify(model.skills.skills) !== JSON.stringify(model.skills.originalSkills);
    if (model.skills.range) {
      if (skillsChanged) edits.push({start:model.skills.range.start, end:model.skills.range.end, value:skillButtons(model.skills.skills)});
    } else if (model.skills.skills.length) additions.push(`<b>Skills:</b> ${skillButtons(model.skills.skills)}`);
  }
  for (const [kind, renderer] of [['buttons',renderedButton],['links',renderedLink],['images',renderedImage],['embeds',renderedEmbed]]) {
    for (const item of model[kind]) {
      if (item.isNew) { if (!item.removed) additions.push(renderer(item)); continue; }
      edits.push({start:item.range.start, end:item.range.end, value:item.removed ? '' : renderer(item)});
    }
  }
  for (const item of model.expanders) {
    if (item.label !== item.original.label) edits.push({start:item.summaryRange.start, end:item.summaryRange.end, value:`<b>${escapeHtml(item.label.trim())}</b>`});
    if (item.open !== item.original.open) {
      let tag = item.detailsTag.replace(/\s+open(?=\s|>)/i, '');
      if (item.open) tag = tag.replace(/>$/, ' open>');
      edits.push({start:item.detailsRange.start, end:item.detailsRange.end, value:tag});
    }
  }
  let body = model.sourceBody;
  for (const edit of edits.sort((a,b) => b.start - a.start)) body = body.slice(0, edit.start) + edit.value + body.slice(edit.end);
  if (additions.length) body = `${body.trimEnd()}\n\n${additions.join('\n\n')}\n`;
  return body;
}

function collectWidgetBody() {
  if (!state.widgetSession) return document.querySelector('#body-editor').value;
  captureWidgetInputs();
  return renderWidgetModel(state.widgetSession);
}

function wireRemoveFields() {
  document.querySelectorAll('#field-list .remove-field').forEach(button => button.onclick = () => button.closest('.field-row').remove());
}

function collectFrontMatter() {
  const result = {};
  document.querySelectorAll('.field-row').forEach(row => {
    const key = row.querySelector('.field-key').value.trim();
    const field = row.querySelector('.field-value');
    if (!key) return;
    let value = field.value;
    if (field.dataset.kind === 'boolean') value = value === 'true';
    else if (field.dataset.kind === 'number' && value !== '') value = Number(value);
    else if (field.dataset.kind === 'list') value = value.split(/\n|,/).map(item => item.trim()).filter(Boolean);
    else if (field.dataset.kind === 'object') {
      try { value = JSON.parse(value); } catch { throw new Error(`${titleCase(key)} must be valid structured data.`); }
    }
    result[key] = value;
  });
  captureFrontWidgetInputs();
  for (const [key, model] of Object.entries(state.frontWidgetSessions || {})) {
    if (Object.hasOwn(result, key)) result[key] = renderWidgetModel(model);
  }
  return result;
}

async function reviewDocument() {
  try {
    const frontMatter = collectFrontMatter();
    const body = state.editorTab === 'widgets' ? collectWidgetBody() : document.querySelector('#body-editor').value;
    document.querySelector('#body-editor').value = body;
    const documents = [{path: state.document.path, frontMatter, body, originalHash: state.document.hash}];
    if (!state.data.capabilities?.modernSkills && state.document.path.startsWith('_projects/')) {
      const currentSkills = findSkillSection(body, state.document.path)?.skills || [];
      const original = new Set((state.originalProjectSkills || []).map(skill => skill.toLowerCase()));
      const additions = currentSkills.filter(skill => !original.has(skill.toLowerCase()));
      if (additions.length) {
        const cloud = await api('/api/document?path=_pages%2Fprojects.md');
        const cloudSection = findSkillSection(cloud.body, cloud.path);
        if (!cloudSection?.range) throw new Error('The global skill cloud could not be found. Nothing was changed.');
        const known = new Set(cloudSection.skills.map(skill => skill.toLowerCase()));
        const missing = additions.filter(skill => !known.has(skill.toLowerCase()));
        const cloudBody = missing.length ? cloud.body.slice(0, cloudSection.range.end) + ` ${skillButtons(missing)}` + cloud.body.slice(cloudSection.range.end) : cloud.body;
        if (cloudBody !== cloud.body) documents.push({path:cloud.path, frontMatter:cloud.frontMatter, body:cloudBody, originalHash:cloud.hash});
      }
    }
    const endpoint = documents.length > 1 ? '/api/preview/documents' : '/api/preview/document';
    const payload = documents.length > 1 ? {documents} : documents[0];
    const preview = await api(endpoint, {method: 'POST', body: JSON.stringify(payload)});
    openReview(preview, `Updated ${frontMatter.title || state.document.path}`, 'save');
  } catch (error) { toast(error.message, 'error'); }
}

async function reviewDelete() {
  try {
    const preview = await api('/api/preview/delete', {method: 'POST', body: JSON.stringify({path: state.document.path, originalHash: state.document.hash})});
    openReview(preview, `Removed ${state.document.frontMatter.title || state.document.path}`, 'delete');
  } catch (error) { toast(error.message, 'error'); }
}

function switchEditorTab(tab) {
  if (state.editorTab === 'widgets' && tab !== 'widgets') document.querySelector('#body-editor').value = collectWidgetBody();
  if (tab === 'widgets' && state.editorTab !== 'widgets') {
    state.widgetSession = inspectWidgets(document.querySelector('#body-editor').value, state.document.path);
    document.querySelector('#widgets-tab').innerHTML = widgetsMarkup(state.widgetSession);
    wireWidgets();
    wireFrontWidgets();
  }
  state.editorTab = tab;
  document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  document.querySelector('#details-tab').classList.toggle('hidden', tab !== 'details');
  document.querySelector('#widgets-tab').classList.toggle('hidden', tab !== 'widgets');
  document.querySelector('#writing-tab').classList.toggle('hidden', tab !== 'writing');
  document.querySelector('#preview-tab').classList.toggle('hidden', tab !== 'preview');
  if (tab === 'preview') updatePreview();
}

function updatePreview() {
  const body = document.querySelector('#body-editor').value;
  const title = document.querySelector('.field-row .field-value')?.value || '';
  const directory = state.document.path.split('/').slice(0, -1).join('/');
  const base = `/site/${directory ? `${directory}/` : ''}`;
  const content = markdownPreview(body).replace(/\b(src|href)=(['"])\/(?!\/)/gi, '$1=$2/site/');
  document.querySelector('#preview-frame').srcdoc = `<!doctype html><base href="${escapeHtml(base)}"><style>body{font:17px/1.65 Georgia,serif;color:#26212c;max-width:760px;margin:34px auto;padding:0 24px}h1,h2,h3{font-family:system-ui,sans-serif;line-height:1.2;color:#2c174f}a{color:#4b2e83}img{max-width:100%;height:auto}button{padding:7px 11px;border:1px solid #ccc;background:#f6f4f8;border-radius:6px}iframe{max-width:100%;border:0}pre{overflow:auto;padding:14px;background:#f3f0f5}</style><h1>${escapeHtml(title)}</h1>${content}`;
}

function markdownPreview(markdown) {
  const preserved = [];
  let text = String(markdown).replace(/<[^>]+>/g, html => `@@HTML${preserved.push(html) - 1}@@`);
  text = escapeHtml(text)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^(?:- |\* )(.+)$/gm, '<li>$1</li>').replace(/(?:<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`)
    .split(/\n{2,}/).map(block => /^<(h\d|ul|ol|div|details|br|p)/.test(block) ? block : `<p>${block.replace(/\n/g, '<br>')}</p>`).join('\n');
  return text.replace(/@@HTML(\d+)@@/g, (_, index) => preserved[Number(index)] || '');
}

function formatBody(kind) {
  const field = document.querySelector('#body-editor');
  const start = field.selectionStart, end = field.selectionEnd, selected = field.value.slice(start, end) || ({bold:'bold text',italic:'emphasis',heading:'Section title',link:'link text',list:'list item'}[kind]);
  const wrappers = {bold: [`**`, `**`], italic: ['*','*'], heading: ['## ', ''], link: ['[', '](https://example.com)'], list: ['- ', '']};
  const [before, after] = wrappers[kind];
  field.setRangeText(before + selected + after, start, end, 'select');
  field.focus();
}

async function renderSkills() {
  main.innerHTML = pageHead('Website', 'Skills, languages & degrees', 'Edit the grouped skill cloud. Project tags stay independent; each list uses one item per line.') + '<p role="status">Loading skills…</p>';
  try {
    const snapshot = await api('/api/skills');
    if (state.route !== 'skills') return;
    const value = snapshot.value;
    main.innerHTML = pageHead('Website', 'Skills, languages & degrees', 'Edit the grouped skill cloud. Project tags stay independent; each list uses one item per line.') + `<form id="skills-form" class="settings-card"><div id="skill-groups"></div><button type="button" class="quiet-button" id="add-skill-group">Add group</button><div class="form-grid two-column">${['languages','degrees'].map(key => `<label>${titleCase(key)}<textarea data-skill-list="${key}" rows="5">${escapeHtml((value[key] || []).join('\n'))}</textarea></label>`).join('')}</div><p id="skills-error" role="alert"></p><div class="form-actions"><button class="primary-button" type="submit">Review skills</button></div></form>`;
    const originals = [];
    const addGroup = group => {
      const id = originals.push(group) - 1;
      document.querySelector('#skill-groups').insertAdjacentHTML('beforeend', `<section class="widget-section" data-skill-group="${id}"><label>Group name<input class="skill-group-name" required value="${escapeHtml(group.name)}"></label><label>Skills (one per line)<textarea class="skill-group-values" rows="6">${escapeHtml(group.skills.join('\n'))}</textarea></label><button type="button" class="danger-button" data-remove-group>Remove group</button></section>`);
      document.querySelectorAll('[data-remove-group]').forEach(button => button.onclick = () => button.closest('[data-skill-group]').remove());
    };
    value.groups.forEach(addGroup);
    document.querySelector('#add-skill-group').onclick = () => addGroup({name:'',skills:[]});
    const lines = text => text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    document.querySelector('#skills-form').onsubmit = async event => {
      event.preventDefault();
      const next = {...value, groups:[...document.querySelectorAll('[data-skill-group]')].map(row => ({...originals[Number(row.dataset.skillGroup)], name:row.querySelector('.skill-group-name').value.trim(), skills:lines(row.querySelector('.skill-group-values').value)}))};
      document.querySelectorAll('[data-skill-list]').forEach(input => { next[input.dataset.skillList] = lines(input.value); });
      try {
        const preview = await api('/api/preview/skills', {method:'POST',body:JSON.stringify({value:next,originalHash:snapshot.hash})});
        document.querySelector('#skills-error').textContent = '';
        openReview(preview, 'Updated skills, languages and degrees', 'skills');
      } catch (error) { document.querySelector('#skills-error').textContent = error.message; }
    };
  } catch (error) {
    if (state.route !== 'skills') return;
    main.innerHTML = `<h1>Skills could not open</h1><p role="alert">${escapeHtml(error.message)}</p><button class="quiet-button" id="retry-skills">Try again</button>`;
    document.querySelector('#retry-skills').onclick = renderSkills;
  }
}

function renderProfile() {
  main.innerHTML = `${pageHead('Website identity', 'Profile & settings', 'Update the details shown across your portfolio. Existing comments and advanced configuration remain intact.')}
    <div class="settings-layout"><nav class="settings-index"><button class="active" data-settings-tab="identity">Identity</button><button data-settings-tab="headshot">Headshot</button><button data-settings-tab="links">Profile links</button><button data-settings-tab="site">Website</button></nav><div id="settings-content" class="settings-card"><div class="loading-state" style="min-height:260px"><div class="spinner"></div></div></div></div>`;
  main.querySelectorAll('[data-settings-tab]').forEach(button => button.addEventListener('click', () => { main.querySelectorAll('[data-settings-tab]').forEach(item => item.classList.toggle('active', item === button)); renderSettingsForm(button.dataset.settingsTab); }));
  loadConfig();
}

async function loadConfig() {
  try { state.config = await api('/api/config'); renderSettingsForm('identity'); }
  catch (error) { toast(error.message, 'error'); }
}

const settingGroups = {
  identity: [['title','Portfolio title'], ['description','Search description'], ['author.name','Full name'], ['author.pronouns','Pronouns'], ['author.bio','Short biography'], ['author.location','Location'], ['author.employer','Organization']],
  site: [['url','Public website address'], ['baseurl','Website subpath'], ['repository','GitHub repository'], ['locale','Language and region'], ['timezone','Time zone'], ['words_per_minute','Reading speed'], ['future','Show future-dated posts'], ['breadcrumbs','Show breadcrumbs'], ['talkmap_link','Show talk map link']]
};

const linkGroups = {
  'Contact': [['author.uri','Personal website'], ['author.email','Email address']],
  'Academic profiles': [['author.arxiv','arXiv'], ['author.googlescholar','Google Scholar'], ['author.impactstory','Impactstory'], ['author.orcid','ORCID'], ['author.semantic','Semantic Scholar'], ['author.pubmed','PubMed'], ['author.researchgate','ResearchGate']],
  'Code & creative profiles': [['author.bitbucket','Bitbucket'], ['author.codepen','CodePen'], ['author.dribbble','Dribbble'], ['author.github','GitHub'], ['author.kaggle','Kaggle'], ['author.stackoverflow','Stack Overflow']],
  'Social profiles': [['author.bluesky','Bluesky'], ['author.facebook','Facebook'], ['author.flickr','Flickr'], ['author.foursquare','Foursquare'], ['author.goodreads','Goodreads'], ['author.google_plus','Google+'], ['author.keybase','Keybase'], ['author.instagram','Instagram'], ['author.lastfm','Last.fm'], ['author.linkedin','LinkedIn'], ['author.mastodon','Mastodon'], ['author.medium','Medium'], ['author.pinterest','Pinterest'], ['author.soundcloud','SoundCloud'], ['author.steam','Steam'], ['author.telegram','Telegram'], ['author.tumblr','Tumblr'], ['author.twitter','X / Twitter'], ['author.vine','Vine'], ['author.weibo','Weibo'], ['author.wikipedia','Wikipedia'], ['author.xing','Xing'], ['author.youtube','YouTube'], ['author.zhihu','Zhihu']]
};

function deepGet(object, path) { return path.split('.').reduce((value, key) => value?.[key], object); }

function renderSettingsForm(group) {
  if (!state.config) return;
  if (group === 'headshot') return renderHeadshotForm();
  if (group === 'links') return renderLinksForm();
  const fields = settingGroups[group];
  document.querySelector('#settings-content').innerHTML = `<h2>${titleCase(group)}</h2><form id="settings-form" class="form-grid">
    ${fields.map(([path,label]) => settingField(path, label, deepGet(state.config.value, path))).join('')}
    <div class="form-actions"><button type="submit" class="primary-button">Review settings</button></div></form>`;
  wireSettingsReview(group);
}

function wireSettingsReview(group) {
  document.querySelector('#settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    const updates = {};
    event.currentTarget.querySelectorAll('[data-setting]').forEach(input => { updates[input.dataset.setting] = input.type === 'checkbox' ? input.checked : (input.dataset.type === 'number' ? Number(input.value) : input.value); });
    try {
      const preview = await api('/api/preview/settings', {method:'POST', body: JSON.stringify({updates, originalHash: state.config.hash})});
      openReview(preview, `Updated ${group} settings`, 'settings');
    } catch (error) { toast(error.message, 'error'); }
  });
}

function renderLinksForm() {
  document.querySelector('#settings-content').innerHTML = `<div class="settings-card-head"><div><h2>Links below your headshot</h2><p>Add, update, or clear any profile link. Empty links stay hidden on the public site.</p></div></div><form id="settings-form" class="form-grid profile-links">
    ${Object.entries(linkGroups).map(([heading, fields]) => `<fieldset><legend>${escapeHtml(heading)}</legend>${fields.map(([path,label]) => settingField(path, label, deepGet(state.config.value, path))).join('')}</fieldset>`).join('')}
    <div class="form-actions"><button type="submit" class="primary-button">Review profile links</button></div></form>`;
  wireSettingsReview('profile links');
}

function headshotSource(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const clean = String(value).replace(/^\/?images\//, '');
  return `/asset?path=${encodeURIComponent(`images/${clean}`)}&token=${encodeURIComponent(state.token)}`;
}

function renderHeadshotForm() {
  if (state.data.capabilities?.templateContent) {
    document.querySelector('#settings-content').innerHTML = '<h2>Homepage portraits</h2><p>The redesigned homepage uses a still image, animated image, and video in its template. The old avatar setting does not control these portraits.</p><p>Upload replacement files in Media, then edit the image and video paths under Homepage, hero &amp; portraits.</p><button class="primary-button" id="edit-portraits">Edit homepage portraits</button>';
    if (state.data.capabilities?.homepageData) document.querySelector('#settings-content').innerHTML = '<h2>Homepage portraits</h2><p>This template stores still-image, animated-image, video, and alternative-text settings under portrait in the homepage configuration.</p><p>Upload replacement files in Media, then update those paths.</p><button class="primary-button" id="edit-portraits">Edit homepage configuration</button>';
    document.querySelector('#edit-portraits').onclick = async () => { navigate('sitecopy'); await openDocument(state.data.capabilities?.homepageData ? '_data/portfolio.yml' : '_layouts/portfolio-home.html'); };
    return;
  }
  const current = deepGet(state.config.value, 'author.avatar') || '';
  const options = (state.data?.assets || []).filter(asset => asset.kind === 'image' && asset.path.startsWith('images/')).map(asset => asset.path.slice(7));
  if (current && !options.includes(current)) options.unshift(current);
  document.querySelector('#settings-content').innerHTML = `<h2>Headshot</h2><p class="settings-copy">Choose an image already in your media library or upload a new one. The public site uses it beside your name, biography, and profile links.</p>
    <form id="settings-form" class="headshot-form"><div class="headshot-preview" id="headshot-preview">${current ? `<img src="${escapeHtml(headshotSource(current))}" alt="Current profile headshot">` : '<span>No headshot selected</span>'}</div><div class="form-grid">
      <label><span>Profile image</span><select id="headshot-choice" data-setting="author.avatar">${options.map(name => `<option value="${escapeHtml(name)}" ${name === current ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>
      <label><span>Upload a new headshot</span><input id="headshot-upload" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"><small class="field-note">Uploading adds the file to your media library. Select Review headshot to publish it as your profile image.</small></label>
      <div class="form-actions"><button type="submit" class="primary-button">Review headshot</button></div>
    </div></form>`;
  const select = document.querySelector('#headshot-choice');
  select.addEventListener('change', () => { document.querySelector('#headshot-preview').innerHTML = select.value ? `<img src="${escapeHtml(headshotSource(select.value))}" alt="Selected profile headshot">` : '<span>No headshot selected</span>'; });
  document.querySelector('#headshot-upload').addEventListener('change', uploadHeadshot);
  wireSettingsReview('headshot');
}

async function uploadHeadshot(event) {
  const file = event.currentTarget.files[0];
  if (!file) return;
  try {
    const content = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    const result = await api('/api/assets/upload', {method:'POST', body:JSON.stringify({folder:'images', filename:file.name, content})});
    state.data.assets.push({path:result.path, name:file.name, folder:'images', size:file.size, kind:'image'});
    const select = document.querySelector('#headshot-choice');
    select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(file.name)}">${escapeHtml(file.name)}</option>`);
    select.value = file.name;
    select.dispatchEvent(new Event('change'));
    toast('Headshot added to Media. Review the headshot to use it on your site.');
  } catch (error) { toast(error.message, 'error'); }
}

function settingField(path, label, value) {
  if (typeof value === 'boolean') return `<label class="toggle-field"><span>${escapeHtml(label)}</span><input type="checkbox" data-setting="${path}" ${value ? 'checked' : ''}></label>`;
  const long = ['description','author.bio'].includes(path);
  return `<label><span>${escapeHtml(label)}</span>${long ? `<textarea rows="3" data-setting="${path}">${escapeHtml(value ?? '')}</textarea>` : `<input data-setting="${path}" data-type="${typeof value}" value="${escapeHtml(value ?? '')}">`}</label>`;
}

async function renderNavigation() {
  main.innerHTML = `${pageHead('Site structure', 'Navigation', 'Reorder, rename, add, or remove the links in your website’s main menu.')}
    <section class="panel" style="max-width:820px"><div class="panel-head"><h2>Main menu</h2><button class="quiet-button" id="add-nav">Add link</button></div><form class="panel-body" id="nav-form"><div id="nav-rows" class="form-grid"></div><div class="form-actions"><button class="primary-button" type="submit">Review navigation</button></div></form></section>`;
  try {
    state.navigation = await api('/api/navigation');
    const items = state.navigation.value.main || [];
    state.navEntries = [];
    document.querySelector('#nav-rows').innerHTML = items.map(navRow).join('');
    wireNavRows();
    document.querySelector('#add-nav').addEventListener('click', () => { document.querySelector('#nav-rows').insertAdjacentHTML('beforeend', navRow({title:'',url:''})); wireNavRows(); });
    document.querySelector('#nav-form').addEventListener('submit', reviewNavigation);
  } catch (error) { toast(error.message, 'error'); }
}

function navRow(item) {
  const id = state.navEntries.push({...item}) - 1;
  return `<div class="nav-row widget-section" data-nav-id="${id}"><div class="form-grid two-column"><label>Menu label<input class="nav-title" value="${escapeHtml(item.title || '')}"></label><label>Page address<input class="nav-url" value="${escapeHtml(item.url || '')}"></label><label>Homepage section<input class="nav-section" value="${escapeHtml(item.section || '')}"></label><label>Style<input class="nav-style" value="${escapeHtml(item.style || '')}" placeholder="button or leave empty"></label><label class="compact-toggle"><input type="checkbox" class="nav-divider" ${item.divider ? 'checked' : ''}> Divider</label></div><div class="form-actions"><button type="button" class="quiet-button" data-nav-up>Move up</button><button type="button" class="danger-button" data-nav-remove>Remove</button></div></div>`;
}
function wireNavRows() {
  document.querySelectorAll('[data-nav-remove]').forEach(button => button.onclick = () => button.closest('.nav-row').remove());
  document.querySelectorAll('[data-nav-up]').forEach(button => button.onclick = () => { const row = button.closest('.nav-row'); if (row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling); });
}
async function reviewNavigation(event) {
  event.preventDefault();
  const items = [...document.querySelectorAll('.nav-row')].map(row => {
    const item = {...state.navEntries[Number(row.dataset.navId)]};
    for (const key of ['title','url','section','style']) {
      const value = row.querySelector(`.nav-${key}`).value.trim();
      if (value) item[key] = value; else delete item[key];
    }
    if (row.querySelector('.nav-divider').checked) item.divider = true; else delete item.divider;
    return item;
  });
  try {
    const preview = await api('/api/preview/navigation', {method:'POST', body: JSON.stringify({items, originalHash: state.navigation.hash})});
    openReview(preview, 'Updated main navigation', 'navigation');
  } catch (error) { toast(error.message, 'error'); }
}

function renderMedia() {
  const token = encodeURIComponent(state.token);
  main.innerHTML = `${pageHead('Asset library', 'Media', 'Add and browse the images and downloads available to your pages.')}
    <form class="upload-box" id="upload-form"><label><span>Add an image or download</span><input id="asset-file" type="file" required></label><div class="form-actions" style="justify-content:center"><select id="asset-folder" style="max-width:150px"><option value="images">Images</option><option value="files">Downloads</option></select><button class="primary-button" type="submit">Add file</button></div></form>
    <div class="media-grid">${state.data.assets.map(asset => `<article class="media-card"><div class="media-preview">${asset.kind === 'image' ? `<img src="/asset?path=${encodeURIComponent(asset.path)}&token=${token}" alt="">` : '<span>Download</span>'}</div><div class="media-info"><strong title="${escapeHtml(asset.path)}">${escapeHtml(asset.name)}</strong><span>${escapeHtml(asset.folder)} · ${formatBytes(asset.size)}</span></div></article>`).join('')}</div>`;
  document.querySelector('#upload-form').addEventListener('submit', uploadAsset);
}

async function uploadAsset(event) {
  event.preventDefault();
  const file = document.querySelector('#asset-file').files[0];
  if (!file) return;
  try {
    const content = await fileToBase64(file);
    await api('/api/assets/upload', {method:'POST', body: JSON.stringify({folder: document.querySelector('#asset-folder').value, filename: file.name, content})});
    toast(`${file.name} was added. You can restore this from Change history.`);
    await loadStudio({preserveRoute:true});
  } catch (error) { toast(error.message, 'error'); }
}
function fileToBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); }); }

function renderHistory() {
  const entries = state.data.history;
  main.innerHTML = `${pageHead('Safety journal', 'Change history', 'Every confirmed Studio edit keeps the exact previous version outside your website folder.')}
    ${entries.length ? `<div style="overflow:auto"><table class="history-table"><thead><tr><th>Change</th><th>File</th><th>When</th><th></th></tr></thead><tbody>${entries.map(entry => `<tr><td><strong>${escapeHtml(entry.label)}</strong><div class="row-meta">${escapeHtml(entry.action)}</div></td><td class="history-path">${escapeHtml(entry.path)}</td><td>${escapeHtml(formatDate(entry.timestamp))}</td><td>${entry.action !== 'revert' ? `<button class="quiet-button" data-revert="${escapeHtml(entry.id)}">Restore</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><div><h2>No changes yet</h2><p>Confirmed edits will be listed here.</p></div></div>'}`;
  main.querySelectorAll('[data-revert]').forEach(button => button.addEventListener('click', () => revertChange(button.dataset.revert)));
}

async function revertChange(changeId) {
  if (!confirm('Restore the file to the exact version from before this change?')) return;
  try { await api('/api/revert', {method:'POST', body:JSON.stringify({changeId})}); toast('The earlier version was restored.'); await loadStudio({preserveRoute:true}); }
  catch (error) { toast(error.message, 'error'); }
}

function renderHealth() {
  const issues = state.data.issues;
  main.innerHTML = `${pageHead('Pre-publish checks', 'Site health', 'Structural checks help catch duplicate page addresses and missing local files before they surprise visitors.')}
    <div class="health-summary ${issues.length ? '' : 'good'}"><strong>${issues.length ? `${issues.length} item${issues.length === 1 ? '' : 's'} to review` : 'No structural issues found'}</strong><div class="row-meta">These checks do not change your website.</div></div>
    <section class="panel"><div class="panel-body">${issues.length ? `<ul class="issue-list">${issues.map(issueRow).join('')}</ul>` : '<p>Your content addresses and local file references look consistent.</p>'}</div></section>`;
}

function openCreate(group = 'projects') {
  if (state.data.groups.find(item => item.key === group)?.fixed) group = 'projects';
  const select = document.querySelector('#create-group');
  select.innerHTML = state.data.groups.filter(item => !item.fixed).map(item => `<option value="${item.key}" ${item.key === group ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
  document.querySelector('#create-form').reset();
  select.value = group;
  createDialog.showModal();
}

async function reviewCreate(event) {
  event.preventDefault();
  const group = document.querySelector('#create-group').value;
  const title = document.querySelector('#create-title').value.trim();
  const frontMatter = {title};
  const permalink = document.querySelector('#create-permalink').value.trim();
  if (permalink) frontMatter.permalink = permalink;
  if (!['pages','posts','drafts'].includes(group)) frontMatter.collection = group;
  try {
    const preview = await api('/api/preview/create', {method:'POST', body:JSON.stringify({group, filename:document.querySelector('#create-filename').value, frontMatter, body:document.querySelector('#create-body').value})});
    createDialog.close();
    openReview(preview, `Created ${title}`, 'create');
  } catch (error) { toast(error.message, 'error'); }
}

function openReview(preview, label, action) {
  state.pendingPreview = preview;
  state.pendingAction = {label, action};
  document.querySelector('#review-summary').innerHTML = preview.changed ? `<strong>${escapeHtml(label)}</strong><br><span class="row-meta">Only ${escapeHtml(preview.path)} will change.</span>` : '<strong>Nothing changed.</strong>';
  document.querySelector('#diff-view').textContent = preview.diff || 'No difference to save.';
  document.querySelector('#confirm-save').disabled = !preview.changed;
  document.querySelector('#confirm-save').textContent = action === 'delete' ? 'Remove entry' : 'Confirm save';
  reviewDialog.showModal();
}

async function applyPending() {
  if (!state.pendingPreview?.changed) return;
  const endpoint = state.pendingAction.action === 'delete' ? '/api/apply/delete' : '/api/apply';
  const action = state.pendingAction.action;
  const savedPath = state.pendingPreview.batch?.[0]?.path || state.pendingPreview.path;
  document.querySelector('#confirm-save').disabled = true;
  try {
    await api(endpoint, {method:'POST', body:JSON.stringify({preview:state.pendingPreview, label:state.pendingAction.label})});
    toast(action === 'delete' ? 'The entry was removed. You can restore it from Change history.' : 'Saved. The previous version is available in Change history.');
    state.document = null;
    state.activePath = action === 'delete' ? null : savedPath;
    await loadStudio({preserveRoute:true});
    if (action !== 'delete' && state.data.groups.some(group => group.key === state.route)) await openDocument(savedPath);
    if (action === 'settings') await loadConfig();
    reviewDialog.close();
  } catch (error) { toast(error.message, 'error'); }
  finally { document.querySelector('#confirm-save').disabled = false; }
}

document.querySelector('#refresh-button').addEventListener('click', async () => { await loadStudio({preserveRoute:true}); toast('Portfolio Studio refreshed.'); });
document.querySelector('#new-button').addEventListener('click', () => openCreate(state.data?.groups.some(group => group.key === state.route) ? state.route : 'projects'));
document.querySelector('#menu-button').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
document.querySelector('#cancel-review').addEventListener('click', () => reviewDialog.close());
document.querySelector('#confirm-save').addEventListener('click', applyPending);
document.querySelector('#create-form').addEventListener('submit', reviewCreate);
document.querySelectorAll('[data-close-create]').forEach(button => button.addEventListener('click', () => createDialog.close()));
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && state.document && !reviewDialog.open) { event.preventDefault(); reviewDocument(); }
  if (event.key === 'Escape') document.querySelector('#sidebar').classList.remove('open');
});

function registerWebMcp() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const registration = context.registerTool({
    name: 'stage_portfolio_entry_update',
    title: 'Review a portfolio entry update',
    description: 'Stage proposed title, content, or front-matter detail changes for an existing portfolio entry and open the same exact-difference review used by the visible interface. This does not save; the person must confirm the review.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {type: 'string', description: 'Repository-relative content path, such as _projects/example.md.'},
        title: {type: 'string', description: 'Optional replacement public title.'},
        body: {type: 'string', description: 'Optional replacement page content.'},
        details: {type: 'object', description: 'Optional front-matter fields to add or replace.', additionalProperties: true}
      },
      required: ['path'],
      additionalProperties: false
    },
    annotations: {readOnlyHint: false, untrustedContentHint: false},
    async execute(input) {
      if (!input || typeof input.path !== 'string' || !input.path.trim()) throw new Error('A portfolio entry path is required.');
      if (input.details !== undefined && (!input.details || Array.isArray(input.details) || typeof input.details !== 'object')) throw new Error('Details must be a key/value object.');
      if (!state.data) await loadStudio();
      if (!state.data) throw new Error('Portfolio Studio is not connected to the website folder.');
      const doc = await api(`/api/document?path=${encodeURIComponent(input.path)}`);
      const frontMatter = {...doc.frontMatter, ...(input.details || {})};
      if (input.title !== undefined) frontMatter.title = String(input.title);
      const body = input.body === undefined ? doc.body : String(input.body);
      const preview = await api('/api/preview/document', {method:'POST', body:JSON.stringify({path:doc.path, frontMatter, body, originalHash:doc.hash})});
      const group = state.data.groups.find(item => item.items.some(entry => entry.path === doc.path));
      if (group) {
        state.route = group.key;
        state.activePath = doc.path;
        state.document = doc;
        renderNav();
        render();
      }
      openReview(preview, `Updated ${frontMatter.title || doc.path}`, 'save');
      return {status: preview.changed ? 'awaiting_confirmation' : 'no_change', path: doc.path, changed: preview.changed};
    }
  });
  Promise.resolve(registration).catch(error => toast(`Automation interface unavailable: ${error.message}`, 'error'));
}

registerWebMcp();
loadStudio();
