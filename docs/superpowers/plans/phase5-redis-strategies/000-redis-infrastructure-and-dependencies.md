# 000. Redis Infrastructure and Dependencies

### Task 000: Add Redis Runtime, Metrics, and Java Dependencies

**Files:**
- Modify: `docker-compose.yml`
- Modify: `prometheus.yml`
- Modify: `concurrency/build.gradle`
- Modify: `concurrency/src/main/resources/application.yml`

- [ ] **Step 1: Add Redis and redis_exporter services**

Modify `docker-compose.yml` by adding these services after `postgres_exporter`:

```yaml
  redis:
    image: redis:7.2-alpine
    container_name: redis
    ports:
      - "6379:6379"
    command: redis-server --save "" --appendonly no
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis_exporter:
    image: oliver006/redis_exporter:v1.62.0
    container_name: redis_exporter
    environment:
      REDIS_ADDR: "redis://redis:6379"
    ports:
      - "9121:9121"
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
```

Keep the existing PostgreSQL, Prometheus, Grafana, and k6 services unchanged.

- [ ] **Step 2: Add Redis scrape target**

Modify `prometheus.yml` to include this scrape config after the PostgreSQL exporter block:

```yaml
  # Redis Exporter 메트릭 수집
  - job_name: "redis"
    static_configs:
      - targets: ["redis_exporter:9121"]
```

- [ ] **Step 3: Add Redis dependencies**

Modify `concurrency/build.gradle` dependencies:

```gradle
dependencies {
	implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
	implementation 'org.springframework.boot:spring-boot-starter-actuator'
	implementation 'org.springframework.boot:spring-boot-starter-jdbc'
	implementation 'org.springframework.boot:spring-boot-starter-data-redis'
	implementation 'org.redisson:redisson-spring-boot-starter:4.4.0'
	implementation 'org.springframework.boot:spring-boot-starter-webmvc'
	compileOnly 'org.projectlombok:lombok'
	developmentOnly 'org.springframework.boot:spring-boot-devtools'
	runtimeOnly 'io.micrometer:micrometer-registry-prometheus'
	runtimeOnly 'org.postgresql:postgresql'
	annotationProcessor 'org.projectlombok:lombok'

	testImplementation 'org.springframework.boot:spring-boot-starter-actuator-test'
	testImplementation 'org.springframework.boot:spring-boot-starter-data-jpa-test'
	testImplementation 'org.springframework.boot:spring-boot-starter-jdbc-test'
	testImplementation 'org.springframework.boot:spring-boot-starter-webmvc-test'
	testImplementation 'org.testcontainers:testcontainers-postgresql'
	testImplementation 'org.springframework.boot:spring-boot-starter-test'
	testImplementation 'org.springframework.boot:spring-boot-testcontainers'
	testImplementation 'org.testcontainers:testcontainers-junit-jupiter'

	testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}
```

- [ ] **Step 4: Add Redis application defaults**

Modify `concurrency/src/main/resources/application.yml` so local profile configuration includes:

```yaml
spring:
  data:
    redis:
      host: ${SPRING_DATA_REDIS_HOST:localhost}
      port: ${SPRING_DATA_REDIS_PORT:6379}

reservation:
  redis:
    lock-wait-ms: ${RESERVATION_REDIS_LOCK_WAIT_MS:200}
    lock-lease-ms: ${RESERVATION_REDIS_LOCK_LEASE_MS:3000}
```

Preserve existing datasource, JPA, actuator, and logging configuration.

- [ ] **Step 5: Verify dependency resolution and config syntax**

Run:

```bash
rtk gradlew -p concurrency dependencies --configuration testRuntimeClasspath
```

Expected: command exits `0` and output contains `redisson-spring-boot-starter`.

Run:

```bash
rtk proxy docker compose config
```

Expected: command exits `0` and rendered services include `redis` and `redis_exporter`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml prometheus.yml concurrency/build.gradle concurrency/src/main/resources/application.yml
git commit -m "chore: add redis infrastructure for phase5"
```
