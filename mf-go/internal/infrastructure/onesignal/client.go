package onesignal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const createURL = "https://api.onesignal.com/notifications"

// Client calls OneSignal's REST API. Zero value sends nothing (disabled).
type Client struct {
	AppID      string
	RESTAPIKey string
	HTTP       *http.Client
	Log        *slog.Logger
}

// Enabled reports whether REST calls will be attempted.
func (c *Client) Enabled() bool {
	return c != nil && strings.TrimSpace(c.AppID) != "" && strings.TrimSpace(c.RESTAPIKey) != ""
}

func (c *Client) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return http.DefaultClient
}

// CreateNotification sends or schedules a push.
// Use either ExternalIDs (matches mobile OneSignal.login(userUUID)) or Segments (e.g. "All"), not both.
func (c *Client) CreateNotification(ctx context.Context, in CreateNotificationInput) (notificationID string, err error) {
	if !c.Enabled() {
		return "", nil
	}
	if len(in.Segments) == 0 && len(in.ExternalIDs) == 0 {
		return "", nil
	}
	body := map[string]interface{}{
		"app_id":           strings.TrimSpace(c.AppID),
		"target_channel":   "push",
		"headings":         in.Headings,
		"contents":         in.Contents,
		"data":             in.Data,
	}
	if len(in.Segments) > 0 {
		body["included_segments"] = in.Segments
	} else {
		body["include_aliases"] = map[string][]string{
			"external_id": in.ExternalIDs,
		}
	}
	if in.SendAfterUTC != nil {
		// OneSignal expects UTC wall time, e.g. "2026-04-08 14:30:00 GMT"
		t := in.SendAfterUTC.UTC()
		body["send_after"] = t.Format("2006-01-02 15:04:05") + " GMT"
	}
	if in.CollapseID != "" {
		body["collapse_id"] = in.CollapseID
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("onesignal: marshal body: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, createURL, bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Key "+strings.TrimSpace(c.RESTAPIKey))

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return "", fmt.Errorf("onesignal: create notification: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	var parsed struct {
		ID     string          `json:"id"`
		Errors json.RawMessage `json:"errors"`
	}
	_ = json.Unmarshal(respBody, &parsed)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if c.Log != nil {
			c.Log.Warn("onesignal create failed",
				slog.Int("status", resp.StatusCode),
				slog.String("body", string(respBody)),
			)
		}
		return "", fmt.Errorf("onesignal: http %d: %s", resp.StatusCode, truncate(string(respBody), 500))
	}
	if len(parsed.Errors) > 0 && string(parsed.Errors) != "null" && c.Log != nil {
		c.Log.Warn("onesignal create returned errors",
			slog.String("id", parsed.ID),
			slog.String("errors", string(parsed.Errors)),
		)
	}
	return strings.TrimSpace(parsed.ID), nil
}

// CancelNotification cancels a scheduled notification by id.
func (c *Client) CancelNotification(ctx context.Context, notificationID string) error {
	if !c.Enabled() || strings.TrimSpace(notificationID) == "" {
		return nil
	}
	u := fmt.Sprintf("https://api.onesignal.com/notifications/%s?app_id=%s",
		notificationID, strings.TrimSpace(c.AppID))
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Key "+strings.TrimSpace(c.RESTAPIKey))

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return fmt.Errorf("onesignal: cancel notification: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if c.Log != nil {
			c.Log.Debug("onesignal cancel non-success",
				slog.Int("status", resp.StatusCode),
				slog.String("body", truncate(string(respBody), 300)),
			)
		}
		// Already delivered / unknown id — treat as non-fatal
		return nil
	}
	return nil
}

// CreateNotificationInput is the payload for CreateNotification.
type CreateNotificationInput struct {
	ExternalIDs  []string
	Segments     []string
	Headings     map[string]string
	Contents     map[string]string
	Data         map[string]interface{}
	SendAfterUTC *time.Time
	CollapseID   string
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
