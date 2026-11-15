FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node server.cjs feedback.cjs package.json LICENSE CONTENT_LICENSE.md ./
COPY --chown=node:node public ./public
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV PORT=4175 DATA_DIR=/app/data NODE_ENV=production
EXPOSE 4175
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:4175/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.cjs"]
