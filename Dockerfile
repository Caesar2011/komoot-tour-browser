FROM alpine:3.23 AS fetch

ARG SWS_VERSION=2.42.0
RUN wget -qO /tmp/sws.tar.gz \
    "https://github.com/static-web-server/static-web-server/releases/download/v${SWS_VERSION}/static-web-server-v${SWS_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
  && tar -xzf /tmp/sws.tar.gz -C /tmp \
  && mv /tmp/static-web-server-v${SWS_VERSION}-x86_64-unknown-linux-musl/static-web-server /sws \
  && chmod +x /sws

FROM scratch

COPY --from=fetch /sws /sws
COPY dist/index.html /public/index.html

EXPOSE 8080

ENTRYPOINT ["/sws"]
CMD ["--port", "8080", "--root", "/public", "--log-level", "error"]
