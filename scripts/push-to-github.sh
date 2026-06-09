#!/usr/bin/env bash
# Run this from Replit Shell to connect and push to GitHub automatically.
# Requires: GITHUB_PERSONAL_ACCESS_TOKEN secret to be set in Replit.
set -euo pipefail

GITHUB_USER="ammouryali3-glitch"
GITHUB_REPO="souqrates"

echo "=== 1. Checking token ==="
# Accept token as argument or from env
if [ -n "${1:-}" ]; then
  GITHUB_PERSONAL_ACCESS_TOKEN="$1"
elif [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "Usage: bash scripts/push-to-github.sh ghp_YOUR_TOKEN_HERE"
  exit 1
fi

# Verify token works
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: token $GITHUB_PERSONAL_ACCESS_TOKEN" \
  https://api.github.com/user)

if [ "$STATUS" != "200" ]; then
  echo "❌ Token is invalid (HTTP $STATUS). Please create a new token at github.com/settings/tokens/new"
  exit 1
fi
echo "✅ Token valid"

echo ""
echo "=== 2. Generating SSH key ==="
rm -f ~/.ssh/github_replit ~/.ssh/github_replit.pub
ssh-keygen -t ed25519 -C "replit-auto" -f ~/.ssh/github_replit -N ""
echo "✅ SSH key generated"

echo ""
echo "=== 3. Adding SSH key to GitHub ==="
PUBKEY=$(cat ~/.ssh/github_replit.pub)
KEY_TITLE="replit-$(date +%Y%m%d%H%M%S)"

# Remove any existing replit keys to avoid duplicates
EXISTING=$(curl -s \
  -H "Authorization: token $GITHUB_PERSONAL_ACCESS_TOKEN" \
  https://api.github.com/user/keys | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

for KEY_ID in $EXISTING; do
  curl -s -X DELETE \
    -H "Authorization: token $GITHUB_PERSONAL_ACCESS_TOKEN" \
    "https://api.github.com/user/keys/$KEY_ID" > /dev/null
done

RESULT=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_PERSONAL_ACCESS_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/keys \
  -d "{\"title\":\"$KEY_TITLE\",\"key\":\"$PUBKEY\"}")

if echo "$RESULT" | grep -q '"id"'; then
  echo "✅ SSH key added to GitHub"
else
  echo "❌ Failed to add SSH key: $RESULT"
  exit 1
fi

echo ""
echo "=== 4. Configuring SSH ==="
mkdir -p ~/.ssh
cat > ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_replit
  StrictHostKeyChecking no
EOF
chmod 600 ~/.ssh/config
echo "✅ SSH configured"

echo ""
echo "=== 5. Testing GitHub SSH connection ==="
ssh -T git@github.com 2>&1 | head -1 || true

echo ""
echo "=== 6. Pushing to GitHub ==="
git remote set-url origin "git@github.com:$GITHUB_USER/$GITHUB_REPO.git" 2>/dev/null || \
  git remote add origin "git@github.com:$GITHUB_USER/$GITHUB_REPO.git"

git push -u origin main

echo ""
echo "✅ Done! Code is now on GitHub."
echo "   GitHub Actions will deploy automatically on every push."
