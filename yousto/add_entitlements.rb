require 'xcodeproj'
require 'fileutils'

project_path = 'ios/YoustoApp.xcodeproj'
project = Xcodeproj::Project.open(project_path)

entitlements_content = <<~XML
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
  	<key>com.apple.security.application-groups</key>
  	<array>
  		<string>group.org.reactjs.native.example.YoustoApp</string>
  	</array>
  </dict>
  </plist>
XML

# 1. Setup YoustoApp entitlements
app_target = project.targets.find { |t| t.name == 'YoustoApp' }
app_entitlements_path = 'ios/YoustoApp/YoustoApp.entitlements'
File.write(app_entitlements_path, entitlements_content)

app_group = project.main_group.find_subpath('YoustoApp', false)
if app_group && app_group.respond_to?(:files)
  if app_group.files.find { |f| f.path == 'YoustoApp.entitlements' }.nil?
    app_group.new_reference('YoustoApp.entitlements')
  end
end

app_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'YoustoApp/YoustoApp.entitlements'
end

# 2. Setup YoustoShare entitlements
share_target = project.targets.find { |t| t.name == 'YoustoShare' }
share_entitlements_path = 'ios/YoustoShare/YoustoShare.entitlements'
File.write(share_entitlements_path, entitlements_content)

# We don't need to add file reference because YoustoShare is a Synchronized folder in Xcode 16
share_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'YoustoShare/YoustoShare.entitlements'
end

project.save
puts "Successfully added entitlements to both targets!"
