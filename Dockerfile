FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html/
RUN rm -rf /usr/share/nginx/html/.git /usr/share/nginx/html/docker /usr/share/nginx/html/scripts /usr/share/nginx/html/docs /usr/share/nginx/html/supabase /usr/share/nginx/html/.github \
 && test -f /usr/share/nginx/html/index.html \
 && test -f /usr/share/nginx/html/app/index.html \
 && test -f /usr/share/nginx/html/inloggen/index.html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
