# frozen_string_literal: true
# Exercise the reusable engine with empty collections and missing optional fields.
require 'tmpdir'
require 'fileutils'
require 'yaml'
require 'date'
require 'json'
require 'jekyll'
require 'nokogiri'

root = File.expand_path('..', __dir__)
Dir.mktmpdir('portfolio-template-edge-') do |temporary|
  %w[_layouts _includes _data _pages _sass assets images files blog].each do |name|
    FileUtils.cp_r(File.join(root, name), temporary)
  end
  %w[projects publications experience teaching leadership talks portfolio].each do |collection|
    FileUtils.mkdir_p(File.join(temporary, '_' + collection))
  end
  config = YAML.safe_load(File.read(File.join(root, '_config.yml')))
  config['baseurl'] = '/edge'
  File.write(File.join(temporary, '_config.yml'), config.to_yaml)
  # Omit the optional CV key entirely, not just an empty string.
  profile_path = File.join(temporary, '_data/portfolio.yml')
  profile = YAML.safe_load(File.read(profile_path))
  profile.delete('cv_url')
  profile['portrait'] = {}
  profile['demo'] = false
  profile['affiliations'] = []
  profile['awards'] = []
  profile['research_affiliations'] = []
  File.write(profile_path, profile.to_yaml)
  File.write(File.join(temporary, '_data/portfolio_skills.json'), JSON.generate({'groups'=>[], 'languages'=>[], 'degrees'=>[]}))
  # A category-free record should still appear in the experience archive.
  File.write(File.join(temporary, '_experience/example.md'), "---\ntitle: Optional metadata example\ncollection: experience\ndate: 2026-01-01\npermalink: /experience/example/\n---\n\nMinimal entry.\n")
  Dir.chdir(temporary) do
    Jekyll::Site.new(Jekyll.configuration({'source'=>temporary, 'destination'=>File.join(temporary, '_site')})).process
  end
  home = Nokogiri::HTML(File.read(File.join(temporary, '_site/index.html')))
  raise 'Optional portrait emitted without an image' unless home.css('.hero-portrait, .portrait-live, .portrait-anim').empty?
  raise 'CV link emitted without a resource' unless home.css('.social-download').empty?
  raise 'Demo notice emitted after disabling it' unless home.css('.template-notice').empty?
  raise 'Empty collections lack usable fallback' unless home.text.include?('No entries yet.')
  home.css('a').each { |node| raise 'Empty destination' if node['href'].to_s.empty? }
  archive = File.read(File.join(temporary, '_site/experience/index.html'))
  raise 'Category-free role disappeared' unless archive.include?('Optional metadata example')
  raise 'A map loaded without opt-in' if File.read(File.join(temporary, '_site/talks/index.html')).include?('leaflet.js')
  system('ruby', File.join(root, 'scripts/verify.rb'), File.join(temporary, '_site'), '/edge', config['url']) || raise('Edge-case links failed')
  # Map opt-in is separately checked with a neutral coordinate and an escapable title.
  File.write(File.join(temporary, '_talks/example.md'), "---\ntitle: Example mapped talk\ncollection: talks\ndate: 2026-01-01\npermalink: /talks/example/\nlatitude: 0\nlongitude: 0\nlocation: Example location\nvenue: Example venue\n---\n\nExample.\n")
  talks_page = File.join(temporary, '_pages/talks.html')
  File.write(talks_page, File.read(talks_page).sub('talkmap: false', 'talkmap: true'))
  Dir.chdir(temporary) do
    Jekyll::Site.new(Jekyll.configuration({'source'=>temporary, 'destination'=>File.join(temporary, '_site')})).process
  end
  map_doc = Nokogiri::HTML(File.read(File.join(temporary, '_site/talks/index.html')))
  points = JSON.parse(map_doc.at_css('#talk-map-data').text)
  raise 'Map does not retain the project base path' unless points.first['url'] == '/edge/talks/example/'
end
puts 'Edge cases passed: empty collections, omitted portrait/CV, category-free roles, and opt-in map.'
