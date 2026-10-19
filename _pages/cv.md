---
layout: portfolio-detail
title: "CV / Résumé"
permalink: /resume/
section: about
kicker: "Curriculum vitae"
---
{% if site.data.portfolio.cv_url and site.data.portfolio.cv_url != '' %}
<p><a class="button" href="{% include portfolio-resource-url.html url=site.data.portfolio.cv_url %}">Download CV / Résumé</a></p>
{% else %}
Add your résumé to `files/`, then set `cv_url` in `_data/portfolio.yml` to its site-root path, for example `/files/cv.pdf`.

You can also write a text version of your CV on this page.
{% endif %}

<p><a href="{{ '/cv/' | relative_url }}">View generated CV</a> · <a href="{{ '/cv-json/' | relative_url }}">View JSON CV</a></p>
