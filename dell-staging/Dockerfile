FROM nginx:1.27-alpine
COPY dell-staging/default.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_UPSTREAM=127.0.0.1:8090 NGINX_ENVSUBST_FILTER=BACKEND_UPSTREAM
COPY dell-staging/index.html /usr/share/nginx/html/index.html
COPY dell-staging/dell-staging.js /usr/share/nginx/html/dell-staging.js
# Copy the *real* JK Works visual assets, not the original Supabase scripts.
COPY app/styles.css /usr/share/nginx/html/app/styles.css
COPY app/icons/ /usr/share/nginx/html/app/icons/
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
