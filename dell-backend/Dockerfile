FROM node:22-alpine
WORKDIR /service
COPY dell-backend/server.mjs ./server.mjs
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8090
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8090/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.mjs"]
