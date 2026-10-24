#!/bin/sh
# Writes /env.js, the runtime configuration the SPA reads before it starts (src/config.ts).
# Runs from the nginx image's entrypoint; /tmp is the only writable path.
set -eu

escape() {
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g'
}

mkdir -p /tmp/runtime
cat > /tmp/runtime/env.js <<JS
window.__NOTHINGEATS__ = {
    posthogKey: "$(escape "${POSTHOG_KEY:-}")",
    posthogHost: "$(escape "${POSTHOG_HOST:-https://eu.i.posthog.com}")",
};
JS
echo "40-nothingeats-env.sh: wrote /tmp/runtime/env.js (PostHog $([ -n "${POSTHOG_KEY:-}" ] && echo on || echo off))"
