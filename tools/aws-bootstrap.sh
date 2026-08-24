#!/usr/bin/env bash
# Runs once, as root, the first time the dev box boots. Puts the tools on it;
# leaves the two things that need a human — GitHub access and Claude Code
# sign-in — for the first SSH session, because both want a browser.
set -eux
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y git curl python3 ripgrep unzip

# Node 22 — Claude Code needs 18+, and there is no system Node worth using.
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g @anthropic-ai/claude-code

# gh, for cloning the private repo without pasting a token into a file.
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  -o /usr/share/keyrings/githubcli-archive-keyring.gpg
chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=arm64 signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  > /etc/apt/sources.list.d/github-cli.list
apt-get update -y && apt-get install -y gh

# What to do on first login, printed where it cannot be missed.
cat > /etc/profile.d/memory-quest-le.sh <<'MOTD'
if [ ! -d "$HOME/memory-quest-le" ]; then
  cat <<'TXT'

  Memory Quest LE dev box — two sign-ins to do once:

    gh auth login          # device code, paste it in a browser on your laptop
    gh repo clone ParseMeData/memory-quest-le
    claude                 # prints a URL; open it on your laptop to sign in

  Then, to see the game:
    cd memory-quest-le && python3 -m http.server 8080
    ...and open http://localhost:8080/index.html on your laptop, through the
    tunnel. The plate starts blank there: it is a new browser origin, so
    restore the town into it once with tools/snapshot.py.

TXT
fi
MOTD

touch /var/lib/cloud/mq-bootstrap-done
