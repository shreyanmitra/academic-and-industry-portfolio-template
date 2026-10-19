(() => {
  'use strict';
  const settings = JSON.parse(document.getElementById('academic-feature-settings')?.textContent || '{}') || {};
  const body = document.querySelector('main') || document.querySelector('#main') || document.body;
  const load = url => new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = url; script.onload = resolve; script.onerror = reject; document.head.append(script);
  });
  const report = (node, label) => {
    const note = document.createElement('p');note.className='academic-feature-error';note.setAttribute('role','status');
    note.textContent = `${label} could not load. The source remains available below.`;node.before(note);
  };
  const legacyMath = [...body.querySelectorAll('script[type^="math/tex"]')];
  legacyMath.forEach(source => {
    const target = document.createElement(source.type.includes('display') ? 'div' : 'span');target.className='math';
    target.textContent = (source.type.includes('display') ? '\\[' : '\\(') + source.textContent + (source.type.includes('display') ? '\\]' : '\\)');source.replaceWith(target);
  });
  if (settings.mathjax !== false && (body.querySelector('.language-math, .math') || /\\\(|\\\[|\$\$/.test(body.textContent))) {
    window.MathJax = {tex:{inlineMath:[['\\(','\\)'],['$','$']]},options:{skipHtmlTags:['script','noscript','style','textarea','pre','code']}};
    load('https://cdn.jsdelivr.net/npm/mathjax@4.0.0/tex-mml-chtml.js').catch(() => report(body,'Mathematics'));
  }
  const diagrams = [...body.querySelectorAll('code.language-mermaid')];
  diagrams.forEach(code => { code.classList.remove('language-mermaid'); code.classList.add('mermaid-source'); });
  if (settings.mermaid !== false && diagrams.length) {
    load('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js').then(async () => {
      mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default'});
      for (const code of diagrams) {
        try {
          const target = document.createElement('div');target.className='mermaid';target.textContent=code.textContent;
          code.parentElement.after(target);await mermaid.run({nodes:[target]});code.parentElement.hidden=true;
        } catch { report(code.parentElement,'Diagram'); }
      }
    }).catch(() => diagrams.forEach(code => report(code.parentElement,'Diagram')));
  }
  const plots = [...body.querySelectorAll('code.language-plotly')];
  plots.forEach(code => { code.classList.remove('language-plotly'); code.classList.add('plotly-source'); });
  if (settings.plotly !== false && plots.length) {
    load('https://cdn.jsdelivr.net/npm/plotly.js-dist-min@3.6.0/plotly.min.js').then(async () => {
      const rendered = [];
      const themedLayout = layout => {
        const dark = document.documentElement.dataset.theme === 'dark';
        return {paper_bgcolor: dark ? '#101827' : '#ffffff', plot_bgcolor: dark ? '#101827' : '#ffffff',
          ...layout, font: {color: dark ? '#e5eaf3' : '#172235', ...(layout.font || {})}};
      };
      for (const code of plots) {
        try {
          const spec = JSON.parse(code.textContent);
          const target=document.createElement('div');target.className='academic-chart';target.setAttribute('role','img');target.setAttribute('aria-label',spec.layout?.title?.text || 'Interactive chart');
          code.parentElement.after(target);await Plotly.newPlot(target,spec.data,themedLayout(spec.layout || {}),{responsive:true,displaylogo:false});rendered.push({target,layout:spec.layout || {}});code.parentElement.hidden=true;
        } catch { report(code.parentElement,'Chart'); }
      }
      new MutationObserver(() => {
        rendered.forEach(({target,layout}) => Plotly.relayout(target,themedLayout(layout)));
      }).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    }).catch(() => plots.forEach(code => report(code.parentElement,'Chart')));
  }
})();
