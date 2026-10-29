source "https://rubygems.org"

gem "cocoapods", "1.16.1"
gem "rexml", ">= 3.4.2"

# Chatlet: TestFlight builds run through fastlane (`bundle exec fastlane ios ... --env chatlet`)
gem "fastlane"
plugins_path = File.join(File.dirname(__FILE__), 'fastlane', 'Pluginfile')
eval_gemfile(plugins_path) if File.exist?(plugins_path)
