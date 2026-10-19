# frozen_string_literal: true
require 'yaml'
require 'date'
require 'json'
require 'pathname'
root = File.expand_path('..', __dir__)
failures = []
routes = []
Dir.glob(File.join(root, '{_pages,_projects,_publications,_experience,_teaching,_leadership,_talks,_portfolio}', '*.{md,html}')).each do |file|
  front = File.read(file, encoding: 'UTF-8').split(/^---\s*$\n?/, 3)[1]
  meta = YAML.safe_load(front, permitted_classes: [Date, Time], aliases: true)
  failures << "Missing title or permalink: #{file}" unless meta['title'] && meta['permalink']
  routes << meta['permalink']
  next if File.basename(File.dirname(file)) == '_pages'
  collection = File.basename(File.dirname(file)).delete_prefix('_')
  failures << "Wrong collection: #{file}" unless meta['collection'] == collection
  failures << "Missing date: #{file}" unless meta['date']
  failures << "Tags must be a list: #{file}" if meta['tags'] && !meta['tags'].is_a?(Array)
end
failures << 'Duplicate permalinks' unless routes.uniq.size == routes.size
skills = JSON.parse(File.read(File.join(root, '_data/portfolio_skills.json')))
failures << 'Skills groups need names and lists' unless skills['groups'].all? { |group| group['name'].is_a?(String) && group['skills'].is_a?(Array) }
profile = YAML.safe_load(File.read(File.join(root, '_data/portfolio.yml')))
failures << 'Missing configurable portrait' unless profile.dig('portrait', 'image')
failures << 'Demo must be true or false' unless [true, false].include?(profile['demo'])
# Fail on accidental private keys, machine-specific paths, or copied deployment credentials.
Dir.glob(File.join(root, '**', '*'), File::FNM_DOTMATCH).select { |file| File.file?(file) }.each do |file|
  rel = Pathname.new(file).relative_path_from(Pathname.new(root)).to_s.tr('\\', '/')
  next if rel.match?(%r{\A(?:\.git/|\.sass-cache/|\.jekyll-cache/|_site[^/]*/|vendor/|local/|__pycache__/)})
  next if rel == 'tests/source_contract.rb'
  text = File.binread(file).force_encoding('UTF-8')
  next unless text.valid_encoding?
  failures << "Machine-specific path in #{rel}" if text.match?(%r{[A-Z]:[\\/]Users[\\/]}i)
  failures << "Private key in #{rel}" if text.match?(/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/)
end
abort failures.join("\n") unless failures.empty?
puts "Source contract passed: #{routes.size} sample pages and collection records."
