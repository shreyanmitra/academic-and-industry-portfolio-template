---
layout: portfolio-detail
title: "Data-driven CV"
permalink: /cv-json/
section: about
---
{% assign cv = site.data.cv %}
<h2>{{ cv.basics.name | escape }}</h2><p>{{ cv.basics.label | escape }}</p><div class="prose">{{ cv.basics.summary | markdownify }}</div>
{% assign groups = 'work,education,publications,awards,volunteer,skills,languages,interests,references' | split: ',' %}
{% for group in groups %}{% if cv[group].size > 0 %}<h2>{{ group | capitalize }}</h2><ul>{% for item in cv[group] %}<li><strong>{{ item.position | default: item.studyType | default: item.name | default: item.language | default: item.title | escape }}</strong>{% if item.institution %} · {{ item.institution | escape }}{% elsif item.name and item.position %} · {{ item.name | escape }}{% endif %}{% if item.area %} · {{ item.area | escape }}{% endif %}{% if item.startDate %} · {{ item.startDate | escape }}–{{ item.endDate | default: 'Present' | escape }}{% endif %}{% if item.summary %}<p>{{ item.summary | escape }}</p>{% endif %}{% if item.keywords.size > 0 %}<p>{{ item.keywords | join: ', ' | escape }}</p>{% endif %}{% if item.url %}<a href="{% include portfolio-resource-url.html url=item.url %}">More information</a>{% endif %}</li>{% endfor %}</ul>{% endif %}{% endfor %}
