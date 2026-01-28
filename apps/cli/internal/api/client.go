package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"webhooks.cc/cli/internal/auth"
)

const defaultBaseURL = "https://webhooks.cc"

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{
		baseURL:    defaultBaseURL,
		httpClient: &http.Client{},
	}
}

func (c *Client) getToken() (string, error) {
	token, err := auth.LoadToken()
	if err != nil {
		return "", fmt.Errorf("not logged in: %w", err)
	}
	return token.AccessToken, nil
}

func (c *Client) request(method, path string, body interface{}, result interface{}) error {
	token, err := c.getToken()
	if err != nil {
		return err
	}

	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, c.baseURL+path, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to parse response: %w", err)
		}
	}

	return nil
}

// CreateEndpoint creates a new endpoint
func (c *Client) CreateEndpoint(name string) (*Endpoint, error) {
	var result Endpoint
	err := c.request("POST", "/api/endpoints", map[string]string{"name": name}, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// ListEndpoints returns all endpoints for the user
func (c *Client) ListEndpoints() ([]Endpoint, error) {
	var result []Endpoint
	err := c.request("GET", "/api/endpoints", nil, &result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// DeleteEndpoint deletes an endpoint
func (c *Client) DeleteEndpoint(slug string) error {
	return c.request("DELETE", "/api/endpoints/"+slug, nil, nil)
}

type Endpoint struct {
	ID   string `json:"id"`
	Slug string `json:"slug"`
	Name string `json:"name"`
	URL  string `json:"url"`
}
