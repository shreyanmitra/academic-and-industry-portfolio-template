---
layout: portfolio-archive
title: "Experience"
permalink: /experience/
section: experience
display_title: "Roles &amp; <em>Experience</em>"
subtitle: "Fictional examples — replace with your own entries."
---
<section class="container archive-content">
{% assign categories = site.experience | map: 'portfolio_category' | compact | uniq | sort %}
{% if site.experience.size == 0 %}{% include portfolio-empty.html %}{% endif %}
{% for category in categories %}<h2 class="group-label">{{ category | escape }}</h2>{% assign entries = site.experience | where: 'portfolio_category', category | sort: 'date' | reverse %}{% for item in entries %}{% include portfolio-row.html item=item full=true %}{% endfor %}{% endfor %}
{% assign entries = site.experience | sort: 'date' | reverse %}{% for item in entries %}{% unless item.portfolio_category %}{% include portfolio-row.html item=item full=true %}{% endunless %}{% endfor %}

</section>
