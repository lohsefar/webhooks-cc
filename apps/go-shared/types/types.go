package types

// CapturedRequest represents a captured webhook request
type CapturedRequest struct {
	ID          string            `json:"_id"`
	EndpointID  string            `json:"endpointId"`
	Method      string            `json:"method"`
	Path        string            `json:"path"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body,omitempty"`
	QueryParams map[string]string `json:"queryParams"`
	ContentType string            `json:"contentType,omitempty"`
	IP          string            `json:"ip"`
	Size        int               `json:"size"`
	ReceivedAt  int64             `json:"receivedAt"`
}

// Endpoint represents a webhook endpoint
type Endpoint struct {
	ID           string        `json:"_id"`
	UserID       string        `json:"userId,omitempty"`
	Slug         string        `json:"slug"`
	Name         string        `json:"name,omitempty"`
	MockResponse *MockResponse `json:"mockResponse,omitempty"`
	IsEphemeral  bool          `json:"isEphemeral"`
	ExpiresAt    int64         `json:"expiresAt,omitempty"`
	CreatedAt    int64         `json:"createdAt"`
}

// MockResponse defines what the endpoint should return
type MockResponse struct {
	Status  int               `json:"status"`
	Body    string            `json:"body"`
	Headers map[string]string `json:"headers"`
}

// User represents a user account
type User struct {
	ID                  string `json:"_id"`
	Email               string `json:"email"`
	Name                string `json:"name,omitempty"`
	Plan                string `json:"plan"`
	RequestsUsed        int    `json:"requestsUsed"`
	RequestLimit        int    `json:"requestLimit"`
	PeriodEnd           int64  `json:"periodEnd,omitempty"`
	CancelAtPeriodEnd   bool   `json:"cancelAtPeriodEnd,omitempty"`
}
