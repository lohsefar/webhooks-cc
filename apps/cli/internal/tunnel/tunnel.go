package tunnel

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"

	"webhooks.cc/shared/types"
)

type Tunnel struct {
	endpointSlug string
	targetURL    string
	httpClient   *http.Client
}

func New(endpointSlug, targetURL string) *Tunnel {
	return &Tunnel{
		endpointSlug: endpointSlug,
		targetURL:    targetURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Forward sends a captured request to the target URL
func (t *Tunnel) Forward(req *types.CapturedRequest) (*ForwardResult, error) {
	start := time.Now()

	// Build the target URL
	targetURL := t.targetURL + req.Path

	// Create the forwarded request
	httpReq, err := http.NewRequest(req.Method, targetURL, bytes.NewBufferString(req.Body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Copy headers (except Host)
	for key, value := range req.Headers {
		if key != "Host" {
			httpReq.Header.Set(key, value)
		}
	}

	// Send the request
	resp, err := t.httpClient.Do(httpReq)
	if err != nil {
		return &ForwardResult{
			Success:  false,
			Error:    err.Error(),
			Duration: time.Since(start),
		}, nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	return &ForwardResult{
		Success:    true,
		StatusCode: resp.StatusCode,
		Duration:   time.Since(start),
		BodySize:   len(body),
	}, nil
}

type ForwardResult struct {
	Success    bool
	StatusCode int
	Duration   time.Duration
	BodySize   int
	Error      string
}

func (r *ForwardResult) String() string {
	if !r.Success {
		return fmt.Sprintf("FAILED: %s", r.Error)
	}
	return fmt.Sprintf("%d (%s)", r.StatusCode, r.Duration.Round(time.Millisecond))
}
