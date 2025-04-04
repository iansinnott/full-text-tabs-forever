#!/bin/bash

main() {
  echo "Releasing new version..."
  echo
  echo "    PWD: $PWD"

  local version=$(jq -r '.version' package.json)
  
  # Replace version in src/manifest.json
  sed -i '' -e "s/\"version\": \".*\"/\"version\": \"$version\"/g" src/manifest.json
  
  # amend last commit
  git add src/manifest.json > /dev/null
  git commit --amend --no-edit > /dev/null

  # upsert the tag. if running yarn version the tag will have been created already
  git tag -d "v$version" > /dev/null 2>&1 || true 
  git tag -a "v$version" -m "v$version" > /dev/null
  
  echo "    Tag: v$version"
  echo "    Commit: $(git rev-parse HEAD)"
  echo
  echo "Don't forget to push the tag to GitHub: git push --tags"
}

main