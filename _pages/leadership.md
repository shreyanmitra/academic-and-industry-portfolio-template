---
layout: portfolio-archive
title: "Leadership & Awards"
permalink: /leadership/
section: leadership
display_title: "Service &amp; <em>Community</em>"
subtitle: "Fictional examples — replace with your own entries."
---
<section class="container archive-content">
{% assign categories = site.leadership | map: 'portfolio_category' | compact | uniq | sort %}
{% if site.leadership.size == 0 %}{% include portfolio-empty.html %}{% endif %}
{% for category in categories %}<h2 class="group-label">{{ category | escape }}</h2>{% assign entries = site.leadership | where: 'portfolio_category', category | sort: 'date' | reverse %}{% for item in entries %}{% include portfolio-row.html item=item full=true %}{% endfor %}{% endfor %}
{% assign entries = site.leadership | sort: 'date' | reverse %}{% for item in entries %}{% unless item.portfolio_category %}{% include portfolio-row.html item=item full=true %}{% endunless %}{% endfor %}
{% include portfolio-awards.html %}
</section>
