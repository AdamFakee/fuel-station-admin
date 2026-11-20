package apperr

import "errors"

// Sentinel Domain Errors
var (
	ErrNotFound      = errors.New("resource not found")
	ErrConflict      = errors.New("resource conflict")
	ErrAlreadyExists = ErrConflict
	ErrInvalidInput  = errors.New("invalid input")
	ErrUnauthorized  = errors.New("unauthorized access")
	ErrForbidden     = errors.New("access forbidden")
)
