module webhooks.cc/receiver

go 1.23

require (
	github.com/gofiber/fiber/v2 v2.52.5
	webhooks.cc/shared v0.0.0
)

replace webhooks.cc/shared => ../go-shared
