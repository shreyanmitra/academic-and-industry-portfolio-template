# frozen_string_literal: true
# Check local links, anchors, media, headings and metadata after a Jekyll build.
require 'nokogiri'
require 'uri'
require 'pathname'
require 'yaml'
require 'date'
require 'json'

output = File.expand_path(ARGV[0] || '_site')
base = (ARGV[1] || '').sub(%r{/$}, '')
config = YAML.safe_load(File.read(File.expand_path('../_config.yml', __dir__)))
origin = (ARGV[2] || config.fetch('url')).sub(%r{/$}, '')
failures = []
checks = 0
check = ->(condition, message) { checks += 1; failures << message unless condition }
resolve = lambda do |path|
  decoded = URI::DEFAULT_PARSER.unescape(path)
  if !base.empty?
    next nil unless decoded == base || decoded.start_with?(base + '/')
    decoded = decoded.delete_prefix(base)
  end
  candidate = File.expand_path(decoded.delete_prefix('/'), output)
  next nil unless candidate == output || candidate.start_with?(output + File::SEPARATOR)
  [candidate, File.join(candidate, 'index.html'), candidate + '.html'].find { |file| File.file?(file) }
end
html_files = File.directory?(output) ? Dir.chdir(output) { Dir.glob('**/*.html') } : []
check.call(!html_files.empty?, 'No built HTML files found')
html_files.each do |relative|
  relative = relative.tr('\\', '/')
  file = File.join(output, relative)
  route = base + '/' + relative.sub(%r{index\.html$}, '')
  text = File.read(file, encoding: 'UTF-8')
  doc = Nokogiri::HTML(text)
  check.call(!text.match?(/\{%|\{\{/), "Unrendered Liquid in #{relative}")
  unless doc.at_css('meta[http-equiv="refresh"]')
    check.call(doc.css('h1').length == 1, "Expected one h1 in #{relative}")
    check.call(!doc.at_css('title')&.text.to_s.strip.empty?, "Missing title: #{relative}")
    check.call(!doc.at_css('meta[name="description"]')&.[]('content').to_s.empty?, "Missing description: #{relative}")
    canonical = doc.at_css('link[rel="canonical"]')&.[]('href').to_s
    check.call(canonical.start_with?(origin + base + '/'), "Incorrect canonical base: #{relative}: #{canonical}")
    doc.css('img').each { |node| check.call(node.key?('alt'), "Missing image alt: #{relative}") }
  end
  doc.css('[href], [src], [data-src], object[data]').each do |node|
    attribute = %w[href src data-src data].find { |key| node.key?(key) }
    ref = node[attribute].to_s
    check.call(!ref.empty?, "Empty #{attribute}: #{relative}")
    next if ref.empty?
    next if ref.match?(%r{\A(?:[a-z][a-z0-9+.-]*:|//)}i) && !ref.start_with?(origin + '/')
    begin
      url = URI.join('https://example.test' + route, ref)
      target = resolve.call(url.path)
      check.call(!target.nil?, "Broken local reference: #{relative}: #{ref}")
      if target && url.fragment && !url.fragment.empty? && File.extname(target) == '.html'
        target_doc = Nokogiri::HTML(File.read(target, encoding: 'UTF-8'))
        anchor = URI::DEFAULT_PARSER.unescape(url.fragment)
        check.call(target_doc.css('[id]').any? { |n| n['id'] == anchor }, "Missing anchor: #{relative}: #{ref}")
      end
    rescue URI::InvalidURIError => error
      check.call(false, "Invalid URL in #{relative}: #{ref}: #{error.message}")
    end
  end
end
%w[assets/css/portfolio.css assets/js/portfolio.js images/portrait.svg images/favicon.svg feed.xml sitemap.xml].each do |name|
  check.call(File.file?(File.join(output, name)), "Required output absent: #{name}")
end
%w[README.md LICENSE NOTICE.md Gemfile Gemfile.lock package.json package-lock.json scripts docs tests .git .github].each do |name|
  check.call(!File.exist?(File.join(output, name)), "Development file exposed: #{name}")
end
puts "Checked #{checks} conditions across #{html_files.size} HTML pages at #{base.empty? ? '/' : base + '/'}"
abort failures.join("\n") unless failures.empty?
puts 'Rendered-site checks passed.'
