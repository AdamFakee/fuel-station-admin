package logger

import (
	"log/slog"
	"os"
)

// New initializes a structured slog Logger tailored for production or development.
func New(env string) *slog.Logger {
	var handler slog.Handler

	if env == "production" || env == "staging" {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		})
	} else {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelDebug,
		})
	}

	return slog.New(handler)
}
