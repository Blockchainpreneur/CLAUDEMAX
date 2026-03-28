#!/usr/bin/env bash
# CLAUDEMAX ─ The AI Development Operating System
# Pure Bash TUI  │  256-color  │  Tmux workspaces
# ──────────────────────────────────────────────────────────────────────────────

# ── Guard ─────────────────────────────────────────────────────────────────────
[[ -t 0 && -t 1 ]] || { echo "CLAUDEMAX requires a real terminal." >&2; exit 1; }

# NO set -e  ← intentional: TUI scripts must never die on non-zero subcommands

# ── Cleanup ───────────────────────────────────────────────────────────────────
_exit() {
  printf '\033[?25h'     # show cursor
  printf '\033[?1049l'   # leave alternate screen
  printf '\033[0m'       # reset colors
  stty echo 2>/dev/null
  rm -f /tmp/ev-ruflo.tmp /tmp/ev-spin.pid
}
trap _exit EXIT INT TERM HUP

# ── Init ──────────────────────────────────────────────────────────────────────
printf '\033[?1049h'     # enter alternate screen
printf '\033[?25l'       # hide cursor
printf '\033[2J'         # clear
stty -echo 2>/dev/null

# ── Palette (256-color ANSI) ──────────────────────────────────────────────────
P='\033[38;5;99m'    # purple  – brand
V='\033[38;5;141m'   # violet  – accent
C='\033[38;5;75m'    # cyan    – interactive
G='\033[38;5;78m'    # green   – success
Y='\033[38;5;220m'   # yellow  – cost / money
R='\033[38;5;203m'   # red     – error
A='\033[38;5;241m'   # ash     – secondary text
L='\033[38;5;250m'   # light   – body text
W='\033[38;5;255m'   # white   – headers
M='\033[38;5;238m'   # muted   – borders
S='\033[48;5;55m'    # sel bg  – selected row
B='\033[1m'          # bold
D='\033[2m'          # dim
Z='\033[0m'          # reset

# ── Key reading ───────────────────────────────────────────────────────────────
getkey() {
  local k a b
  IFS= read -rsn1 k
  if [[ $k == $'\033' ]]; then
    IFS= read -rsn1 -t 0.05 a 2>/dev/null || a=''
    IFS= read -rsn1 -t 0.05 b 2>/dev/null || b=''
    k="$k$a$b"
  fi
  printf '%s' "$k"
}
K_UP=$'\033[A'
K_DN=$'\033[B'
K_RT=$'\033[C'
K_LT=$'\033[D'
K_EN=$'\n'
K_CR=$'\r'

# ── Terminal size (refreshed before each draw) ─────────────────────────────────
TW=80; TH=24
rsz() { TW=$(tput cols); TH=$(tput lines); }

# ── Cursor positioning (1-based row col) ─────────────────────────────────────
at() { printf '\033[%d;%dH' "$1" "$2"; }

# ── Repeat a character N times ─────────────────────────────────────────────────
rep() {
  local c="$1" n="$2" s=''
  local i; for ((i=0;i<n;i++)); do s+="$c"; done
  printf '%s' "$s"
}

# ── Config & project storage ───────────────────────────────────────────────────
CFG="$HOME/.config/econ-vibe"
PF="$CFG/projects.json"
mkdir -p "$CFG"
[[ -f "$PF" ]] || printf '[]' >"$PF"

_py_load() {
  python3 - "$PF" <<'PY'
import json, sys
try:    data = json.load(open(sys.argv[1]))
except: data = []
for p in data:
    print("{}|{}|{}|{:.2f}".format(
        p.get('name','?'), p.get('stack','?'),
        p.get('type','?'),  p.get('cost_today', 0.0)))
PY
}

_py_save() {
  # args: name type stack path goal
  python3 - "$PF" "$1" "$2" "$3" "$4" "$5" <<'PY'
import json, sys, datetime
pf,name,typ,stack,path,goal = sys.argv[1:]
try:    data = json.load(open(pf))
except: data = []
data.append({"name":name,"type":typ,"stack":stack,"path":path,
             "goal":goal,"cost_today":0.0,
             "created":datetime.date.today().isoformat(),
             "last_active":datetime.date.today().isoformat()})
json.dump(data, open(pf,'w'), indent=2)
PY
}

# ── Project arrays ─────────────────────────────────────────────────────────────
declare -a PN PS PT PC   # name stack type cost
PC_COUNT=0

reload() {
  PN=(); PS=(); PT=(); PC=(); PC_COUNT=0
  while IFS='|' read -r n s t c; do
    PN+=("$n"); PS+=("$s"); PT+=("$t"); PC+=("$c")
    (( PC_COUNT++ )) || true
  done < <(_py_load)
}

# ── Ruflo status (async, cached) ───────────────────────────────────────────────
RUFLO_OK=0
_last_check=0

_check_ruflo_bg() {
  (
    if npx ruflo@latest daemon status 2>/dev/null | grep -qi running; then
      printf '1'
    else
      printf '0'
    fi
  ) > /tmp/ev-ruflo.tmp 2>/dev/null &
}

_update_ruflo() {
  local now; now=$(date +%s)
  if (( now - _last_check > 30 )); then
    _last_check=$now
    _check_ruflo_bg
  fi
  if [[ -f /tmp/ev-ruflo.tmp ]]; then
    local v; v=$(cat /tmp/ev-ruflo.tmp 2>/dev/null)
    [[ $v == '1' ]] && RUFLO_OK=1 || RUFLO_OK=0
  fi
}

# ── Box layout constants ───────────────────────────────────────────────────────
# Box is centered, max 76 wide
# Fixed column offsets inside the box (relative to box left edge):
#   0        = left border │
#   1        = space
#   2-3      = sel marker (▶  or   )
#   4        = space
#   5-26     = name (22 chars)
#   27-28    = gap
#   29-44    = stack (16 chars)
#   45-46    = gap
#   47-52    = status (6 chars)
#   53-54    = gap
#   55-60    = cost (6 chars)
#   61-BW-2  = right padding
#   BW-1     = right border │

_draw_box_row_project() {
  # args: box_col box_row in_width idx is_selected
  local bc=$1 br=$2 iw=$3 i=$4 sel=$5

  at "$br" "$bc"
  printf "${M}│${Z}"

  local name="${PN[$i]:0:22}"
  local stk="${PS[$i]:0:16}"
  local cst="${PC[$i]}"

  if [[ $sel -eq 1 ]]; then
    # full-width purple highlight
    printf "${S}${W}${B}"
    printf "  ▶  %-22s  %-16s  ○ idle  \$%-5s" "$name" "$stk" "$cst"
    # right-pad to fill inner width (5+22+2+16+2+6+2+6 = 61 visible)
    local used=$(( 2 + 3 + 1 + 22 + 2 + 16 + 2 + 6 + 2 + 1 + ${#cst} ))
    local rpad=$(( iw - used ))
    (( rpad < 0 )) && rpad=0
    printf "%${rpad}s${Z}"
  else
    printf "  ${D}${A}●${Z}  ${L}%-22s${Z}  ${A}%-16s${Z}  ${A}○ idle${Z}  ${Y}\$%-5s${Z}" \
      "$name" "$stk" "$cst"
    local used2=$(( 2 + 3 + 1 + 22 + 2 + 16 + 2 + 6 + 2 + 1 + ${#cst} ))
    local rpad2=$(( iw - used2 ))
    (( rpad2 < 0 )) && rpad2=0
    printf "%${rpad2}s"
  fi

  printf "${M}│${Z}"
}

# ── SCREEN: Main menu ─────────────────────────────────────────────────────────
SEL=0   # 0..PC_COUNT  (PC_COUNT = New Project row)

draw_menu() {
  rsz
  _update_ruflo

  # Box geometry
  local BW=$(( TW < 80 ? TW - 2 : 76 ))
  local IN=$(( BW - 2 ))
  local BC=$(( (TW - BW) / 2 + 1 ))   # box start col

  # Rows needed: logo(6) + gap(1) + sub(1) + gap(2) + header(1) +
  #              divider(1) + blank(1) + projects(PC_COUNT) + blank(1) +
  #              thin-div(1) + newproj(1) + blank(1) + divider(1) + hints(1) + bottom(1)
  # = 20 + PC_COUNT
  local BOX_H=$(( 19 + PC_COUNT ))
  local BR=$(( (TH - BOX_H) / 2 ))
  (( BR < 1 )) && BR=1

  # ── Clear ──
  printf '\033[2J'

  # ── Logo (above box) ──
  local lr=$(( BR - 7 ))
  if (( lr >= 1 )); then
    at "$lr"     1; printf "$(printf '%*s' $(((TW-30)/2)) '')${P}${B}███████╗ ██████╗ ██████╗ ███╗${Z}"
    at "$((lr+1))" 1; printf "$(printf '%*s' $(((TW-36)/2)) '')${P}${B}██╔════╝██╔════╝██╔═══██╗████╗  ██╗${Z}"
    at "$((lr+2))" 1; printf "$(printf '%*s' $(((TW-37)/2)) '')${P}${B}█████╗  ██║     ██║   ██║██╔██╗ ██║${Z}${V}${B} ·vibe${Z}"
    at "$((lr+3))" 1; printf "$(printf '%*s' $(((TW-37)/2)) '')${P}${B}██╔══╝  ██║     ██║   ██║██║╚██╗██║${Z}"
    at "$((lr+4))" 1; printf "$(printf '%*s' $(((TW-37)/2)) '')${P}${B}███████╗╚██████╗╚██████╔╝██║ ╚████║${Z}"
    at "$((lr+5))" 1; printf "$(printf '%*s' $(((TW-37)/2)) '')${P}${B}╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝${Z}"
    at "$((lr+6))" 1
    local sub="The AI Development Operating System"
    printf "$(printf '%*s' $(((TW-${#sub})/2)) '')${D}${A}${sub}${Z}"
  else
    # Small terminal: inline compact header
    at "$BR" "$BC"
    printf "${M}│${Z} ${P}${B}CLAUDEMAX${Z}${D}${A} — AI Development OS${Z}"
  fi

  # ── Box top ──
  at "$BR"         "$BC"; printf "${M}╔$(rep '═' $IN)╗${Z}"
  local r=$(( BR + 1 ))

  # ── PROJECTS header ──
  at "$r" "$BC"
  printf "${M}║${Z}${W}${B}  PROJECTS${Z}"
  printf "$(printf '%*s' $(( IN - 10 - 14 )) '')"
  printf "${D}${A}${PC_COUNT} project(s)  ↑↓${Z}  ${M}║${Z}"
  (( r++ ))

  # ── Divider ──
  at "$r" "$BC"; printf "${M}╠$(rep '═' $IN)╣${Z}"; (( r++ ))

  # ── Empty ──
  at "$r" "$BC"; printf "${M}│$(printf '%*s' $IN '')│${Z}"; (( r++ ))

  # ── Project rows ──
  local i
  for (( i=0; i<PC_COUNT; i++ )); do
    local is_sel=0; [[ $i -eq $SEL ]] && is_sel=1
    _draw_box_row_project "$BC" "$r" "$IN" "$i" "$is_sel"
    (( r++ ))
  done

  # ── Empty ──
  at "$r" "$BC"; printf "${M}│$(printf '%*s' $IN '')│${Z}"; (( r++ ))

  # ── Thin divider ──
  at "$r" "$BC"; printf "${M}╟$(rep '─' $IN)╢${Z}"; (( r++ ))

  # ── New Project row ──
  at "$r" "$BC"; printf "${M}│${Z}"
  if [[ $SEL -eq $PC_COUNT ]]; then
    local np="  ▶  + New Project"
    printf "${S}${C}${B}${np}$(printf '%*s' $(( IN - ${#np} )) '')${Z}"
  else
    printf "${C}  +  New Project$(printf '%*s' $(( IN - 16 )) '')${Z}"
  fi
  printf "${M}│${Z}"; (( r++ ))

  # ── Empty ──
  at "$r" "$BC"; printf "${M}│$(printf '%*s' $IN '')│${Z}"; (( r++ ))

  # ── Footer divider ──
  at "$r" "$BC"; printf "${M}╠$(rep '═' $IN)╣${Z}"; (( r++ ))

  # ── Key hints ──
  at "$r" "$BC"
  printf "${M}║${Z}  ${C}↑↓${Z} navigate  ${C}↵${Z} open  ${C}n${Z} new  ${C}m${Z} memory  ${C}q${Z} quit"
  printf "$(printf '%*s' $(( IN - 47 )) '')${M}║${Z}"; (( r++ ))

  # ── Box bottom ──
  at "$r" "$BC"; printf "${M}╚$(rep '═' $IN)╝${Z}"

  # ── Status bar ──
  at "$TH" 1
  printf "  ${M}ruflo ${Z}"
  if [[ $RUFLO_OK -eq 1 ]]; then printf "${G}● running${Z}"; else printf "${A}○ stopped${Z}"; fi
  printf "  ${M}context7 ${G}●${Z}  ${M}github ${G}●${Z}"
  printf '\033[K'   # clear rest of line
}

# ── SCREEN: Wizard ────────────────────────────────────────────────────────────
# State vars filled by wizard
WZ_NAME=''; WZ_TYPE=''; WZ_STACK=''; WZ_GOAL=''

declare -a TYPE_LABELS=("DeFi / Smart Contracts" "Full Stack Web App" "Mobile App" "Backend API" "CLI Tool" "Other / Custom")
declare -a TYPE_STACKS=("Solidity, Hardhat, React" "Next.js, Supabase, TypeScript" "React Native, Expo" "Node.js, REST/GraphQL" "TypeScript, Commander" "Custom")
declare -a TYPE_TYPES=("defi" "fullstack" "mobile" "api" "cli" "custom")

_wz_header() {
  local step="$1" title="$2"
  rsz
  printf '\033[2J'
  at 2 1
  local pad=$(( (TW - 52) / 2 ))
  (( pad < 0 )) && pad=0
  printf "%${pad}s${P}${B}CLAUDEMAX${Z}${D}${A}  New Project${Z}  ${M}Step ${step}/4${Z}\n"
  printf "\n%${pad}s${W}${B}${title}${Z}\n\n"
}

_wz_text_input() {
  # $1=prompt $2=hint  → prints result on stdout
  local prompt="$1" hint="$2"
  rsz
  local pad=$(( (TW - 60) / 2 ))
  (( pad < 0 )) && pad=0
  local val=''

  # Show hint
  printf "%${pad}s${D}${A}${hint}${Z}\n\n"
  printf "%${pad}s${M}┌$(rep '─' 56)┐${Z}\n"
  printf "%${pad}s${M}│${Z} "

  # Save cursor pos
  local row; row=$(tput lines); row=$(( row / 2 + 3 ))
  printf '\033[s'   # save cursor
  stty echo 2>/dev/null

  local input_col=$(( pad + 3 ))
  local input_row=7   # approximate

  # Inline read with backspace handling
  stty -echo 2>/dev/null
  printf '\033[?25h'   # show cursor for input
  while true; do
    local k
    IFS= read -rsn1 k
    if [[ $k == $'\177' || $k == $'\b' ]]; then
      if [[ ${#val} -gt 0 ]]; then
        val="${val%?}"
        printf '\b \b'
      fi
    elif [[ $k == $'\n' || $k == $'\r' ]]; then
      break
    elif [[ $k == $'\033' ]]; then
      # Swallow escape sequences
      IFS= read -rsn1 -t 0.05 2>/dev/null || true
      IFS= read -rsn1 -t 0.05 2>/dev/null || true
    else
      val+="$k"
      printf '%s' "$k"
    fi
  done
  printf '\033[?25l'   # hide cursor again
  stty -echo 2>/dev/null

  printf "\n%${pad}s${M}└$(rep '─' 56)┘${Z}\n"
  printf '%s' "$val"
}

_wz_menu() {
  # $1=prompt, rest=options  → prints selected index on stdout
  local prompt="$1"; shift
  local -a opts=("$@")
  local sel=0
  local n=${#opts[@]}

  rsz
  local pad=$(( (TW - 60) / 2 ))
  (( pad < 0 )) && pad=0

  while true; do
    printf '\033[2J'
    at 1 1

    # Re-print header context (caller drew it)
    printf "\n%${pad}s${D}${A}${prompt}${Z}\n\n"

    local i
    for (( i=0; i<n; i++ )); do
      if [[ $i -eq $sel ]]; then
        printf "%${pad}s${S}${W}${B}  ▶  %-52s${Z}\n" '' "${opts[$i]}"
      else
        printf "%${pad}s${A}     %-52s${Z}\n" '' "${opts[$i]}"
      fi
    done

    printf "\n%${pad}s${D}${A}↑↓ select   ↵ confirm${Z}\n"

    local k; k=$(getkey)
    case "$k" in
      "$K_UP")   (( sel > 0 )) && (( sel-- )) ;;
      "$K_DN")   (( sel < n-1 )) && (( sel++ )) ;;
      "$K_EN"|"$K_CR") break ;;
      q|Q) printf '-1'; return ;;
    esac
  done
  printf '%d' "$sel"
}

run_wizard() {
  # ── Step 1: Name ──────────────────────────────────────────────────
  _wz_header "1" "What is your project called?"
  at 6 1
  WZ_NAME=$(_wz_text_input "Project name" "This becomes your directory name and CLAUDE.md title")
  WZ_NAME="${WZ_NAME//[^a-zA-Z0-9 _-]/}"
  [[ -z "$WZ_NAME" ]] && return 1

  # ── Step 2: Type ──────────────────────────────────────────────────
  printf '\033[2J'; at 1 1
  _wz_header "2" "What are you building?"
  local type_idx
  type_idx=$(_wz_menu "Choose the project type:" "${TYPE_LABELS[@]}")
  [[ $type_idx == '-1' ]] && return 1

  WZ_TYPE="${TYPE_TYPES[$type_idx]}"
  WZ_STACK="${TYPE_STACKS[$type_idx]}"

  # ── Step 3: Goal ──────────────────────────────────────────────────
  printf '\033[2J'; at 1 1
  _wz_header "3" "What is the main goal of this project?"
  at 6 1
  WZ_GOAL=$(_wz_text_input "One sentence goal" "Keep it short — this goes into your CLAUDE.md context")
  [[ -z "$WZ_GOAL" ]] && WZ_GOAL="To be defined"

  # ── Step 4: Generate ──────────────────────────────────────────────
  printf '\033[2J'
  rsz
  at $(( TH/2 - 2 )) 1
  local slug; slug=$(printf '%s' "$WZ_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  local proj_path="$HOME/code/${slug}"

  printf "$(printf '%*s' $(((TW-30)/2)) '')${V}⠿${Z} Creating project structure...\n"

  # Create directory
  mkdir -p "${proj_path}/.claude"

  # Generate CLAUDE.md
  cat > "${proj_path}/CLAUDE.md" <<MDEOF
# ${WZ_NAME} — Claude Code Configuration

## Project Context
**Type:** ${TYPE_LABELS[$type_idx]}
**Stack:** ${WZ_STACK}
**Goal:** ${WZ_GOAL}

## Architecture
$(case "$WZ_TYPE" in
  defi)      echo "- Solidity contracts in /contracts\n- Hardhat for testing and deployment\n- React frontend with ethers.js\n- All contracts must be audited before deploy" ;;
  fullstack) echo "- Next.js App Router for frontend\n- Supabase for database and auth\n- TypeScript throughout\n- API routes in /app/api" ;;
  mobile)    echo "- React Native with Expo\n- TypeScript strict mode\n- Navigation via expo-router\n- State management with Zustand" ;;
  api)       echo "- Node.js with TypeScript\n- REST or GraphQL API\n- Input validation at every boundary\n- JWT authentication" ;;
  cli)       echo "- TypeScript compiled to JS\n- Commander.js for argument parsing\n- Published to npm" ;;
  *)         echo "- Custom architecture — define as you go" ;;
esac)

## Behavioral Rules
- Always check Ruflo memory before starting a task
- Save architectural decisions to memory after each session
- Never hardcode credentials or API keys
- Validate all user input at system boundaries
- Run tests before committing

## Agent Setup
- **QB:** Coordinates all agents, breaks down tasks
- **Architect:** System design and ADRs
- **Coder:** Implementation
- **Tester:** Tests and QA
MDEOF

  # Save to projects list
  _py_save "$WZ_NAME" "$WZ_TYPE" "$WZ_STACK" "$proj_path" "$WZ_GOAL"

  printf "$(printf '%*s' $(((TW-30)/2)) '')${G}✓${Z} Project created at ${L}${proj_path}${Z}\n"
  printf "$(printf '%*s' $(((TW-30)/2)) '')${G}✓${Z} CLAUDE.md generated\n"
  printf "$(printf '%*s' $(((TW-30)/2)) '')${G}✓${Z} Added to CLAUDEMAX\n\n"
  printf "$(printf '%*s' $(((TW-34)/2)) '')${D}${A}Press any key to return to menu...${Z}"

  getkey > /dev/null
  reload
  SEL=0
}

# ── SCREEN: Memory viewer ─────────────────────────────────────────────────────
run_memory() {
  rsz
  printf '\033[2J'
  at 2 1

  local pad=$(( (TW - 60) / 2 ))
  (( pad < 0 )) && pad=0

  printf "%${pad}s${P}${B}CLAUDEMAX${Z}  ${W}Ruflo Memory${Z}\n\n"

  local proj_name=''
  [[ $SEL -lt $PC_COUNT ]] && proj_name="${PN[$SEL]}"

  if [[ -n "$proj_name" ]]; then
    printf "%${pad}s${D}${A}Project: ${L}${proj_name}${Z}\n\n"
  fi

  printf "%${pad}s${M}Searching memory...${Z}\n"
  local query="${proj_name:-recent patterns}"

  local results
  results=$(npx ruflo@latest memory search --query "$query" --limit 10 2>/dev/null \
    || printf "${R}Ruflo memory unavailable${Z}")

  printf '\033[2J'; at 2 1
  printf "%${pad}s${P}${B}CLAUDEMAX${Z}  ${W}Ruflo Memory${Z}\n\n"
  [[ -n "$proj_name" ]] && printf "%${pad}s${D}${A}Project: ${L}${proj_name}${Z}\n\n"

  local BW=$(( TW < 80 ? TW - 2 : 76 ))
  local IN=$(( BW - 2 ))
  local BC=$(( (TW - BW) / 2 + 1 ))

  at "$((TH/2 - 8))" "$BC"; printf "${M}╔$(rep '═' $IN)╗${Z}"
  local r=$(( TH/2 - 7 ))

  while IFS= read -r line; do
    [[ $r -ge $(( TH - 3 )) ]] && break
    at "$r" "$BC"
    printf "${M}│${Z} ${L}%-${IN}s${Z}${M}│${Z}"
    # truncate line to IN-2 width
    (( r++ ))
  done <<< "${results:-No memories found yet. Start using Claude Code to build up context.}"

  at "$r" "$BC"; printf "${M}╚$(rep '═' $IN)╝${Z}"

  at $(( TH - 1 )) 1
  printf "  ${D}${A}Press any key to return...${Z}"
  getkey > /dev/null
}

# ── SCREEN: Tmux workspace ────────────────────────────────────────────────────
launch_project() {
  local idx=$1
  local name="${PN[$idx]}"
  local slug; slug=$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  local sess="ev-${slug}"

  # Restore terminal before handing over to tmux
  printf '\033[?25h\033[?1049l\033[0m'
  stty echo 2>/dev/null

  if command -v tmux &>/dev/null; then
    if tmux has-session -t "$sess" 2>/dev/null; then
      tmux attach-session -t "$sess"
    else
      local proj_path="$HOME/code/${slug}"
      [[ -d "$proj_path" ]] || proj_path="$HOME"

      tmux new-session -d -s "$sess" -x "$TW" -y "$TH" -c "$proj_path"

      # Style the status bar
      tmux set-option -t "$sess" status-style "bg=#1a1a2e,fg=#eaeaea"
      tmux set-option -t "$sess" status-left "#[bold,fg=#5865f2] CLAUDEMAX #[default,fg=#444444] │ #[fg=#aaaaaa]${name}  "
      tmux set-option -t "$sess" status-right "#[fg=#444444]%H:%M "
      tmux set-option -t "$sess" status-left-length 40

      # QB pane (top, full width)
      tmux send-keys -t "$sess" "echo ''; echo '  ${name} — QB (Quarterback)'; echo '  Coordinates all agents and breaks down tasks'; echo ''; claude --model claude-sonnet-4-5" Enter

      # Split for specialists if project has a CLAUDE.md
      local agent_pane
      tmux split-window -t "$sess" -v -p 40 -c "$proj_path"
      tmux send-keys -t "$sess" "echo '  Specialist agent ready'; claude --model claude-sonnet-4-5" Enter

      tmux split-window -t "$sess" -h -c "$proj_path"
      tmux send-keys -t "$sess" "echo '  Specialist agent ready'; claude --model claude-sonnet-4-5" Enter

      # Focus top pane
      tmux select-pane -t "${sess}:0.0"
      tmux attach-session -t "$sess"
    fi
  else
    # No tmux — just cd to project and open claude
    printf '\033[?1049h\033[?25l\033[2J'
    stty -echo 2>/dev/null
    rsz
    at $(( TH/2 )) 1
    local pad=$(( (TW-50)/2 ))
    printf "%${pad}s${R}tmux not found.${Z} Install with: ${C}brew install tmux${Z}\n"
    printf "%${pad}s${D}${A}Press any key...${Z}"
    getkey > /dev/null
    return
  fi

  # Re-enter TUI after tmux detach
  printf '\033[?1049h\033[?25l\033[2J'
  stty -echo 2>/dev/null
}

# ── Main loop ─────────────────────────────────────────────────────────────────
reload
SEL=0
SCREEN="menu"

# Kick off first ruflo check in background
_check_ruflo_bg

while true; do
  case "$SCREEN" in
    menu)
      draw_menu
      k=$(getkey)
      total=$(( PC_COUNT + 1 ))   # projects + New Project

      case "$k" in
        "$K_UP")
          (( SEL > 0 )) && (( SEL-- )) || SEL=$(( total - 1 ))
          ;;
        "$K_DN")
          (( SEL < total - 1 )) && (( SEL++ )) || SEL=0
          ;;
        "$K_EN"|"$K_CR")
          if [[ $SEL -eq $PC_COUNT ]]; then
            SCREEN="wizard"
          elif [[ $PC_COUNT -gt 0 ]]; then
            launch_project "$SEL"
          fi
          ;;
        n|N) SCREEN="wizard" ;;
        m|M) SCREEN="memory" ;;
        r|R) reload ;;
        q|Q) exit 0 ;;
      esac
      ;;

    wizard)
      run_wizard && true || true
      SCREEN="menu"
      ;;

    memory)
      run_memory
      SCREEN="menu"
      ;;
  esac
done
