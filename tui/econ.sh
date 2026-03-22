#!/usr/bin/env bash
# =============================================================================
#  econ.vibe — The AI Development Operating System
#  Pure Bash + Tmux TUI  |  256-color ANSI  |  No dependencies beyond bash/tmux
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Guard: require a real terminal
# ---------------------------------------------------------------------------
if [[ ! -t 0 || ! -t 1 ]]; then
  echo "econ.vibe requires an interactive terminal." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 256-color palette
# ---------------------------------------------------------------------------
PURPLE='\033[38;5;99m'
LPURPLE='\033[38;5;141m'
CYAN='\033[38;5;75m'
GREEN='\033[38;5;78m'
YELLOW='\033[38;5;220m'
RED='\033[38;5;203m'
GRAY='\033[38;5;240m'
LGRAY='\033[38;5;250m'
WHITE='\033[38;5;255m'
MUTED='\033[38;5;238m'
BG_SEL='\033[48;5;55m'
BG_CARD='\033[48;5;234m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'
CLEAR_LINE='\033[2K'
HIDE_CURSOR='\033[?25l'
SHOW_CURSOR='\033[?25h'

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
CONFIG_DIR="${HOME}/.config/econ-vibe"
PROJECTS_FILE="${CONFIG_DIR}/projects.json"
mkdir -p "${CONFIG_DIR}"

# ---------------------------------------------------------------------------
# Terminal cleanup on exit
# ---------------------------------------------------------------------------
cleanup() {
  tput cnorm 2>/dev/null || true   # show cursor
  tput rmcup 2>/dev/null || true   # restore screen
  tput sgr0  2>/dev/null || true   # reset attrs
  stty echo  2>/dev/null || true   # restore echo
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Terminal helpers
# ---------------------------------------------------------------------------
term_cols()  { tput cols;  }
term_rows()  { tput lines; }

# Move cursor to row,col (1-based)
cursor_at() { printf '\033[%d;%dH' "$1" "$2"; }

# Clear from cursor to end of line
clear_eol()  { printf '%b' "${CLEAR_LINE}"; }

# Print centered in $1 cols
center() {
  local text="$1" width="$2"
  local clean; clean="$(printf '%b' "${text}" | sed 's/\033\[[0-9;]*[mK]//g')"
  local len=${#clean}
  local pad=$(( (width - len) / 2 ))
  printf '%*s%b%*s' "${pad}" '' "${text}" $(( width - len - pad )) ''
}

# Repeat a character $2 times
repeat_char() {
  local char="$1" n="$2" result=""
  local i; for (( i=0; i<n; i++ )); do result+="${char}"; done
  printf '%s' "${result}"
}

# ---------------------------------------------------------------------------
# JSON helpers (python3, no jq needed)
# ---------------------------------------------------------------------------
json_get() {
  # json_get <file> <python_expr>  — e.g. json_get projects.json 'data[0]["name"]'
  python3 -c "
import json, sys
try:
    data = json.load(open('${1}'))
    print(${2})
except Exception as e:
    print('')
" 2>/dev/null || true
}

projects_load() {
  if [[ ! -f "${PROJECTS_FILE}" ]]; then
    echo '[]' > "${PROJECTS_FILE}"
  fi
  python3 -c "
import json
data = json.load(open('${PROJECTS_FILE}'))
for p in data:
    print(p.get('name',''), '|', p.get('slug',''), '|', p.get('type',''), '|',
          p.get('stack',''), '|', str(p.get('cost_today', 0.0)), '|',
          str(len(p.get('agents', {}))), '|', p.get('last_active',''))
" 2>/dev/null || true
}

projects_count() {
  python3 -c "
import json
try:
    data = json.load(open('${PROJECTS_FILE}'))
    print(len(data))
except:
    print(0)
" 2>/dev/null || echo 0
}

project_add() {
  # project_add <name> <slug> <path> <type> <stack> <goal> <users> <constraints> <agents_json>
  python3 - <<PYEOF
import json, os, datetime
f = '${PROJECTS_FILE}'
try:
    data = json.load(open(f))
except:
    data = []
data.append({
    "name":        "${1}",
    "slug":        "${2}",
    "path":        "${3}",
    "type":        "${4}",
    "stack":       "${5}",
    "goal":        "${6}",
    "users":       "${7}",
    "constraints": "${8}",
    "agents":      json.loads('${9}'),
    "cost_today":  0.0,
    "created":     datetime.date.today().isoformat(),
    "last_active": datetime.date.today().isoformat()
})
json.dump(data, open(f, 'w'), indent=2)
PYEOF
}

total_cost_today() {
  python3 -c "
import json
try:
    data = json.load(open('${PROJECTS_FILE}'))
    print('\${:.2f}'.format(sum(p.get('cost_today', 0.0) for p in data)))
except:
    print('\$0.00')
" 2>/dev/null || echo '$0.00'
}

# ---------------------------------------------------------------------------
# Service status checks
# ---------------------------------------------------------------------------
ruflo_status() {
  if npx ruflo@latest daemon status 2>/dev/null | grep -qi "running"; then
    printf "${GREEN}● running${RESET}"
  else
    printf "${GRAY}○ stopped${RESET}"
  fi
}

mcp_status() {
  # Return a short list of active MCPs
  local mcps
  mcps=$(claude mcp list 2>/dev/null | grep -c "●" 2>/dev/null || echo 0)
  printf "${CYAN}%s MCPs${RESET}" "${mcps}"
}

tmux_available() { command -v tmux &>/dev/null; }

# ---------------------------------------------------------------------------
# Spinner (Braille)
# ---------------------------------------------------------------------------
SPINNER_FRAMES=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
SPINNER_IDX=0
spinner_tick() {
  printf '%b' "${LPURPLE}${SPINNER_FRAMES[${SPINNER_IDX}]}${RESET}"
  SPINNER_IDX=$(( (SPINNER_IDX + 1) % ${#SPINNER_FRAMES[@]} ))
}

# ---------------------------------------------------------------------------
# Screen: HEADER (ASCII art)
# ---------------------------------------------------------------------------
draw_header() {
  local cols; cols=$(term_cols)

  printf '%b' "${PURPLE}"
  center "███████╗ ██████╗ ██████╗ ███╗" "${cols}"; echo
  center "██╔════╝██╔════╝██╔═══██╗████╗  ██╗ ██╗   ██╗██╗██████╗ " "${cols}"; echo
  center "█████╗  ██║     ██║   ██║██╔██╗ ██║ ██║   ██║██║██╔══██╗" "${cols}"; echo
  center "██╔══╝  ██║     ██║   ██║██║╚██╗██║ ╚██╗ ██╔╝██║██████╔╝" "${cols}"; echo
  center "███████╗╚██████╗╚██████╔╝██║ ╚████║  ╚████╔╝ ██║██╔══██╗" "${cols}"; echo
  center "╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═══╝  ╚═╝╚═════╝ " "${cols}"; echo
  printf '%b' "${RESET}"
  printf '%b' "${LGRAY}"; center "The AI Development Operating System" "${cols}"; echo
  printf '%b' "${RESET}"
  echo
}

# ---------------------------------------------------------------------------
# Screen: STATUS BAR (bottom line)
# ---------------------------------------------------------------------------
draw_statusbar() {
  local cols; cols=$(term_cols)
  local rows; rows=$(term_rows)
  local cost; cost=$(total_cost_today)

  cursor_at "${rows}" 1
  printf '%b' "${MUTED}"
  printf '  ruflo '; ruflo_status; printf '  '
  printf '%b' "${CYAN}"; printf 'context7 '; printf '%b' "${GREEN}●${RESET}  "
  printf '%b' "${CYAN}"; printf 'github '; printf '%b' "${GREEN}●${RESET}  "
  printf '%b' "${YELLOW}"; printf '%s today' "${cost}"
  printf '%b' "${RESET}"
}

# ---------------------------------------------------------------------------
# Screen: PROJECT LIST (main menu)
# ---------------------------------------------------------------------------

# Global nav state
SELECTED=0

draw_project_list() {
  local cols; cols=$(term_cols)
  local box_width=$(( cols - 4 ))

  # Read projects into arrays
  local -a pnames pslugs ptypes pstacks pcosts pagents
  local count=0
  while IFS='|' read -r name slug type stack cost agents last_active; do
    name="${name# }"; name="${name% }"
    slug="${slug# }"; slug="${slug% }"
    type="${type# }"; type="${type% }"
    stack="${stack# }"; stack="${stack% }"
    cost="${cost# }"; cost="${cost% }"
    agents="${agents# }"; agents="${agents% }"
    pnames[count]="${name}"
    pslugs[count]="${slug}"
    ptypes[count]="${type}"
    pstacks[count]="${stack}"
    pcosts[count]="${cost}"
    pagents[count]="${agents}"
    (( count++ )) || true
  done < <(projects_load)

  local total="${count}"
  local box_inner=$(( box_width - 2 ))

  # Box top
  printf '  %b╔%s╗%b\n' "${PURPLE}" "$(repeat_char '═' "${box_inner}")" "${RESET}"

  # Header row
  local header_left="  PROJECTS"
  local header_right="${total} active · ↑↓  "
  local header_mid=$(( box_inner - ${#header_left} - ${#header_right} - 4 ))
  printf '  %b║%b' "${PURPLE}" "${RESET}"
  printf '%b%b  PROJECTS%b' "${BOLD}" "${WHITE}" "${RESET}"
  printf '%*s' "${header_mid}" ''
  printf '%b%s%b' "${GRAY}" "${total} active · ↑↓" "${RESET}"
  printf '  %b║%b\n' "${PURPLE}" "${RESET}"

  # Divider
  printf '  %b╠%s╣%b\n' "${PURPLE}" "$(repeat_char '═' "${box_inner}")" "${RESET}"

  # Empty line
  printf '  %b║%b%*s%b║%b\n' "${PURPLE}" "${RESET}" "${box_inner}" '' "${PURPLE}" "${RESET}"

  # Project rows
  local i
  for (( i=0; i<count; i++ )); do
    local sel_marker="  "
    local row_bg=""
    local row_reset="${RESET}"
    local name_color="${LGRAY}"
    local meta_color="${GRAY}"
    local cost_color="${YELLOW}"

    if [[ "${i}" -eq "${SELECTED}" ]]; then
      sel_marker="${LPURPLE}▸ ${RESET}"
      row_bg="${BG_SEL}"
      name_color="${BG_SEL}${WHITE}${BOLD}"
      meta_color="${BG_SEL}${LGRAY}"
      cost_color="${BG_SEL}${YELLOW}"
    fi

    # Agent indicator
    local agent_str
    if [[ "${pagents[$i]}" -gt 0 ]]; then
      agent_str="${GREEN}●${RESET} ${pagents[$i]} agents"
    else
      agent_str="${GRAY}○ idle${RESET}"
    fi

    # Build left section: marker + name + stack
    local left_part
    left_part="$(printf '%-22s' "${pnames[$i]}")  $(printf '%-20s' "${pstacks[$i]}")"
    local right_part
    right_part="$(printf '%-14s' "${agent_str//\\033\[*m/}")  \$${pcosts[$i]}"

    # We need clean widths — just format directly
    printf '  %b║%b ' "${PURPLE}" "${RESET}"
    printf '%b' "${sel_marker}"
    printf '%b%-22b%b' "${name_color}" "${pnames[$i]}${RESET}" "${RESET}"
    printf '  '
    printf '%b%-20s%b' "${meta_color}" "${pstacks[$i]}" "${RESET}"
    printf '  '
    if [[ "${pagents[$i]}" -gt 0 ]]; then
      printf '%b● %s agents%b' "${GREEN}" "${pagents[$i]}" "${RESET}"
    else
      printf '%b○ idle%b     ' "${GRAY}" "${RESET}"
    fi
    printf '  %b$%s%b' "${cost_color}" "${pcosts[$i]}" "${RESET}"

    # Pad to box width and close
    local line_text="${pnames[$i]}  ${pstacks[$i]}"
    local approx_len=$(( ${#pnames[$i]} + 2 + ${#pstacks[$i]} + 2 + 12 + 2 + 6 + 2 + 4 ))
    local pad=$(( box_inner - approx_len - 2 ))
    [[ "${pad}" -lt 0 ]] && pad=0
    printf '%*s' "${pad}" ''
    printf ' %b║%b\n' "${PURPLE}" "${RESET}"
  done

  # Empty line
  printf '  %b║%b%*s%b║%b\n' "${PURPLE}" "${RESET}" "${box_inner}" '' "${PURPLE}" "${RESET}"

  # Divider
  printf '  %b║%b  %b%s%b  %b║%b\n' \
    "${PURPLE}" "${RESET}" \
    "${MUTED}" "$(repeat_char '─' $(( box_inner - 4 )))" "${RESET}" \
    "${PURPLE}" "${RESET}"

  # New project row
  printf '  %b║%b  %b+%b  New Project%*s%b║%b\n' \
    "${PURPLE}" "${RESET}" \
    "${CYAN}" "${RESET}" \
    $(( box_inner - 16 )) '' \
    "${PURPLE}" "${RESET}"

  # Footer divider
  printf '  %b╠%s╣%b\n' "${PURPLE}" "$(repeat_char '═' "${box_inner}")" "${RESET}"

  # Key hints
  printf '  %b║%b  ' "${PURPLE}" "${RESET}"
  printf '%b↑↓%b navigate  ' "${CYAN}" "${RESET}"
  printf '%b↵%b open  ' "${CYAN}" "${RESET}"
  printf '%bn%b new  ' "${CYAN}" "${RESET}"
  printf '%bm%b memory  ' "${CYAN}" "${RESET}"
  printf '%bq%b quit' "${CYAN}" "${RESET}"
  printf '%*s%b║%b\n' $(( box_inner - 48 )) '' "${PURPLE}" "${RESET}"

  printf '  %b╚%s╝%b\n' "${PURPLE}" "$(repeat_char '═' "${box_inner}")" "${RESET}"
}

# ---------------------------------------------------------------------------
# Wizard helpers
# ---------------------------------------------------------------------------

wizard_box_top() {
  local title="$1" step="$2" total="$3"
  local cols; cols=$(term_cols)
  local w=$(( cols - 4 ))
  local inner=$(( w - 2 ))
  local step_str="Step ${step}/${total}"
  local title_pad=$(( inner - ${#title} - ${#step_str} - 4 ))
  [[ "${title_pad}" -lt 1 ]] && title_pad=1
  printf '  %b┌─ %b%s%b %*s%b%s%b ─%s┐%b\n' \
    "${CYAN}" "${WHITE}${BOLD}" "${title}" "${RESET}" \
    "${title_pad}" '' \
    "${GRAY}" "${step_str}" "${RESET}" \
    "$(repeat_char '─' 0)" \
    "${RESET}"
}

wizard_box_bottom() {
  local cols; cols=$(term_cols)
  local w=$(( cols - 4 ))
  local inner=$(( w - 2 ))
  printf '  %b└%s┘%b\n' "${CYAN}" "$(repeat_char '─' "${inner}")" "${RESET}"
}

wizard_box_line() {
  # Print a blank inner line
  local cols; cols=$(term_cols)
  local w=$(( cols - 4 ))
  local inner=$(( w - 2 ))
  printf '  %b│%b%*s%b│%b\n' "${CYAN}" "${RESET}" "${inner}" '' "${CYAN}" "${RESET}"
}

wizard_box_text() {
  local text="$1"
  local cols; cols=$(term_cols)
  local w=$(( cols - 4 ))
  local inner=$(( w - 2 ))
  local clean="${text//\\033\[*m/}"
  local tlen=${#text}
  local pad=$(( inner - tlen - 2 ))
  [[ "${pad}" -lt 0 ]] && pad=0
  printf '  %b│%b  %b%*s%b│%b\n' "${CYAN}" "${RESET}" "${text}" "${pad}" '' "${CYAN}" "${RESET}"
}

# Text input field — returns value in INPUT_VALUE
wizard_input() {
  local prompt="$1"
  local cols; cols=$(term_cols)
  local w=$(( cols - 4 ))
  local inner=$(( w - 2 ))
  local field_w=$(( inner - 6 ))

  wizard_box_line
  wizard_box_text "${LGRAY}${prompt}${RESET}"
  wizard_box_line

  # Draw input box
  printf '  %b│%b  %b┌%s┐%b  %b│%b\n' \
    "${CYAN}" "${RESET}" "${MUTED}" "$(repeat_char '─' "${field_w}")" "${RESET}" "${CYAN}" "${RESET}"
  printf '  %b│%b  %b│%b ' "${CYAN}" "${RESET}" "${MUTED}" "${RESET}"

  # Read user input with echo
  tput cnorm
  stty echo
  INPUT_VALUE=""
  local char
  while true; do
    IFS= read -rsn1 char
    case "${char}" in
      $'\n'|$'\r') break ;;
      $'\177'|$'\b')
        if [[ -n "${INPUT_VALUE}" ]]; then
          INPUT_VALUE="${INPUT_VALUE%?}"
          printf '\b \b'
        fi
        ;;
      '') ;;  # ignore null
      *) INPUT_VALUE+="${char}"; printf '%s' "${char}" ;;
    esac
  done
  tput civis

  printf '\n'
  printf '  %b│%b  %b└%s┘%b  %b│%b\n' \
    "${CYAN}" "${RESET}" "${MUTED}" "$(repeat_char '─' "${field_w}")" "${RESET}" "${CYAN}" "${RESET}"
  wizard_box_line
}

# Menu selection — returns index in MENU_SEL
wizard_menu() {
  local -a options=("${@}")
  local count=${#options[@]}
  local sel=0

  tput civis
  while true; do
    # Redraw options
    local i
    for (( i=0; i<count; i++ )); do
      if [[ "${i}" -eq "${sel}" ]]; then
        printf '  %b│%b  %b▸  %b%b%s%b\n' \
          "${CYAN}" "${RESET}" "${LPURPLE}" "${RESET}" "${BG_SEL}${WHITE}" "${options[$i]}" "${RESET}"
      else
        printf '  %b│%b     %b%s%b\n' \
          "${CYAN}" "${RESET}" "${LGRAY}" "${options[$i]}" "${RESET}"
      fi
    done
    wizard_box_line

    # Move cursor back up to redraw on next keypress
    printf '\033[%dA' $(( count + 1 ))

    # Read key
    local key
    IFS= read -rsn1 key
    if [[ "${key}" == $'\033' ]]; then
      IFS= read -rsn2 -t 0.1 key || true
      case "${key}" in
        '[A') (( sel > 0 )) && (( sel-- )) || true ;;
        '[B') (( sel < count - 1 )) && (( sel++ )) || true ;;
      esac
    elif [[ "${key}" == $'\n' || "${key}" == $'\r' || "${key}" == '' ]]; then
      # Move cursor back down past the redrawn area
      printf '\033[%dB' $(( count + 1 ))
      MENU_SEL="${sel}"
      return 0
    fi
  done
}

# ---------------------------------------------------------------------------
# WIZARD: New Project (5 steps)
# ---------------------------------------------------------------------------

PROJECT_TYPES=(
  "DeFi / Smart Contracts    Solidity, Hardhat, L2"
  "Full Stack Web App        Next.js, Supabase, Auth"
  "Mobile App                React Native, Expo"
  "Backend API               Node.js, REST/GraphQL"
  "CLI Tool                  TypeScript, Commander"
  "Other / Custom            Describe manually"
)

PROJECT_TYPE_KEYS=("defi" "fullstack" "mobile" "backend" "cli" "custom")
PROJECT_STACKS=(
  "Solidity, Hardhat, React, Ethers.js"
  "Next.js, Supabase, TypeScript, Tailwind"
  "React Native, Expo, TypeScript"
  "Node.js, Express, TypeScript, Prisma"
  "TypeScript, Commander, Node.js"
  "Custom"
)

ARCH_BY_TYPE=(
  "Use upgradeable proxy pattern for contracts\n- Separate logic from storage\n- Always use OpenZeppelin libraries\n- Audit all external calls"
  "Use App Router with Server Components\n- Supabase for auth and data\n- Edge functions for APIs\n- TypeScript strict mode"
  "Expo managed workflow\n- React Query for data fetching\n- Zustand for client state\n- OTA updates via EAS"
  "RESTful with OpenAPI spec\n- JWT authentication\n- Repository pattern for data access\n- Structured logging"
  "Commander.js for CLI parsing\n- Ink for interactive output\n- Config in ~/.config/<name>\n- Publish to npm"
  "Document decisions as you go\n- Keep architecture evolving\n- Prefer composition over inheritance"
)

wizard_new_project() {
  local cols; cols=$(term_cols)

  # ---- Step 1: Name ----
  clear
  draw_header
  wizard_box_top "NEW PROJECT" 1 5
  wizard_box_line
  wizard_input "Project name"
  local proj_name="${INPUT_VALUE}"
  [[ -z "${proj_name}" ]] && return

  wizard_box_text "${DIM}${GRAY}This becomes your project directory and CLAUDE.md title${RESET}"
  wizard_box_line
  wizard_box_bottom
  sleep 0.3

  # ---- Step 2: Type ----
  clear
  draw_header
  wizard_box_top "NEW PROJECT" 2 5
  wizard_box_line
  wizard_box_text "${LGRAY}What are you building?${RESET}"
  wizard_box_line

  MENU_SEL=0
  wizard_menu "${PROJECT_TYPES[@]}"
  local type_idx="${MENU_SEL}"
  local proj_type="${PROJECT_TYPE_KEYS[$type_idx]}"
  local proj_stack="${PROJECT_STACKS[$type_idx]}"
  wizard_box_bottom

  # ---- Step 3: Details ----
  clear
  draw_header
  wizard_box_top "NEW PROJECT" 3 5
  wizard_box_line
  wizard_input "Main goal (one sentence)"
  local proj_goal="${INPUT_VALUE}"
  wizard_box_line
  wizard_input "Target users"
  local proj_users="${INPUT_VALUE}"
  wizard_box_line
  wizard_input "Key constraints (optional, press enter to skip)"
  local proj_constraints="${INPUT_VALUE}"
  wizard_box_bottom
  sleep 0.2

  # ---- Step 4: Agents ----
  clear
  draw_header
  wizard_box_top "NEW PROJECT" 4 5
  wizard_box_line
  wizard_box_text "${LGRAY}Select agent specialists  ${GRAY}←→ adjust count${RESET}"
  wizard_box_line

  local -a agent_names=("architect" "coder" "tester" "security")
  local -a agent_descs=("System design + decisions" "Implementation" "Tests + QA" "Security audits")
  local -a agent_counts=(1 2 1 0)
  local agent_sel=0
  local cols; cols=$(term_cols)
  local w=$(( cols - 4 ))
  local inner=$(( w - 2 ))

  tput civis
  while true; do
    local i
    for (( i=0; i<4; i++ )); do
      if [[ "${i}" -eq "${agent_sel}" ]]; then
        printf '  %b│%b  %b▸%b  %b◄ %-12s%b %b%d%b %b►%b  %b%s%b\n' \
          "${CYAN}" "${RESET}" \
          "${LPURPLE}" "${RESET}" \
          "${BG_SEL}${WHITE}" "${agent_names[$i]}" "${RESET}" \
          "${YELLOW}" "${agent_counts[$i]}" "${RESET}" \
          "${BG_SEL}${WHITE}" "${RESET}" \
          "${GRAY}" "${agent_descs[$i]}" "${RESET}"
      else
        printf '  %b│%b     %b  %-12s%b  %b%d%b    %b%s%b\n' \
          "${CYAN}" "${RESET}" \
          "${LGRAY}" "${agent_names[$i]}" "${RESET}" \
          "${LGRAY}" "${agent_counts[$i]}" "${RESET}" \
          "${GRAY}" "${agent_descs[$i]}" "${RESET}"
      fi
    done

    local total_agents=0
    for c in "${agent_counts[@]}"; do (( total_agents += c )) || true; done

    printf '  %b│%b\n' "${CYAN}" "${RESET}"
    printf '  %b│%b  %bTotal: %d agents%b          %b↵ confirm%b\n' \
      "${CYAN}" "${RESET}" \
      "${WHITE}" "${total_agents}" "${RESET}" \
      "${CYAN}" "${RESET}"
    printf '  %b│%b\n' "${CYAN}" "${RESET}"

    printf '\033[%dA' 7

    local key
    IFS= read -rsn1 key
    if [[ "${key}" == $'\033' ]]; then
      IFS= read -rsn2 -t 0.1 key || true
      case "${key}" in
        '[A') (( agent_sel > 0 )) && (( agent_sel-- )) || true ;;
        '[B') (( agent_sel < 3 )) && (( agent_sel++ )) || true ;;
        '[C')
          local cur="${agent_counts[$agent_sel]}"
          agent_counts[$agent_sel]=$(( cur + 1 ))
          ;;
        '[D')
          local cur="${agent_counts[$agent_sel]}"
          [[ "${cur}" -gt 0 ]] && agent_counts[$agent_sel]=$(( cur - 1 )) || true
          ;;
      esac
    elif [[ "${key}" == $'\n' || "${key}" == $'\r' || "${key}" == '' ]]; then
      printf '\033[%dB' 7
      break
    fi
  done

  wizard_box_bottom

  # Build agents JSON
  local agents_json="{"
  local first=1
  for (( i=0; i<4; i++ )); do
    [[ "${first}" -eq 0 ]] && agents_json+=","
    agents_json+="\"${agent_names[$i]}\":${agent_counts[$i]}"
    first=0
  done
  agents_json+="}"

  # ---- Step 5: Generate ----
  clear
  draw_header
  wizard_box_top "NEW PROJECT" 5 5
  wizard_box_line

  local slug
  slug="$(printf '%s' "${proj_name}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')"
  local proj_path="${HOME}/code/${slug}"
  local arch_notes="${ARCH_BY_TYPE[$type_idx]}"

  wizard_box_text "${LGRAY}Creating project: ${WHITE}${proj_name}${RESET}"
  wizard_box_line

  # Show spinner while generating
  local spin_steps=(
    "Creating project directory"
    "Generating CLAUDE.md"
    "Writing .claude/settings.json"
    "Saving project metadata"
    "Initializing Ruflo memory"
  )

  for step in "${spin_steps[@]}"; do
    printf '  %b│%b  ' "${CYAN}" "${RESET}"
    spinner_tick
    printf '  %b%s%b\n' "${LGRAY}" "${step}" "${RESET}"
    sleep 0.25
  done

  wizard_box_line

  # Create directory structure
  mkdir -p "${proj_path}/.claude" 2>/dev/null || true

  # Generate CLAUDE.md
  generate_claude_md \
    "${proj_path}/CLAUDE.md" \
    "${proj_name}" \
    "${PROJECT_TYPES[$type_idx]%  *}" \
    "${proj_stack}" \
    "${proj_goal}" \
    "${proj_users}" \
    "${proj_constraints}" \
    "${agents_json}" \
    "${arch_notes}"

  # Generate .claude/settings.json
  cat > "${proj_path}/.claude/settings.json" <<SETTINGS
{
  "mcpServers": {},
  "hooks": {
    "PostToolUse": ["npx ruflo@latest memory store --key 'last-tool' --value '{{tool}}' --namespace '${slug}'"],
    "Stop": ["npx ruflo@latest memory store --key 'session-end' --value '$(date -u +%Y-%m-%dT%H:%M:%SZ)' --namespace '${slug}'"]
  },
  "project": "${slug}"
}
SETTINGS

  # Save project to JSON
  project_add \
    "${proj_name}" "${slug}" "${proj_path}" \
    "${proj_type}" "${proj_stack}" \
    "${proj_goal}" "${proj_users}" "${proj_constraints}" \
    "${agents_json}"

  # Init Ruflo memory (non-blocking)
  npx ruflo@latest memory store \
    --key "project-${slug}" \
    --value "Project: ${proj_name} | Type: ${proj_type} | Goal: ${proj_goal}" \
    --namespace "${slug}" 2>/dev/null &

  wizard_box_text "${GREEN}${BOLD}Done!${RESET} ${LGRAY}Project created at ${WHITE}${proj_path}${RESET}"
  wizard_box_line
  wizard_box_text "${GRAY}Press any key to return to the project list...${RESET}"
  wizard_box_bottom

  IFS= read -rsn1 _
}

# ---------------------------------------------------------------------------
# Generate CLAUDE.md for a project
# ---------------------------------------------------------------------------
generate_claude_md() {
  local outfile="$1"
  local name="$2" type="$3" stack="$4" goal="$5"
  local users="$6" constraints="$7" agents_json="$8" arch_notes="$9"

  # Parse agent roles from JSON
  local roles=""
  roles+="- **QB (Quarterback):** Coordinates all agents, breaks down tasks\n"
  if echo "${agents_json}" | grep -q '"architect":[^0]'; then
    roles+="- **Architect:** System design, ADRs, patterns\n"
  fi
  local coder_count
  coder_count=$(echo "${agents_json}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('coder',0))" 2>/dev/null || echo 0)
  if [[ "${coder_count}" -gt 0 ]]; then
    if [[ "${coder_count}" -gt 1 ]]; then
      roles+="- **Coder (×${coder_count}):** Implementation, works in parallel\n"
    else
      roles+="- **Coder:** Implementation\n"
    fi
  fi
  if echo "${agents_json}" | grep -q '"tester":[^0]'; then
    roles+="- **Tester:** Tests, coverage, quality assurance\n"
  fi
  if echo "${agents_json}" | grep -q '"security":[^0]'; then
    roles+="- **Security:** Audits, vulnerability scanning, hardening\n"
  fi

  cat > "${outfile}" <<CLAUDE_MD
# ${name} — Claude Code Configuration

## Project Context
**Type:** ${type}
**Stack:** ${stack}
**Goal:** ${goal}
**Users:** ${users}

## Architecture Decisions
- $(printf '%b' "${arch_notes}" | tr '\n' '\n' | head -1)
$(printf '%b' "${arch_notes}" | tail -n +2 | sed 's/^/- /')

## Key Constraints
${constraints:-- No constraints specified}

## Agent Roles
$(printf '%b' "${roles}")
## Behavioral Rules
- Always check Ruflo memory before starting a task
- Save architectural decisions to memory after each session
- Use event sourcing for state changes
- Validate all inputs at system boundaries
- Never hardcode credentials or API keys
- Run tests after every code change
- Keep files under 500 lines

## Memory Integration
\`\`\`bash
# Search project memory
npx ruflo@latest memory search --query "[topic]" --namespace "$(printf '%s' "${name}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

# Store a decision
npx ruflo@latest memory store --key "decision-[topic]" --value "[decision]" --namespace "$(printf '%s' "${name}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
\`\`\`
CLAUDE_MD
}

# ---------------------------------------------------------------------------
# Open project in tmux workspace
# ---------------------------------------------------------------------------
open_project_workspace() {
  local name="$1" slug="$2" proj_path="$3" agents_json="$4"

  # Expand path
  proj_path="${proj_path/#\~/$HOME}"

  if ! tmux_available; then
    clear
    draw_header
    printf '%b\n  tmux is not installed. Install it with: brew install tmux\n%b\n' "${RED}" "${RESET}"
    printf '  Press any key to return...\n'
    IFS= read -rsn1 _
    return
  fi

  local session_name="econ-${slug}"

  # Kill existing session if present
  tmux kill-session -t "${session_name}" 2>/dev/null || true

  # Get agent counts
  local coder_count
  coder_count=$(echo "${agents_json}" | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read())
    print(d.get('coder', 1))
except:
    print(1)
" 2>/dev/null || echo 1)
  [[ "${coder_count}" -lt 1 ]] && coder_count=1

  # Create tmux session with QB pane
  tmux new-session -d -s "${session_name}" -x "$(term_cols)" -y "$(term_rows)"

  # Set tmux status bar
  tmux set-option -t "${session_name}" status-style "bg=colour235,fg=colour141"
  tmux set-option -t "${session_name}" status-left " #[fg=colour141,bold]QB #[fg=colour240]· #[fg=colour255]${name} #[fg=colour240]· #[fg=colour78]coordinating... "
  tmux set-option -t "${session_name}" status-right "#[fg=colour220]\$0.00  #[fg=colour240]$(date +%H:%M)"
  tmux set-option -t "${session_name}" status-left-length 60

  # Rename first window
  tmux rename-window -t "${session_name}:0" "workspace"

  # Send QB startup to first pane
  local qb_context=""
  if [[ -f "${proj_path}/CLAUDE.md" ]]; then
    qb_context="$(cat "${proj_path}/CLAUDE.md")"
  fi

  # Split: left column for architect, right column for coders
  tmux split-window -t "${session_name}:0" -h -p 65

  # Split right column for coders
  if [[ "${coder_count}" -ge 2 ]]; then
    tmux split-window -t "${session_name}:0.1" -v -p 50
  fi

  # Rename panes via title sequences
  tmux select-pane -t "${session_name}:0.0" -T "architect"
  tmux select-pane -t "${session_name}:0.1" -T "coder-1"
  [[ "${coder_count}" -ge 2 ]] && tmux select-pane -t "${session_name}:0.2" -T "coder-2" || true

  # Select QB (first pane = 0) and send greeting
  tmux select-pane -t "${session_name}:0.0"

  # Start claude in each pane with context
  local claude_cmd="cd \"${proj_path}\" && clear && printf '\\033[38;5;141m\\033[1m"
  tmux send-keys -t "${session_name}:0.0" \
    "cd \"${proj_path}\" && clear && echo '  architect ready' && claude --model claude-sonnet-4-5" \
    Enter

  tmux send-keys -t "${session_name}:0.1" \
    "cd \"${proj_path}\" && clear && echo '  coder-1 ready' && claude --model claude-sonnet-4-5" \
    Enter

  if [[ "${coder_count}" -ge 2 ]]; then
    tmux send-keys -t "${session_name}:0.2" \
      "cd \"${proj_path}\" && clear && echo '  coder-2 ready' && claude --model claude-sonnet-4-5" \
      Enter
  fi

  # Select first pane
  tmux select-pane -t "${session_name}:0.0"

  # Restore terminal before attaching
  cleanup
  tmux attach-session -t "${session_name}"

  # Re-enter alternate screen after detach
  tput smcup
  tput civis
}

# ---------------------------------------------------------------------------
# Memory viewer screen
# ---------------------------------------------------------------------------
show_memory() {
  clear
  draw_header

  local cols; cols=$(term_cols)
  local w=$(( cols - 4 ))
  local inner=$(( w - 2 ))

  printf '  %b╔%s╗%b\n' "${PURPLE}" "$(repeat_char '═' "${inner}")" "${RESET}"
  printf '  %b║%b  %b%bRUFLO MEMORY%b%*s%b║%b\n' \
    "${PURPLE}" "${RESET}" \
    "${BOLD}" "${WHITE}" "${RESET}" \
    $(( inner - 14 )) '' \
    "${PURPLE}" "${RESET}"
  printf '  %b╠%s╣%b\n' "${PURPLE}" "$(repeat_char '═' "${inner}")" "${RESET}"
  printf '  %b║%b\n' "${PURPLE}" "${RESET}"

  # Try to fetch memory
  local mem_output
  mem_output=$(npx ruflo@latest memory list --limit 20 2>/dev/null || echo "  (ruflo not running or no memory stored)")

  while IFS= read -r line; do
    printf '  %b║%b  %b%s%b\n' "${PURPLE}" "${RESET}" "${LGRAY}" "${line}" "${RESET}"
  done <<< "${mem_output}"

  printf '  %b║%b\n' "${PURPLE}" "${RESET}"
  printf '  %b╠%s╣%b\n' "${PURPLE}" "$(repeat_char '═' "${inner}")" "${RESET}"
  printf '  %b║%b  %bPress any key to return%b%*s%b║%b\n' \
    "${PURPLE}" "${RESET}" \
    "${GRAY}" "${RESET}" \
    $(( inner - 24 )) '' \
    "${PURPLE}" "${RESET}"
  printf '  %b╚%s╝%b\n' "${PURPLE}" "$(repeat_char '═' "${inner}")" "${RESET}"

  IFS= read -rsn1 _
}

# ---------------------------------------------------------------------------
# Get project data by index
# ---------------------------------------------------------------------------
get_project_field() {
  local idx="$1" field="$2"
  python3 -c "
import json
try:
    data = json.load(open('${PROJECTS_FILE}'))
    print(data[${idx}].get('${field}', ''))
except Exception as e:
    print('')
" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# MAIN LOOP
# ---------------------------------------------------------------------------
main() {
  # Enter alternate screen, hide cursor
  tput smcup
  tput civis

  while true; do
    clear
    draw_header
    draw_project_list
    draw_statusbar

    # Read a single keypress (handle arrow keys)
    local key
    IFS= read -rsn1 key

    if [[ "${key}" == $'\033' ]]; then
      # Escape sequence — read remainder
      IFS= read -rsn2 -t 0.1 key || true
      case "${key}" in
        '[A')  # Up
          local cnt; cnt=$(projects_count)
          if [[ "${cnt}" -gt 0 && "${SELECTED}" -gt 0 ]]; then
            (( SELECTED-- )) || true
          fi
          ;;
        '[B')  # Down
          local cnt; cnt=$(projects_count)
          if [[ "${cnt}" -gt 0 && "${SELECTED}" -lt $(( cnt - 1 )) ]]; then
            (( SELECTED++ )) || true
          fi
          ;;
      esac
    else
      case "${key}" in
        $'\n'|$'\r'|'')  # Enter — open selected project
          local cnt; cnt=$(projects_count)
          if [[ "${cnt}" -gt 0 ]]; then
            local pname pslugg ppath pagents_json
            pname=$(get_project_field "${SELECTED}" "name")
            pslugg=$(get_project_field "${SELECTED}" "slug")
            ppath=$(get_project_field "${SELECTED}" "path")
            pagents_json=$(python3 -c "
import json
try:
    data = json.load(open('${PROJECTS_FILE}'))
    import json as j
    print(j.dumps(data[${SELECTED}].get('agents', {})))
except:
    print('{}')
" 2>/dev/null || echo '{}')
            open_project_workspace "${pname}" "${pslugg}" "${ppath}" "${pagents_json}"
          fi
          ;;
        'n'|'N')  # New project
          wizard_new_project
          SELECTED=0
          ;;
        'm'|'M')  # Memory viewer
          show_memory
          ;;
        'q'|'Q')  # Quit
          cleanup
          exit 0
          ;;
      esac
    fi
  done
}

main "$@"
