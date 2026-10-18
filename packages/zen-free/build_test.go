package zenfree_test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/dop251/goja"
	"github.com/godwit-email/godwit/core/plugins"
	"github.com/stretchr/testify/require"
)

type catalogHost struct{ plugins.Host }

func (catalogHost) Fetch(_ context.Context, _ plugins.Invocation, req plugins.FetchRequest) (plugins.FetchResponse, error) {
	var body string
	switch req.URL {
	case "https://opencode.ai/inference/v1/models":
		body = `{"data":[{"id":"chat"},{"id":"responses"},{"id":"claude"},{"id":"jev-1.13-free"}]}`
	case "https://models.opencode.ai/api.json":
		body = `{"opencode":{"models":{
			"chat":{"cost":{"input":0,"output":0},"provider":{"npm":"@ai-sdk/openai-compatible"}},
			"responses":{"cost":{"input":0,"output":0},"provider":{"npm":"@ai-sdk/openai"}},
			"claude":{"cost":{"input":0,"output":0},"provider":{"npm":"@ai-sdk/anthropic"}}
		}}}`
	case "https://raw.githubusercontent.com/anomalyco/opencode/dev/services/www/src/docs/content/console/models.mdx":
		body = "| Jev Free | jev-1.13-free | `https://opencode.ai/inference/systemone/v1/systemone` | - |\n| Jev Free | Free | Free |"
	default:
		return plugins.FetchResponse{}, fmt.Errorf("unexpected fetch: %s", req.URL)
	}
	return plugins.FetchResponse{Status: 200, Body: body}, nil
}

func TestZenFree(t *testing.T) {
	dist := os.Getenv("GODWIT_ZEN_FREE_DIST")
	require.NotEmpty(t, dist)
	manifest, err := os.ReadFile(filepath.Join(dist, "plugin.json"))
	require.NoError(t, err)
	m, err := plugins.ParseManifest(manifest, "zen-free")
	require.NoError(t, err)
	code, err := plugins.Build(dist, m.Main)
	require.NoError(t, err)
	program, err := goja.Compile("zen-free", string(code), true)
	require.NoError(t, err)
	vm := plugins.NewVM("zen-free", program, plugins.VMOptions{})
	t.Cleanup(vm.Close)
	cfg := &plugins.ConfigSnapshot{Values: map[string]any{}}
	p, err := plugins.Load(context.Background(), vm, m, catalogHost{}, cfg)
	require.NoError(t, err)
	inv := plugins.Invocation{ID: "models:test", Kind: plugins.KindModels, Config: cfg, EgressHosts: m.Permissions.Net}
	listed, err := p.ListModels(context.Background(), inv)
	require.NoError(t, err)
	var models plugins.ModelsResult
	raw, err := json.Marshal(listed)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &models))
	require.NoError(t, plugins.ValidateModels(models, false))
	require.Len(t, models.Models, 4)
	require.Empty(t, p.Tools(), "placeholder definitions grant no executable tools")
	var session, requestID string
	for _, fixture := range []struct{ id, name, protocol, path string }{
		{"chat", "chat", "openai-completions", "chat/completions"},
		{"responses", "responses", "openai-responses", "responses"},
		{"claude", "claude", "anthropic-message", "messages"},
		{"jev-1.13-free", "Jev Free", "typesafe-systemone", "systemone"},
	} {
		t.Run(fixture.id, func(t *testing.T) {
			require.Contains(t, models.Models, plugins.ProviderModel{ID: fixture.id, Name: fixture.name, Transport: "http", Protocol: fixture.protocol, BaseURL: "https://opencode.ai/inference/v1"})
			body := fmt.Sprintf(`{"model":%q,"stream":true,"messages":[]}`, fixture.id)
			out, err := p.PrepareRequest(context.Background(), inv, plugins.ModelRequest{ModelID: fixture.id, Method: "POST", URL: "https://opencode.ai/inference/v1/" + fixture.path, Headers: map[string]string{"Authorization": "Bearer old-secret"}, Body: body})
			require.NoError(t, err)
			var prepared plugins.ModelRequest
			raw, err := json.Marshal(out)
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(raw, &prepared))
			require.Equal(t, "https://opencode.ai/inference/v1/"+fixture.path, prepared.URL)
			require.NotContains(t, fmt.Sprint(prepared.Headers), "old-secret")
			if fixture.protocol == "anthropic-message" {
				require.Equal(t, "public", prepared.Headers["x-api-key"])
			} else {
				require.Equal(t, "Bearer public", prepared.Headers["authorization"])
			}
			require.Regexp(t, `^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$`, prepared.Headers["x-opencode-session"])
			if session != "" {
				require.Equal(t, session, prepared.Headers["x-opencode-session"])
				require.NotEqual(t, requestID, prepared.Headers["x-opencode-request"])
			}
			session, requestID = prepared.Headers["x-opencode-session"], prepared.Headers["x-opencode-request"]
			var payload map[string]any
			require.NoError(t, json.Unmarshal([]byte(prepared.Body), &payload))
			require.Equal(t, fixture.id, payload["model"])
			if fixture.protocol == "typesafe-systemone" {
				require.NotContains(t, payload, "tools")
			} else {
				require.Len(t, payload["tools"], 5)
			}
		})
	}
	_, err = p.PrepareRequest(context.Background(), inv, plugins.ModelRequest{ModelID: "unknown"})
	require.Error(t, err)
}
