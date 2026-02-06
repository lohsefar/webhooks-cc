module webhooks.cc/cli

go 1.25.0

toolchain go1.25.7

require (
	github.com/getsentry/sentry-go v0.42.0
	github.com/spf13/cobra v1.10.2
	golang.org/x/mod v0.22.0
	webhooks.cc/shared v0.0.0
)

require (
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/spf13/pflag v1.0.9 // indirect
	golang.org/x/sys v0.18.0 // indirect
	golang.org/x/text v0.14.0 // indirect
)

replace webhooks.cc/shared => ../go-shared
