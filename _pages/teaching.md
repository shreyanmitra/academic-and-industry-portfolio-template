---
layout: portfolio-archive
title: "Teaching"
permalink: /teaching/
section: teaching
display_title: "Courses &amp; <em>Mentorship</em>"
subtitle: "Fictional examples — replace with your own entries."
---
<section class="container archive-content">
{% assign categories = site.teaching | map: 'portfolio_category' | compact | uniq | sort %}
{% if site.teaching.size == 0 %}{% include portfolio-empty.html %}{% endif %}
{% for category in categories %}<h2 class="group-label">{{ category | escape }}</h2>{% assign entries = site.teaching | where: 'portfolio_category', category | sort: 'date' | reverse %}{% for item in entries %}{% include portfolio-row.html item=item full=true %}{% endfor %}{% endfor %}
{% assign entries = site.teaching | sort: 'date' | reverse %}{% for item in entries %}{% unless item.portfolio_category %}{% include portfolio-row.html item=item full=true %}{% endunless %}{% endfor %}

</section>
