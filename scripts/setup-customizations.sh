#!/usr/bin/env bash
#
# setup-customizations.sh - Interactive setup script for shared-dev-containers customizations
#
# This script guides users through configuring their personal customizations
# including dotfiles repository, shell configuration, and environment variables.
#
# Usage: ./scripts/setup-customizations.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Find the sdc command
SDC_CMD=""
find_sdc_command() {
    # Try to find sdc in common locations
    if command -v sdc &> /dev/null; then
        SDC_CMD="sdc"
    elif command -v bun &> /dev/null && [ -f "$(dirname "$0")/../src/cli.ts" ]; then
        SDC_CMD="bun run $(dirname "$0")/../src/cli.ts"
    elif [ -f "$(dirname "$0")/../dist/cli.js" ]; then
        SDC_CMD="node $(dirname "$0")/../dist/cli.js"
    else
        echo -e "${RED}Error: Could not find 'sdc' command.${NC}"
        echo "Please ensure shared-dev-containers is installed or run from the project directory."
        exit 1
    fi
}

# Print a header
print_header() {
    echo ""
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${BLUE}  $1${NC}"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Print a section header
print_section() {
    echo ""
    echo -e "${BOLD}${CYAN}▶ $1${NC}"
    echo ""
}

# Print info message
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Print success message
print_success() {
    echo -e "${GREEN}✔${NC} $1"
}

# Print warning message
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Print error message
print_error() {
    echo -e "${RED}✖${NC} $1"
}

# Ask yes/no question
# Returns 0 for yes, 1 for no
ask_yes_no() {
    local prompt="$1"
    local default="${2:-y}"
    local yn_hint

    if [ "$default" = "y" ]; then
        yn_hint="[Y/n]"
    else
        yn_hint="[y/N]"
    fi

    while true; do
        read -rp "$(echo -e "${BOLD}$prompt${NC} $yn_hint ")" yn
        yn=${yn:-$default}
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Read input with default
read_with_default() {
    local prompt="$1"
    local default="$2"
    local result

    if [ -n "$default" ]; then
        read -rp "$(echo -e "${BOLD}$prompt${NC} [$default]: ")" result
        echo "${result:-$default}"
    else
        read -rp "$(echo -e "${BOLD}$prompt${NC}: ")" result
        echo "$result"
    fi
}

# Validate Git URL
validate_git_url() {
    local url="$1"
    # HTTPS URLs
    if [[ "$url" =~ ^https://.*\.git$ ]]; then
        return 0
    fi
    # SSH URLs (git@host:user/repo.git)
    if [[ "$url" =~ ^git@[a-zA-Z0-9._-]+:[a-zA-Z0-9._/-]+\.git$ ]]; then
        return 0
    fi
    # SSH URLs (ssh://git@host/user/repo.git)
    if [[ "$url" =~ ^ssh://.*\.git$ ]]; then
        return 0
    fi
    return 1
}

# Validate file exists
validate_file_exists() {
    local path="$1"
    # Expand ~ to home directory
    path="${path/#\~/$HOME}"
    [ -f "$path" ]
}

# Validate environment variable name
validate_env_name() {
    local name="$1"
    [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

# Setup dotfiles repository
setup_dotfiles() {
    print_section "Dotfiles Repository Configuration"

    print_info "A dotfiles repository contains your personal configuration files"
    print_info "(e.g., .bashrc, .gitconfig, .vimrc) that can be automatically"
    print_info "cloned and applied when your devcontainer starts."
    echo ""

    if ! ask_yes_no "Do you want to configure a dotfiles repository?"; then
        print_info "Skipping dotfiles configuration."
        return
    fi

    echo ""
    local repo_url
    while true; do
        repo_url=$(read_with_default "Enter your dotfiles repository URL" "")

        if [ -z "$repo_url" ]; then
            if ask_yes_no "No URL entered. Skip dotfiles configuration?" "y"; then
                return
            fi
            continue
        fi

        if validate_git_url "$repo_url"; then
            break
        else
            print_error "Invalid Git URL format."
            print_info "Expected format: https://github.com/user/dotfiles.git"
            print_info "             or: git@github.com:user/dotfiles.git"
            echo ""
        fi
    done

    # Optional: Target path
    local target_path
    target_path=$(read_with_default "Target path in container" "~")

    # Optional: Install command
    local install_cmd=""
    if ask_yes_no "Do you have a custom install script to run after cloning?" "n"; then
        install_cmd=$(read_with_default "Install command" "./install.sh")
    fi

    # Build command
    local cmd="$SDC_CMD customize dotfiles \"$repo_url\""
    if [ "$target_path" != "~" ]; then
        cmd="$cmd --target \"$target_path\""
    fi
    if [ -n "$install_cmd" ]; then
        cmd="$cmd --install \"$install_cmd\""
    fi

    echo ""
    print_info "Running: $cmd"
    if eval "$cmd"; then
        print_success "Dotfiles repository configured successfully!"
    else
        print_error "Failed to configure dotfiles repository."
    fi
}

# Setup shell configuration
setup_shell_config() {
    print_section "Shell Configuration"

    print_info "You can specify a local shell configuration file (e.g., ~/.zshrc)"
    print_info "that will be copied into your devcontainer when it starts."
    echo ""

    if ! ask_yes_no "Do you want to configure a shell configuration file?"; then
        print_info "Skipping shell configuration."
        return
    fi

    echo ""
    local source_path
    local default_source=""

    # Suggest common shell config files
    if [ -f "$HOME/.zshrc" ]; then
        default_source="~/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        default_source="~/.bashrc"
    fi

    while true; do
        source_path=$(read_with_default "Path to your shell configuration file" "$default_source")

        if [ -z "$source_path" ]; then
            if ask_yes_no "No path entered. Skip shell configuration?" "y"; then
                return
            fi
            continue
        fi

        if validate_file_exists "$source_path"; then
            break
        else
            print_error "File not found: $source_path"
            echo ""
        fi
    done

    # Optional: Target path
    local target_path
    local default_target="~/.zshrc"
    if [[ "$source_path" == *bashrc* ]]; then
        default_target="~/.bashrc"
    fi
    target_path=$(read_with_default "Target path in container" "$default_target")

    # Build command
    local cmd="$SDC_CMD customize shell \"$source_path\""
    if [ "$target_path" != "~/.zshrc" ]; then
        cmd="$cmd --target \"$target_path\""
    fi

    echo ""
    print_info "Running: $cmd"
    if eval "$cmd"; then
        print_success "Shell configuration configured successfully!"
    else
        print_error "Failed to configure shell configuration."
    fi
}

# Setup environment variables
setup_env_vars() {
    print_section "Environment Variables"

    print_info "You can define custom environment variables that will be"
    print_info "available in all your devcontainers."
    echo ""

    if ! ask_yes_no "Do you want to configure custom environment variables?"; then
        print_info "Skipping environment variable configuration."
        return
    fi

    echo ""
    print_info "Enter environment variables one at a time."
    print_info "Press Enter with an empty name to finish."
    echo ""

    while true; do
        local var_name
        var_name=$(read_with_default "Variable name (empty to finish)" "")

        if [ -z "$var_name" ]; then
            break
        fi

        if ! validate_env_name "$var_name"; then
            print_error "Invalid variable name: $var_name"
            print_info "Must start with a letter or underscore and contain only"
            print_info "alphanumeric characters and underscores."
            echo ""
            continue
        fi

        local var_value
        var_value=$(read_with_default "Value for $var_name" "")

        local cmd="$SDC_CMD customize env \"$var_name\" \"$var_value\""

        print_info "Running: $cmd"
        if eval "$cmd"; then
            print_success "Environment variable '$var_name' set."
        else
            print_error "Failed to set environment variable '$var_name'."
        fi
        echo ""
    done
}

# Show current customizations
show_current_config() {
    print_section "Current Customizations"
    $SDC_CMD customize show
}

# Main menu
show_menu() {
    echo ""
    echo -e "${BOLD}What would you like to do?${NC}"
    echo ""
    echo "  1) Configure dotfiles repository"
    echo "  2) Configure shell configuration"
    echo "  3) Configure environment variables"
    echo "  4) Show current customizations"
    echo "  5) Clear all customizations"
    echo "  6) Exit"
    echo ""
    read -rp "$(echo -e "${BOLD}Enter your choice [1-6]:${NC} ")" choice
    echo ""

    case $choice in
        1) setup_dotfiles ;;
        2) setup_shell_config ;;
        3) setup_env_vars ;;
        4) show_current_config ;;
        5)
            if ask_yes_no "Are you sure you want to clear all customizations?" "n"; then
                $SDC_CMD customize clear
                print_success "All customizations cleared."
            else
                print_info "Cancelled."
            fi
            ;;
        6)
            print_info "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please enter a number between 1 and 6."
            ;;
    esac
}

# Run the wizard (all steps)
run_wizard() {
    setup_dotfiles
    setup_shell_config
    setup_env_vars

    print_section "Configuration Complete!"
    print_info "Your customizations have been saved to your global configuration."
    print_info "They will be applied when you generate new devcontainers."
    echo ""

    show_current_config
}

# Main function
main() {
    print_header "Shared Dev Containers - Customization Setup"

    print_info "This wizard will help you configure your personal customizations"
    print_info "for devcontainers, including dotfiles, shell configuration, and"
    print_info "environment variables."
    echo ""

    # Find sdc command
    find_sdc_command

    # Check if running with --wizard or --interactive flag
    if [[ "$1" == "--wizard" ]] || [[ "$1" == "-w" ]]; then
        run_wizard
        exit 0
    fi

    # Check if running with --menu or -m flag
    if [[ "$1" == "--menu" ]] || [[ "$1" == "-m" ]]; then
        while true; do
            show_menu
        done
    fi

    # Default: ask what mode to use
    echo "How would you like to proceed?"
    echo ""
    echo "  1) Run full wizard (configure all options)"
    echo "  2) Interactive menu (choose specific options)"
    echo "  3) Exit"
    echo ""
    read -rp "$(echo -e "${BOLD}Enter your choice [1-3]:${NC} ")" mode

    case $mode in
        1) run_wizard ;;
        2)
            while true; do
                show_menu
            done
            ;;
        3)
            print_info "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid choice."
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
