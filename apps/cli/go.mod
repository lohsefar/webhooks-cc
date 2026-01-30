module webhooks.cc/cli

go 1.23

require (
	github.com/spf13/cobra v1.10.2
	webhooks.cc/shared v0.0.0
)

require (
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/spf13/pflag v1.0.9 // indirect
)

replace webhooks.cc/shared => ../go-shared
