package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"fuel-station-backend/internal/shared/apperr"
)

type errorResponseBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// DecodeJSON parses JSON request body into target value.
func DecodeJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

// JSON sends a JSON response with given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// Error maps domain/system errors to appropriate HTTP Status codes & logs unhandled errors silently at boundary.
func Error(w http.ResponseWriter, r *http.Request, log *slog.Logger, err error) {
	switch {
	case errors.Is(err, apperr.ErrNotFound):
		JSON(w, http.StatusNotFound, errorResponseBody{Code: "not_found", Message: err.Error()})
	case errors.Is(err, apperr.ErrInvalidInput):
		JSON(w, http.StatusBadRequest, errorResponseBody{Code: "invalid_input", Message: err.Error()})
	case errors.Is(err, apperr.ErrConflict):
		JSON(w, http.StatusConflict, errorResponseBody{Code: "conflict", Message: err.Error()})
	case errors.Is(err, apperr.ErrUnauthorized):
		JSON(w, http.StatusUnauthorized, errorResponseBody{Code: "unauthorized", Message: "unauthorized"})
	case errors.Is(err, apperr.ErrForbidden):
		JSON(w, http.StatusForbidden, errorResponseBody{Code: "forbidden", Message: "access forbidden"})
	default:
		log.ErrorContext(r.Context(), "unhandled server error", "err", err, "path", r.URL.Path)
		JSON(w, http.StatusInternalServerError, errorResponseBody{Code: "internal_error", Message: "an unexpected error occurred"})
	}
}
