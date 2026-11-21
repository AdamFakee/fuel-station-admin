// Package feedback quản lý góp ý của người dùng: cải thiện tính năng, giao diện / trải nghiệm, lỗi và nghiệp vụ.
package feedback

import "time"

// Các loại góp ý.
const (
	KindImprovement = "improvement" // cải thiện tính năng
	KindUIUX        = "ui_ux"       // giao diện / trải nghiệm
	KindBug         = "bug"         // lỗi
	KindBusiness    = "business"    // nghiệp vụ
)

// Các trạng thái xử lý.
const (
	StatusNew       = "new"
	StatusReviewing = "reviewing"
	StatusPlanned   = "planned"
	StatusDone      = "done"
	StatusRejected  = "rejected"
)

var validKinds = map[string]bool{KindImprovement: true, KindUIUX: true, KindBug: true, KindBusiness: true}
var validStatuses = map[string]bool{StatusNew: true, StatusReviewing: true, StatusPlanned: true, StatusDone: true, StatusRejected: true}

const (
	maxTitleLen       = 200
	maxDescriptionLen = 5000
	maxElementBytes   = 20 * 1024
)

// Feedback là một góp ý kèm ngữ cảnh nơi người dùng góp ý.
type Feedback struct {
	ID             string         `json:"id"`
	Code           string         `json:"code"`
	Kind           string         `json:"kind"`
	Title          string         `json:"title"`
	Description    string         `json:"description"`
	Status         string         `json:"status"`
	ResolutionNote string         `json:"resolution_note,omitempty"`
	PageURL        string         `json:"page_url,omitempty"`
	PageTitle      string         `json:"page_title,omitempty"`
	Element        map[string]any `json:"element,omitempty"`
	Viewport       map[string]any `json:"viewport,omitempty"`
	UserAgent      string         `json:"user_agent,omitempty"`
	CreatedBy      string         `json:"created_by"`
	CreatedByName  string         `json:"created_by_name"`
	CreatedByRole  string         `json:"created_by_role"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// CreateRequest là nội dung người dùng gửi lên.
type CreateRequest struct {
	Kind        string         `json:"kind"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	PageURL     string         `json:"page_url"`
	PageTitle   string         `json:"page_title"`
	Element     map[string]any `json:"element"`
	Viewport    map[string]any `json:"viewport"`
	UserAgent   string         `json:"user_agent"`
}

// UpdateStatusRequest đổi trạng thái và ghi chú xử lý.
type UpdateStatusRequest struct {
	Status         string  `json:"status"`
	ResolutionNote *string `json:"resolution_note,omitempty"`
}

// ListQuery là bộ lọc danh sách.
type ListQuery struct {
	Kind     string
	Status   string
	Search   string
	Page     int
	PageSize int
}

// ListResult là một trang góp ý kèm số lượng theo trạng thái (để hiện thẻ tổng quan).
type ListResult struct {
	Items        []Feedback     `json:"data"`
	Total        int            `json:"total"`
	Page         int            `json:"page"`
	PageSize     int            `json:"page_size"`
	StatusCounts map[string]int `json:"status_counts"`
}
