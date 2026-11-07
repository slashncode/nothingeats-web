#!/bin/sh
# Writes the runtime configuration at container start, from the nginx image's entrypoint
# (/tmp is the only writable path):
# - /env.js, which the SPA reads before it starts (src/config.ts);
# - the Content-Security-Policy, which names PostHog's origins only when PostHog is configured.
set -eu

escape() {
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g'
}

posthog_host="${POSTHOG_HOST:-https://eu.i.posthog.com}"

mkdir -p /tmp/runtime
cat > /tmp/runtime/env.js <<JS
window.__NOTHINGEATS__ = {
    posthogKey: "$(escape "${POSTHOG_KEY:-}")",
    posthogHost: "$(escape "$posthog_host")",
};
JS

# posthog-js talks to the API host and loads its extensions (recordings, surveys) from the assets
# host next to it: eu.i.posthog.com -> eu-assets.i.posthog.com. A proxy on our own domain serves both.
posthog=""
if [ -n "${POSTHOG_KEY:-}" ]; then
    origin=$(printf '%s' "$posthog_host" | sed -E 's#^(https?://[A-Za-z0-9.-]+(:[0-9]+)?)(/.*)?$#\1#')
    if ! printf '%s' "$origin" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$'; then
        echo "40-nothingeats-env.sh: POSTHOG_HOST must be an http(s) URL, got: $posthog_host" >&2
        exit 1
    fi
    assets=$(printf '%s' "$origin" | sed -E 's#^https://([a-z]+)\.i\.posthog\.com$#https://\1-assets.i.posthog.com#')
    posthog="$origin"
    if [ "$assets" != "$origin" ]; then
        posthog="$origin $assets"
    fi
fi

# Map tiles, glyphs and sprites come from OpenFreeMap (nothingeats-ui's DeliveryMap). Inline
# styles stay allowed: React Aria, MapLibre and PostHog's surveys set them; scripts never inline.
csp="default-src 'self'; script-src 'self' $posthog; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://tiles.openfreemap.org $posthog; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
csp=$(printf '%s' "$csp" | sed -E 's/ +;/;/g')
printf 'add_header Content-Security-Policy "%s" always;\n' "$csp" > /tmp/runtime/csp.conf

echo "40-nothingeats-env.sh: wrote /tmp/runtime/env.js and csp.conf (PostHog $([ -n "$posthog" ] && echo "$posthog" || echo off))"
