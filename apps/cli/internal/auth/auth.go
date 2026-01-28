package auth

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const configDir = ".config/whk"
const tokenFile = "token.json"

type Token struct {
	AccessToken string `json:"access_token"`
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
}

// GetConfigPath returns the path to the config directory
func GetConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, configDir), nil
}

// SaveToken saves the authentication token
func SaveToken(token *Token) error {
	configPath, err := GetConfigPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(configPath, 0700); err != nil {
		return err
	}

	data, err := json.Marshal(token)
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(configPath, tokenFile), data, 0600)
}

// LoadToken loads the authentication token
func LoadToken() (*Token, error) {
	configPath, err := GetConfigPath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(filepath.Join(configPath, tokenFile))
	if err != nil {
		return nil, err
	}

	var token Token
	if err := json.Unmarshal(data, &token); err != nil {
		return nil, err
	}

	return &token, nil
}

// ClearToken removes the stored token
func ClearToken() error {
	configPath, err := GetConfigPath()
	if err != nil {
		return err
	}

	return os.Remove(filepath.Join(configPath, tokenFile))
}

// IsLoggedIn checks if user is authenticated
func IsLoggedIn() bool {
	token, err := LoadToken()
	return err == nil && token != nil && token.AccessToken != ""
}
