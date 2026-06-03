# 000. Foundation and Grafana Provisioning

### Task 000: Add Node Tooling and Grafana Provisioning

**Files:**
- Create: `package.json`
- Modify: `docker-compose.yml`
- Create: `grafana/provisioning/datasources/prometheus.yml`
- Create: `grafana/provisioning/dashboards/dashboards.yml`

- [ ] **Step 1: Add Node script entrypoints**

Create `package.json` at the repository root:

```json
{
  "name": "spring-concurrency-lab-tools",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "grafana:generate": "node scripts/generate-grafana-dashboards.js",
    "grafana:capture": "node scripts/capture-grafana-dashboard.js",
    "grafana:capture:phase2": "node scripts/capture-grafana-dashboard.js --dashboard phase2 --phase phase-02 --scenario no-lock --preset baseline --pool default --live"
  },
  "devDependencies": {
    "playwright": "^1.54.0"
  }
}
```

- [ ] **Step 2: Add Grafana datasource provisioning**

Create `grafana/provisioning/datasources/prometheus.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    uid: prometheus
    isDefault: true
    editable: true
```

- [ ] **Step 3: Add Grafana dashboard provider**

Create `grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: Concurrency Lab
    orgId: 1
    folder: Concurrency Lab
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

- [ ] **Step 4: Mount provisioning directories in Docker Compose**

Modify the `grafana` service in `docker-compose.yml`.

Replace:

```yaml
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_SECURITY_ADMIN_USER=admin
    volumes:
      - grafana-storage:/var/lib/grafana
```

With:

```yaml
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_SECURITY_ADMIN_USER=admin
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
    volumes:
      - grafana-storage:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
```

- [ ] **Step 5: Validate YAML shape without starting services**

Run:

```bash
docker compose config
```

Expected:

- command exits with status `0`
- `grafana` service includes `/etc/grafana/provisioning`
- `grafana` service includes `/var/lib/grafana/dashboards`
- anonymous viewer environment variables are present

- [ ] **Step 6: Commit**

```bash
git add package.json docker-compose.yml grafana/provisioning/datasources/prometheus.yml grafana/provisioning/dashboards/dashboards.yml
git commit -m "chore: add grafana provisioning foundation"
```
