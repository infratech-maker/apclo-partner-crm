#!/bin/bash

# バージョン番号を更新するスクリプト
# 使用方法: ./scripts/version-bump.sh [major|minor|patch]

set -e

VERSION_FILE="VERSION"
CHANGELOG_FILE="CHANGELOG.md"
CSPROJ_FILE="CallSenderApp.csproj"
PACKAGE_JSON_FILE="crm-platform/package.json"

if [ ! -f "$VERSION_FILE" ]; then
    echo "Error: $VERSION_FILE not found"
    exit 1
fi

CURRENT_VERSION=$(cat "$VERSION_FILE")
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

BUMP_TYPE=${1:-patch}

case $BUMP_TYPE in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
    *)
        echo "Error: Invalid bump type. Use major, minor, or patch"
        exit 1
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

echo "Bumping version from $CURRENT_VERSION to $NEW_VERSION"

# Update VERSION file
echo "$NEW_VERSION" > "$VERSION_FILE"

# Update CallSenderApp.csproj
if [ -f "$CSPROJ_FILE" ]; then
    sed -i.bak "s/<Version>.*<\/Version>/<Version>$NEW_VERSION<\/Version>/" "$CSPROJ_FILE"
    sed -i.bak "s/<AssemblyVersion>.*<\/AssemblyVersion>/<AssemblyVersion>$NEW_VERSION.0<\/AssemblyVersion>/" "$CSPROJ_FILE"
    sed -i.bak "s/<FileVersion>.*<\/FileVersion>/<FileVersion>$NEW_VERSION.0<\/FileVersion>/" "$CSPROJ_FILE"
    rm -f "${CSPROJ_FILE}.bak"
fi

# Update package.json
if [ -f "$PACKAGE_JSON_FILE" ]; then
    # macOS用のsedコマンド
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i.bak "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON_FILE"
    else
        sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON_FILE"
    fi
    rm -f "${PACKAGE_JSON_FILE}.bak"
fi

echo "Version updated to $NEW_VERSION"
echo ""
echo "Next steps:"
echo "1. Update CHANGELOG.md with changes for version $NEW_VERSION"
echo "2. Commit the changes: git add -A && git commit -m \"Bump version to $NEW_VERSION\""
echo "3. Create a tag: git tag -a v$NEW_VERSION -m \"Release version $NEW_VERSION\""
echo "4. Push changes and tag: git push && git push --tags"






