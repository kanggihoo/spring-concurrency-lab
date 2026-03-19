# Project Plan: Spring Monitoring System

## 1. Overview
**Goal:** Establish a baseline monitoring system where default metrics from a local Spring Boot application are collected by Prometheus and manually visualized in Grafana.
**Project Type:** BACKEND
**Tech Stack:** 
- Spring Boot (App & Actuator)
- Prometheus (Metrics scraping & storage)
- Grafana (Visualization via GUI)
- Docker Compose (Containerization)

## 2. Success Criteria
1. Spring Boot exposes the `/actuator/prometheus` endpoint successfully.
2. Prometheus container successfully scrapes metrics from the Spring Boot application (`host.docker.internal:8080`).
3. Grafana container can connect to the Prometheus instance.
4. User can manually log into Grafana GUI and view default JVM metrics through an imported or manually created dashboard.

## 3. Tech Stack & Decisions
| Technology | Rationale / Decision |
|------------|----------------------|
| **Spring Boot Actuator** | Already in `build.gradle`. Need to expose metrics via `application.yml`. |
| **Prometheus** | Configuration `prometheus.yml` is already provided. Will scrape every 5s. |
| **Grafana** | Will be configured manually via GUI as requested (no auto-provisioning). |
| **k6** | Deferred to a later phase. Focus is purely on Spring -> Prometheus -> Grafana. |

## 4. File Structure (Relevant files)
```
.
├── src/main/resources/application.yml  # Action: Update to expose endpoints
├── docker-compose.yml                  # Existing: To be executed
└── prometheus.yml                      # Existing: Contains scraping config
```

## 5. Task Breakdown

### Task 1: Expose Spring Boot Metrics
- **Agent:** `@backend-specialist`
- **Skills:** `api-patterns`
- **Priority:** P1
- **Dependencies:** None
- **INPUT:** `application.yml`
- **OUTPUT:** Updated `application.yml` adding management endpoints exposure (`prometheus`).
- **VERIFY:** Run Spring Boot locally and verify `http://localhost:8080/actuator/prometheus` returns metrics.

### Task 2: Ignite Monitoring Infrastructure
- **Agent:** `@devops-engineer` (or orchestrator)
- **Skills:** `bash-linux`, `server-management`
- **Priority:** P1
- **Dependencies:** Task 1
- **INPUT:** `docker-compose.yml`
- **OUTPUT:** Running containers.
- **VERIFY:** Execute `docker compose up -d prometheus grafana` and ensure both containers are up via `docker ps`.

### Task 3: Verify Prometheus Scrape
- **Agent:** `@devops-engineer`
- **Priority:** P2
- **Dependencies:** Task 2
- **INPUT:** Prometheus UI (`http://localhost:9090/targets`)
- **OUTPUT:** Verify state is "UP".
- **VERIFY:** The `spring` job target should be marked as "UP" in the Prometheus UI.

### Task 4: Connect Grafana & Visualize
- **Agent:** Manual Action (Guided by `@orchestrator`)
- **Priority:** P2
- **Dependencies:** Task 3
- **INPUT:** Grafana UI (`http://localhost:3000`)
- **OUTPUT:** Configured Dashboard.
- **VERIFY:** 
  1. Login with `admin`/`admin`.
  2. Add Prometheus Data Source (`http://prometheus:9090`).
  3. Import a standard Spring Boot dashboard (e.g., ID 4701 or 11378).

## ✅ PHASE X COMPLETE
- [ ] Lint: Pass
- [ ] Security: No critical issues 
- [ ] Build: Success
- [ ] Runtime: Containers run cleanly
- [ ] Date: [Current Date]
