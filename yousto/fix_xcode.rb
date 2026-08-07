require 'xcodeproj'

project_path = 'ios/YoustoApp.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the Share Extension target
share_target = project.targets.find { |t| t.name == 'YoustoShare' }
if share_target.nil?
  puts "Could not find YoustoShare target"
  exit 1
end

# Find the YoustoShare group (folder in Xcode)
share_group = project.main_group.find_subpath('YoustoShare', false)
if share_group.nil?
  puts "Could not find YoustoShare group"
  exit 1
end

# 1. Delete ShareViewController.m
file_ref_m = share_group.files.find { |f| f.path == 'ShareViewController.m' || f.name == 'ShareViewController.m' }
if file_ref_m
  # Remove from build phases
  share_target.source_build_phase.files_references.each do |ref|
    if ref == file_ref_m
      share_target.source_build_phase.remove_file_reference(ref)
    end
  end
  # Remove from group
  file_ref_m.remove_from_project
  puts "Removed ShareViewController.m from Xcode project"
  
  # Also delete from disk
  m_path = File.join('ios/YoustoShare', 'ShareViewController.m')
  File.delete(m_path) if File.exist?(m_path)
end

# 2. Add ShareViewController.swift from node_modules
swift_file_path = '../node_modules/react-native-share-menu/ios/ShareViewController.swift'
swift_file_ref = share_group.files.find { |f| f.path == swift_file_path }

if swift_file_ref.nil?
  swift_file_ref = share_group.new_reference(swift_file_path)
  share_target.source_build_phase.add_file_reference(swift_file_ref)
  puts "Added ShareViewController.swift to Xcode project"
else
  puts "ShareViewController.swift already exists in Xcode project"
end

project.save
puts "Project saved successfully."
