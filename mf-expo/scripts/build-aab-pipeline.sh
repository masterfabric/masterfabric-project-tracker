#!/bin/bash

# Clean Android App Bundle (AAB) Build Pipeline Script
# This script performs a complete clean build pipeline:
# 1. Clean all build artifacts
# 2. Update version and build number
# 3. Validate setup and check for common issues
# 4. Run Expo prebuild if needed
# 5. Perform clean Gradle build
# 6. Build AAB

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

BUILD_DIR="android/app/build"
AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"

# App information (will be extracted from app.json)
APP_NAME=""
PACKAGE_NAME=""
APP_VERSION=""
VERSION_CODE=""

# Timing
SCRIPT_START_TIME=$(date +%s)

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📋 $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Extract app information from app.json
extract_app_info() {
    if [ -f "app.json" ]; then
        APP_NAME=$(node -e "console.log(require('./app.json').expo.name)" 2>/dev/null || echo "MasterFabric")
        PACKAGE_NAME=$(node -e "console.log(require('./app.json').expo.android.package)" 2>/dev/null || echo "com.masterfabric.monoExpo")
        APP_VERSION=$(node -e "console.log(require('./app.json').expo.version)" 2>/dev/null || echo "1.0.0")
        VERSION_CODE=$(node -e "console.log(require('./app.json').expo.android.versionCode)" 2>/dev/null || echo "1")
    else
        # Fallback values
        APP_NAME="MasterFabric"
        PACKAGE_NAME="com.masterfabric.monoExpo"
        APP_VERSION="1.0.0"
        VERSION_CODE="1"
    fi
}

# Calculate elapsed time
get_elapsed_time() {
    local end_time=$(date +%s)
    local elapsed=$((end_time - SCRIPT_START_TIME))
    local hours=$((elapsed / 3600))
    local minutes=$(((elapsed % 3600) / 60))
    local seconds=$((elapsed % 60))
    
    if [ $hours -gt 0 ]; then
        echo "${hours}h ${minutes}m ${seconds}s"
    elif [ $minutes -gt 0 ]; then
        echo "${minutes}m ${seconds}s"
    else
        echo "${seconds}s"
    fi
}

# Format file size
format_file_size() {
    local size=$1
    if [ -f "$(which numfmt)" ]; then
        numfmt --to=iec-i --suffix=B "$size" 2>/dev/null || du -h "$size" | cut -f1
    else
        du -h "$size" | cut -f1
    fi
}

# Open AAB in Finder
open_aab_in_finder() {
    local aab_path=$1
    if [ -f "$aab_path" ]; then
        log_info "Opening AAB location in Finder..."
        open -R "$aab_path"
    else
        log_warning "AAB file not found, opening build directory instead..."
        open "android/app/build/outputs/bundle/release"
    fi
}

# Update version and build number in app.json
update_version_info() {
    log_step "Version & Build Number Configuration"
    
    # Extract current values
    extract_app_info
    
    echo -e "${BLUE}Current Version Information:${NC}"
    echo -e "  ${BLUE}Version:${NC} $APP_VERSION"
    echo -e "  ${BLUE}Version Code:${NC} $VERSION_CODE"
    echo ""
    
    # Ask if user wants to update
    echo -ne "${YELLOW}Do you want to update version/version code? [y/N]: ${NC}"
    read -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Keeping current version: $APP_VERSION (Version Code $VERSION_CODE)"
        return
    fi
    
    # Clear any leftover input from stdin
    while IFS= read -t 0.1 -r -n 1; do :; done 2>/dev/null || true
    
    # Step 1: Get new version
    echo ""
    log_info "Enter new values or press Enter to keep current."
    echo ""
    
    printf "${BLUE}Enter new version [Press Enter to skip] [$APP_VERSION]: ${NC}"
    IFS= read -r new_version </dev/tty
    
    # Trim whitespace and use current if empty
    new_version=$(echo "$new_version" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    if [ -z "$new_version" ]; then
        new_version="$APP_VERSION"
    fi
    
    # Step 2: Get new version code
    while true; do
        printf "${BLUE}Enter new version code (1-999999) [Press Enter to skip] [$VERSION_CODE]: ${NC}"
        IFS= read -r new_version_code </dev/tty
        
        # Trim whitespace
        new_version_code=$(echo "$new_version_code" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        # If empty, use current version code
        if [ -z "$new_version_code" ]; then
            new_version_code="$VERSION_CODE"
            break
        fi
        
        # Validate version code: must be numeric, range 1-999999
        if [[ "$new_version_code" =~ ^[0-9]+$ ]]; then
            if (( new_version_code >= 1 && new_version_code <= 999999 )); then
                break
            else
                log_error "Version code must be between 1 and 999999."
                echo ""
            fi
        else
            log_error "Version code must be numeric (1-999999)."
            echo ""
        fi
    done
    
    # Update app.json and Android files if values changed
    if [ "$new_version" != "$APP_VERSION" ] || [ "$new_version_code" != "$VERSION_CODE" ]; then
        log_info "Updating version and version code..."
        
        # Step 1: Update app.json
        node -e "
        const fs = require('fs');
        const appJsonPath = './app.json';
        const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
        
        appJson.expo.version = '$new_version';
        appJson.expo.android.versionCode = parseInt('$new_version_code');
        
        fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
        console.log('✅ Updated app.json');
        " || {
            log_error "Failed to update app.json"
            exit 1
        }
        
        # Note: build.gradle and AndroidManifest.xml will be updated AFTER prebuild
        # since they are generated by prebuild. This function only updates app.json.
        
        # Update local variables
        APP_VERSION="$new_version"
        VERSION_CODE="$new_version_code"
        
        log_success "Version and version code updated"
        echo -e "  ${BLUE}Version:${NC} $new_version"
        echo -e "  ${BLUE}Version Code:${NC} $new_version_code"
    else
        log_info "No changes made"
    fi
    
    echo ""
}

# Step 1: Clean all build artifacts
clean_build_artifacts() {
    log_step "Step 1: Cleaning Build Artifacts"
    
    log_info "Cleaning Android build directory..."
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    
    log_info "Cleaning Gradle cache..."
    cd android
    local gradle_clean_result=0
    ./gradlew clean 2>/dev/null || gradle_clean_result=$?
    if [ $gradle_clean_result -ne 0 ]; then
        log_warning "Gradle clean failed (may not be critical)"
    fi
    cd ..
    
    log_info "Cleaning .gradle directory..."
    rm -rf android/.gradle
    
    log_success "Build artifacts cleaned"
}

# Step 2: Validate environment
validate_environment() {
    log_step "Step 2: Validating Environment"
    
    local errors=0
    
    # Check Java - verify it actually works, not just that the command exists
    if ! command_exists java; then
        log_error "Java not found. Install Java JDK 17 or later"
        errors=$((errors + 1))
    else
        # Try to actually run Java to verify it's functional
        local java_test_output=$(java -version 2>&1)
        local java_test_exit=$?
        
        # Check if Java actually works (not just a stub)
        if [ $java_test_exit -ne 0 ] || echo "$java_test_output" | grep -qi "unable to locate\|no java runtime\|install java"; then
            log_error "Java command exists but no runtime is installed. Install Java JDK 17 or later"
            log_info "Install from: https://adoptium.net/ or use: brew install openjdk@17"
            errors=$((errors + 1))
        else
            local java_version=$(echo "$java_test_output" | head -n 1)
            log_success "Java found: $java_version"
        fi
    fi
    
    # Check Android SDK
    if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
        log_warning "ANDROID_HOME not set. Android SDK may not be found."
        log_info "Set ANDROID_HOME environment variable or install Android Studio"
    else
        local android_home="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
        log_success "Android SDK found: $android_home"
    fi
    
    # Check Node.js
    if ! command_exists node; then
        log_error "Node.js not found"
        errors=$((errors + 1))
    else
        local node_version=$(node --version)
        log_success "Node.js found: $node_version"
    fi
    
    # Check npm/yarn
    if ! command_exists npm && ! command_exists yarn; then
        log_error "Neither npm nor yarn found"
        errors=$((errors + 1))
    else
        log_success "Package manager found"
    fi
    
    # Check Expo CLI
    if ! command_exists expo && ! command_exists npx; then
        log_error "Expo CLI not found. Install with: npm install -g expo-cli"
        errors=$((errors + 1))
    else
        log_success "Expo CLI available"
    fi
    
    # Check if android directory exists
    if [ ! -d "android" ]; then
        log_error "Android directory not found"
        errors=$((errors + 1))
    else
        log_success "Android project directory found"
    fi
    
    if [ $errors -gt 0 ]; then
        log_error "Environment validation failed with $errors error(s)"
        log_info ""
        log_info "Please fix the errors above and try again."
        exit 1
    fi
    
    log_success "Environment validated"
}

# Step 3: Install Node dependencies
install_node_dependencies() {
    log_step "Step 3: Installing Node Dependencies"
    
    log_info "Checking node_modules..."
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/expo" ]; then
        log_info "Installing npm dependencies..."
        npm install
        log_success "Node dependencies installed"
    else
        log_success "Node dependencies already installed"
    fi
    
    log_success "Node dependencies verified"
}

# Step 4: Run Expo prebuild if needed
run_prebuild() {
    log_step "Step 4: Running Expo Prebuild"
    
    # Check if build.gradle exists
    local build_gradle_exists=false
    if [ -f "android/app/build.gradle" ]; then
        build_gradle_exists=true
    fi
    
    if [ ! -f "android/app/build.gradle" ]; then
        log_info "Android native files not found. Running Expo prebuild..."
        local prebuild_result=0
        npx expo prebuild --platform android --clean || prebuild_result=$?
        if [ $prebuild_result -ne 0 ]; then
            log_error "Prebuild failed"
            exit 1
        fi
        log_success "Prebuild completed"
    else
        log_success "Android native files already exist"
    fi
}

# Step 5: Clean Gradle build
clean_gradle_build() {
    log_step "Step 5: Cleaning Gradle Build"
    
    log_info "Cleaning Gradle build..."
    cd android
    ./gradlew clean 2>&1 | grep -v "note:" || true
    cd ..
    
    log_success "Gradle build cleaned"
}

# Step 6: Build AAB
build_aab() {
    log_step "Step 6: Building Android App Bundle (AAB)"
    
    log_info "Building AAB (this may take 10-20 minutes)..."
    log_info "Package: $PACKAGE_NAME"
    log_info "Version: $APP_VERSION (Code: $VERSION_CODE)"
    
    cd android
    
    local gradle_result=0
    local gradle_output=$(./gradlew bundleRelease 2>&1) || gradle_result=$?
    
    if [ $gradle_result -eq 0 ]; then
        log_success "AAB built successfully"
    else
        log_error "AAB build failed"
        echo ""
        log_info "Gradle error output (last 20 lines):"
        echo "$gradle_output" | tail -20 | sed 's/^/  /'
        echo ""
        log_info "Common issues and solutions:"
        log_info "1. Missing Java: Install Java JDK 17+ from https://adoptium.net/"
        log_info "2. Missing Android SDK: Install Android Studio and set ANDROID_HOME"
        log_info "3. Gradle sync issues: Run 'cd android && ./gradlew --refresh-dependencies'"
        log_info "4. Signing issues: Check keystore configuration"
        log_info "5. Missing dependencies: Run 'npm install' and 'npx expo prebuild'"
        cd ..
        exit 1
    fi
    
    cd ..
    
    # Verify AAB was created
    if [ ! -f "$AAB_PATH" ]; then
        log_error "AAB file not found at expected location: $AAB_PATH"
        log_info "Checking alternative locations..."
        local alt_aab=$(find android/app/build -name "*.aab" -type f 2>/dev/null | head -1)
        if [ -f "$alt_aab" ]; then
            AAB_PATH="$alt_aab"
            log_success "Found AAB at: $AAB_PATH"
        else
            log_error "AAB file not found in build directory"
            exit 1
        fi
    else
        log_success "AAB found at expected location: $AAB_PATH"
    fi
}

# Show final summary
show_final_summary() {
    local aab_path=$1
    local aab_size=$2
    local elapsed_time=$(get_elapsed_time)
    
    # Extract app info if not already done
    if [ -z "$APP_NAME" ]; then
        extract_app_info
    fi
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║           🎉 Build Pipeline Completed Successfully! 🎉     ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║  📱 App Information:                                        ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    printf "${GREEN}║  ${NC}  App Name:        ${BLUE}%-45s${NC}${GREEN}║${NC}\n" "$APP_NAME"
    printf "${GREEN}║  ${NC}  Package Name:    ${BLUE}%-45s${NC}${GREEN}║${NC}\n" "$PACKAGE_NAME"
    printf "${GREEN}║  ${NC}  Version:         ${BLUE}%-45s${NC}${GREEN}║${NC}\n" "$APP_VERSION"
    printf "${GREEN}║  ${NC}  Version Code:    ${BLUE}%-45s${NC}${GREEN}║${NC}\n" "$VERSION_CODE"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║  📦 Build Results:                                         ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    printf "${GREEN}║  ${NC}  AAB Location:    ${BLUE}%-45s${NC}${GREEN}║${NC}\n" "$aab_path"
    printf "${GREEN}║  ${NC}  AAB Size:        ${BLUE}%-45s${NC}${GREEN}║${NC}\n" "$aab_size"
    printf "${GREEN}║  ${NC}  Total Time:      ${BLUE}%-45s${NC}${GREEN}║${NC}\n" "$elapsed_time"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║  ${YELLOW}💡 Opening AAB location in Finder...${NC}${GREEN}                              ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Automatically open AAB location in Finder
    sleep 1
    open_aab_in_finder "$aab_path"
}

# Main execution
main() {
    # Extract app information at the start
    extract_app_info
    
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Clean AAB Build Pipeline                ║${NC}"
    echo -e "${BLUE}║   MasterFabric Android Build              ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Check for skip flags
    SKIP_CLEAN=false
    SKIP_PREBUILD=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-clean)
                SKIP_CLEAN=true
                shift
                ;;
            --skip-prebuild)
                SKIP_PREBUILD=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Usage: $0 [--skip-clean] [--skip-prebuild]"
                exit 1
                ;;
        esac
    done
    
    
    # Run pipeline steps
    if [ "$SKIP_CLEAN" = false ]; then
        clean_build_artifacts
    else
        log_warning "Skipping clean step"
    fi
    
    validate_environment
    install_node_dependencies
    
    # Ask user to update version/version code BEFORE prebuild
    # This updates app.json first, then prebuild will use those values
    update_version_info
    
    # Re-extract app info in case it was updated
    extract_app_info
    
    echo ""
    echo -e "${BLUE}📱 App:${NC} $APP_NAME"
    echo -e "${BLUE}📦 Package:${NC} $PACKAGE_NAME"
    echo -e "${BLUE}🔢 Version:${NC} $APP_VERSION (Code $VERSION_CODE)"
    echo ""
    
    if [ "$SKIP_PREBUILD" = false ]; then
        run_prebuild
        
        # Update native files AFTER prebuild (since prebuild generates them)
        # This ensures our version updates are applied to the generated files
        if [ -f "android/app/build.gradle" ]; then
            log_info "Updating version in generated build.gradle..."
            local sed_result1=0
            sed -i '' "s/versionName \".*\"/versionName \"$APP_VERSION\"/g" "android/app/build.gradle" || sed_result1=$?
            local sed_result2=0
            sed -i '' "s/versionCode [0-9]*/versionCode $VERSION_CODE/g" "android/app/build.gradle" || sed_result2=$?
            log_success "Updated build.gradle with version $APP_VERSION (Code $VERSION_CODE)"
        fi
        
        local manifest_path="android/app/src/main/AndroidManifest.xml"
        if [ -f "$manifest_path" ]; then
            log_info "Updating version in generated AndroidManifest.xml..."
            local sed_result3=0
            sed -i '' "s/android:versionName=\"[^\"]*\"/android:versionName=\"$APP_VERSION\"/g" "$manifest_path" || sed_result3=$?
            local sed_result4=0
            sed -i '' "s/android:versionCode=\"[^\"]*\"/android:versionCode=\"$VERSION_CODE\"/g" "$manifest_path" || sed_result4=$?
            log_success "Updated AndroidManifest.xml with version $APP_VERSION (Code $VERSION_CODE)"
        fi
    else
        log_warning "Skipping prebuild"
    fi
    
    clean_gradle_build
    build_aab
    
    # Show final summary
    local aab_size=$(du -h "$AAB_PATH" | cut -f1)
    show_final_summary "$AAB_PATH" "$aab_size"
}

# Run main function
main "$@"

