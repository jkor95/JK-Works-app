FROM nginx:1.27-alpine
COPY dell-staging/default.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_UPSTREAM=127.0.0.1:8090 NGINX_ENVSUBST_FILTER=BACKEND_UPSTREAM
COPY dell-staging/index.html /usr/share/nginx/html/index.html
COPY dell-staging/dell-staging.js /usr/share/nginx/html/dell-staging.js
# Copy the *real* JK Works visual assets, not the original Supabase scripts.
COPY app/styles.css /usr/share/nginx/html/app/styles.css
COPY app/icons/ /usr/share/nginx/html/app/icons/
# Existing JK Works UI in separate preview folder, with a fail-closed Dell cloud adapter.
COPY dell-staging/preview-index.html /usr/share/nginx/html/preview/index.html
COPY dell-staging/dell-cloud.js /usr/share/nginx/html/preview/dell-cloud.js
COPY app/styles.css /usr/share/nginx/html/preview/styles.css
COPY app/db.js app/app.js app/calendar-sync.js app/website-editor.js app/backup.js app/push.js app/finance.js app/media-viewer.js app/job-label.js app/job-label-editor.js app/open-payments-label.js app/open-payments-editor.js /usr/share/nginx/html/preview/
COPY app/icons/ /usr/share/nginx/html/preview/icons/
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
