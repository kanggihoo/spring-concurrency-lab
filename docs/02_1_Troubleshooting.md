# Phase 2 Troubleshooting

## 1. Testcontainers 2.x — PostgreSQLContainer deprecated 경고

### 증상

```
The type PostgreSQLContainer<?> is deprecated
```

### 원인

Testcontainers 2.0.4 (Spring Boot 4.x에 맞춤) 에서 패키지가 변경됨:

- **기존 (1.x)**: `org.testcontainers.containers.PostgreSQLContainer` (generic type)
- **신규 (2.x)**: `org.testcontainers.postgresql.PostgreSQLContainer` (non-generic)

### 해결

```java
// Before (1.x)
import org.testcontainers.containers.PostgreSQLContainer;
static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

// After (2.x)
import org.testcontainers.postgresql.PostgreSQLContainer;
static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");
```

제네릭 타입 파라미터 `<?>`, `<>` 도 함께 제거해야 컴파일 에러가 발생하지 않음.

## 2. Testcontainers BOM 버전 호환성

### 증상

Spring Boot 4.0.3 + Testcontainers 1.20.4 조합에서 의존성 해결 실패 또는
deprecated 클래스 사용 경고 발생.

### 원인

Spring Boot 4.x는 Testcontainers 2.x를 기대하지만,
초기 설정에서 BOM을 1.20.4로 지정해두었음.

### 해결

`build.gradle`의 `dependencyManagement` BOM 버전을 2.0.4로 변경:

```groovy
dependencyManagement {
    imports {
        mavenBom 'org.testcontainers:testcontainers-bom:2.0.4'
    }
}
```

또한 artifact name도 2.x에 맞게 변경:

```groovy
// 1.x artifact
testImplementation 'org.testcontainers:postgresql'

// 2.x artifact
testImplementation 'org.testcontainers:testcontainers-postgresql'
```
