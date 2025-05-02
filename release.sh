#!/bin/bash

# Function to get current version from package.json
get_current_version() {
    local package_dir=$1
    local package_json="$package_dir/package.json"
    if [ -f "$package_json" ]; then
        grep '"version":' "$package_json" | cut -d\" -f4
    else
        echo "Error: package.json not found in $package_dir"
        exit 1
    fi
}

# Function to get package name from package.json
get_package_name() {
    local package_dir=$1
    local package_json="$package_dir/package.json"
    if [ -f "$package_json" ]; then
        grep '"name":' "$package_json" | cut -d\" -f4
    else
        echo "Error: package.json not found in $package_dir"
        exit 1
    fi
}

# Function to update version
update_version() {
    local package_dir=$1
    local version_type=$2

    case $version_type in
        "patch")
            pnpm version patch --no-git-tag-version
            ;;
        "minor")
            pnpm version minor --no-git-tag-version
            ;;
        "major")
            pnpm version major --no-git-tag-version
            ;;
        *)
            echo "Invalid version type. Please choose patch/minor/major/skip"
            exit 1
            ;;
    esac
}

# Main script
echo "Starting package version management..."

# Iterate through packages directory
for package_dir in packages/*; do
    if [ -d "$package_dir" ]; then
        package_name=$(get_package_name "$package_dir")
        current_version=$(get_current_version "$package_dir")

        echo "Package: $package_name"
        echo "Current version: $current_version"

        # Ask for version update
        read -p "Update version? (patch/minor/major/skip): " version_type

        # Create git tag
        if [ "$version_type" == "skip" ]; then
            echo "Skipping git tag creation for $package_name"
            echo ""
            continue
        fi

        cd $package_dir

        # Update version if needed
        update_version "$package_dir" "$version_type"

        cd ../..

        # Get new version
        new_version=$(get_current_version "$package_dir")

        # git tag "$package_name@$new_version"
        echo "Created git tag: $package_name@$new_version"

        pnpm i

        # Run release script
        echo "Running release process..."
        # pnpm run release

        echo ""
    fi
done

# Echo joke
echo "Released! (Released!) (Released!)"
