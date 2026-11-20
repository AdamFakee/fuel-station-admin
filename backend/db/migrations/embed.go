package migrations

import "embed"

// FS embeds all SQL migration files (*.sql)
//
//go:embed *.sql
var FS embed.FS
