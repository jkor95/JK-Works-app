FROM nginx:1.27-alpine
COPY dell-staging/nginx.conf /etc/nginx/conf.d/default.conf
COPY dell-staging/index.html /usr/share/nginx/html/index.html
# Copy the *real* JK Works visual assets, not the original Supabase scripts.
COPY app/styles.css /usr/share/nginx/html/app/styles.css
COPY app/icons/ /usr/share/nginx/html/app/icons/
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
