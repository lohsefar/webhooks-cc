module webhooks.cc/receiver

go 1.23.0

toolchain go1.23.5

require (
	github.com/getsentry/sentry-go v0.42.0
	github.com/gofiber/fiber/v2 v2.52.10
)

require (
	github.com/andybalholm/brotli v1.1.1 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/klauspost/compress v1.18.0 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-runewidth v0.0.16 // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasthttp v1.58.0 // indirect
	github.com/valyala/tcplisten v1.0.0 // indirect
	golang.org/x/sys v0.29.0 // indirect
	golang.org/x/text v0.20.0 // indirect
)

replace webhooks.cc/shared => ../go-shared
