---
layout: portfolio-detail
title: "Writing and visualization guide"
permalink: /markdown/
redirect_from: [/md/, /markdown.html]
---
This page exercises the restored academic writing features. MathJax, Mermaid, and Plotly load on pages that use them. Their source remains readable when JavaScript is disabled.

## Mathematics

$$
E = mc^2
$$

## Mermaid diagrams

```mermaid
flowchart LR
  Question --> Experiment
  Experiment --> Evidence
```

## Plotly charts

```plotly
{"data":[{"x":[1,2,3],"y":[1,4,9],"type":"scatter","mode":"lines+markers"}],"layout":{"title":{"text":"Example results"}}}
```

## More inherited features

- [Blog posts]({{ '/year-archive/' | relative_url }}) and [categories]({{ '/categories/' | relative_url }}).
- [Generated CV]({{ '/cv/' | relative_url }}) and [JSON CV]({{ '/cv-json/' | relative_url }}).
- [Classic portfolio]({{ '/portfolio/' | relative_url }}) and [classic layout example]({{ '/classic/' | relative_url }}).

Use `layout: single`, `archive`, `talk`, or `splash` to select inherited layouts. Gallery, feature-row, table-of-contents, sidebar, and pagination helpers remain available.
