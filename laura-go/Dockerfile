# syntax=docker/dockerfile:1.7

FROM golang:1.26-alpine AS build
WORKDIR /src
RUN apk add --no-cache ca-certificates git
COPY laura-go/go.mod laura-go/go.sum ./laura-go/
WORKDIR /src/laura-go
RUN go mod download
COPY laura-go ./
# Migrations canonicas vivem em ./internal/migrations (go:embed).
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
RUN CGO_ENABLED=0 GOOS=linux go build \
        -tags "timetzdata" \
        -ldflags="-s -w -X main.buildVersion=${BUILD_SHA} -X main.buildTime=${BUILD_TIME}" \
        -o /out/laura ./

FROM gcr.io/distroless/static-debian12:nonroot
ENV TZ=America/Sao_Paulo
WORKDIR /app
COPY --from=build /out/laura /app/laura
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/laura"]
