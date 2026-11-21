package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

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

// detailAfter lấy phần mô tả cụ thể phía sau tên lỗi chung ("resource conflict: mã 'X' đã tồn tại" thành "mã 'X' đã tồn tại").
// Không có mô tả cụ thể thì trả `fallback` (câu tiếng Việt chung) để người dùng không bao giờ thấy chữ kỹ thuật như "resource conflict".
func detailAfter(err, sentinel error, fallback string) string {
	marker := sentinel.Error() + ": "
	if i := strings.Index(err.Error(), marker); i >= 0 {
		if detail := strings.TrimSpace(err.Error()[i+len(marker):]); detail != "" {
			return detail
		}
	}
	return fallback
}

// Error maps domain/system errors to appropriate HTTP Status codes & logs unhandled errors silently at boundary.
// `message` luôn là câu tiếng Việt rõ nghĩa để giao diện hiện thẳng cho người dùng.
func Error(w http.ResponseWriter, r *http.Request, log *slog.Logger, err error) {
	switch {
	case errors.Is(err, apperr.ErrNotFound):
		JSON(w, http.StatusNotFound, errorResponseBody{Code: "not_found", Message: detailAfter(err, apperr.ErrNotFound, "Không tìm thấy dữ liệu, có thể đã bị xóa hoặc không thuộc phạm vi của bạn")})
	case errors.Is(err, apperr.ErrInvalidInput):
		JSON(w, http.StatusBadRequest, errorResponseBody{Code: "invalid_input", Message: detailAfter(err, apperr.ErrInvalidInput, "Dữ liệu nhập chưa hợp lệ, vui lòng kiểm tra lại")})
	case errors.Is(err, apperr.ErrConflict):
		JSON(w, http.StatusConflict, errorResponseBody{Code: "conflict", Message: detailAfter(err, apperr.ErrConflict, "Dữ liệu bị trùng hoặc đang được sử dụng nên không thực hiện được thao tác này")})
	case errors.Is(err, apperr.ErrUnauthorized):
		JSON(w, http.StatusUnauthorized, errorResponseBody{Code: "unauthorized", Message: "Thông tin đăng nhập không chính xác hoặc phiên đăng nhập đã hết hạn"})
	case errors.Is(err, apperr.ErrForbidden):
		JSON(w, http.StatusForbidden, errorResponseBody{Code: "forbidden", Message: detailAfter(err, apperr.ErrForbidden, "Bạn không có quyền thực hiện thao tác này")})
	default:
		log.ErrorContext(r.Context(), "unhandled server error", "err", err, "path", r.URL.Path)
		JSON(w, http.StatusInternalServerError, errorResponseBody{Code: "internal_error", Message: "Hệ thống gặp sự cố, vui lòng thử lại sau"})
	}
}
