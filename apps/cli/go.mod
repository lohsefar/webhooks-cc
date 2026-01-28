module webhooks.cc/cli

go 1.23

require (
	github.com/spf13/cobra v1.8.1
	webhooks.cc/shared v0.0.0
)

replace webhooks.cc/shared => ../go-shared
