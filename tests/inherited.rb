# frozen_string_literal: true
# Integration checks for capabilities inherited from Academic Pages.
require 'tmpdir'
require 'fileutils'
require 'yaml'
require 'date'
require 'json'
require 'jekyll'
require 'nokogiri'
root = File.expand_path('..', __dir__)
Dir.mktmpdir('portfolio-inherited-') do |temporary|
  %w[_layouts _includes _data _pages _sass _posts _portfolio _projects _publications _experience _talks _teaching _leadership assets images files blog].each do |name|
    FileUtils.cp_r(File.join(root, name), temporary)
  end
  config = YAML.safe_load(File.read(File.join(root, '_config.yml')))
  config['baseurl'] = '/inherited'
  config['analytics'] = {'provider'=>'custom'}
  config['comments'] = {'provider'=>'custom'}
  config['google_site_verification'] = 'test-only-verification'
  File.write(File.join(temporary,'_includes/analytics-providers/custom.html'), '<script data-test-analytics>window.exampleAnalytics = true;</script>')
  File.write(File.join(temporary,'_includes/comments-providers/custom.html'), '<script data-test-comments>window.exampleComments = true;</script>')
  (1..6).each do |index|
    File.write(File.join(temporary, "_posts/2026-02-0#{index}-post.md"), "---\ntitle: Fixture post #{index}\ndate: 2026-02-0#{index}\n---\n\nTest fixture.\n")
  end
  File.write(File.join(temporary,'_pages/no-analytics.md'), "---\ntitle: Analytics excluded\npermalink: /no-analytics/\nanalytics: false\n---\n\nTest.\n")
  components = {'title'=>'Component fixture', 'layout'=>'single', 'permalink'=>'/components/',
    'gallery'=>[{'image_path'=>'portrait.svg','url'=>'portrait.svg','alt'=>'Placeholder'}],
    'feature_row'=>[{'image_path'=>'portrait.svg','alt'=>'Placeholder','title'=>'Feature fixture','url'=>'/projects/','btn_label'=>'Projects'}]}
  File.write(File.join(temporary,'_pages/components.md'), "---\n" + components.to_yaml.sub(/\A---\s*\n/,'') + "---\n\n{% include gallery %}\n{% include feature_row %}\n")
  %w[talk archive-taxonomy].each do |layout|
    File.write(File.join(temporary,"_pages/fixture-#{layout}.md"), "---\ntitle: #{layout} fixture\nlayout: #{layout}\npermalink: /fixture-#{layout}/\n---\n\nExample.\n")
  end
  File.write(File.join(temporary,'_pages/fixture-splash.md'), "---\ntitle: Splash fixture\nlayout: splash\npermalink: /fixture-splash/\nheader:\n  overlay_color: '#234567'\n  cta_url: /projects/\n  cta_label: Projects\n---\n\nExample.\n")
  %w[default air sunrise mint dirt contrast].each do |palette|
    config['site_theme'] = palette
    File.write(File.join(temporary,'_config.yml'), config.to_yaml)
    Dir.chdir(temporary) do
      Jekyll::Site.new(Jekyll.configuration({'source'=>temporary,'destination'=>File.join(temporary,'_site')})).process
    end
    css = File.read(File.join(temporary,'_site/assets/css/main.css'))
    raise "Classic palette missing: #{palette}" unless css.include?('--global-bg-color')
    home = File.read(File.join(temporary,'_site/index.html'))
    raise "Modern palette not configured: #{palette}" unless home.include?("data-palette=\"#{palette}\"")
  end
  output = File.join(temporary,'_site')
  page2 = Nokogiri::HTML(File.read(File.join(output,'blog/page2/index.html')))
  raise 'Pagination previous link ignores base path' unless page2.at_css('.pagination a')['href'] == '/inherited/blog/'
  classic = Nokogiri::HTML(File.read(File.join(output,'classic/index.html')))
  raise 'Classic author sidebar missing' unless classic.at_css('.author__avatar')
  raise 'Custom comments hook missing' unless classic.at_css('script[data-test-comments]')
  raise 'Custom analytics hook missing' unless classic.at_css('script[data-test-analytics]')
  modern = Nokogiri::HTML(File.read(File.join(output,'index.html')))
  raise 'Modern analytics hook missing' unless modern.at_css('script[data-test-analytics]')
  raise 'Verification setting missing' unless modern.at_css('meta[name="google-site-verification"]')['content'] == 'test-only-verification'
  raise 'Page analytics opt-out ignored' if File.read(File.join(output,'no-analytics/index.html')).include?('data-test-analytics')
  components = File.read(File.join(output,'components/index.html'))
  raise 'Gallery or feature row missing' unless components.include?('feature__wrapper') && components.include?('Placeholder')
  cv = File.read(File.join(output,'cv/index.html'))
  raise 'Generated CV missing publications' unless cv.include?('Reproducible Workflows')
  raise 'Generated CV missing original portfolio collection' unless cv.include?('Classic portfolio entry')
  feed = File.read(File.join(output,'feed.xml'))
  raise 'Blog absent from feed' unless feed.include?('Research notes')
  system('ruby',File.join(root,'scripts/verify.rb'),output,'/inherited',config['url']) || raise('Inherited feature links failed')
end
puts 'Inherited checks passed: six palettes, pagination, classic sidebar, CV/feed, custom integration hooks, analytics opt-out and verification settings.'
