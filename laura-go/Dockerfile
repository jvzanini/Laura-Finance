# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build ----------
FROM golang:1.26-alpine AS build

WORKDIR /src

# Dependências primeiro para maximizar cache.
COPY go.mod go.sum ./
RUN go mod download

# Copia o resto e compila binário estático.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
        -ldflags="-s -w" \
        -o /out/laura ./

# ---------- Stage 2: runtime ----------
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/laura /laura

EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/laura"]
