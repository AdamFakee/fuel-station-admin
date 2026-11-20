@echo off
echo Starting Fuel Station Golang Backend...
cd /d "%~dp0backend"
go run ./cmd/api
pause
