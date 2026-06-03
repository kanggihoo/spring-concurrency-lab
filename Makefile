ifeq ($(OS),Windows_NT)
SHELL := C:/PROGRA~1/Git/bin/bash.exe
else
SHELL := /bin/bash
endif
.DEFAULT_GOAL := help

include makefiles/config.mk
include makefiles/help.mk
include makefiles/env.mk
include makefiles/app.mk
include makefiles/k6.mk
include makefiles/grafana.mk
include makefiles/evidence.mk
include makefiles/sql.mk
include makefiles/phase-compat.mk
