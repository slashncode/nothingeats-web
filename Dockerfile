# The SPA is built outside (CI builds nothingeats-ui and this app first); the image only serves it.
# No RUN steps, so multi-arch builds need no emulation.
FROM nginxinc/nginx-unprivileged:1.31.7-alpine-slim

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chmod=0755 nginx/40-nothingeats-env.sh /docker-entrypoint.d/40-nothingeats-env.sh
COPY dist/ /usr/share/nginx/html/
