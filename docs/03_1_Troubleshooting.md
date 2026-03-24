# Phase 3 Troubleshooting & 회고

---

## Troubleshooting

### 1. spring-retry 의존성 해결 실패 (Spring Boot 4.x)

#### 증상

```
FAILURE: Build failed with an exception.
* What went wrong:
Could not determine the dependencies of task ':compileJava'.
> Could not resolve all dependencies for configuration ':compileClasspath'.
   > Could not find org.springframework.retry:spring-retry:
```

`build.gradle`에 `spring-retry`를 추가했지만 의존성 해결 자체가 되지 않았다.

#### 원인

Spring Boot 4.x에서는 `org.springframework.retry:spring-retry`에 대한 **의존성 관리(BOM)가 제거**되었다.
Spring Boot 3.x까지는 `spring-boot-dependencies` BOM에 spring-retry 버전이 포함되어 있어서 버전을 명시하지 않아도 됐지만, 4.x부터는 아예 관리 대상에서 빠졌다.

이유: Spring Framework 7에서 retry 기능을 **네이티브로 내장**했기 때문에 별도 라이브러리가 불필요해졌다.

#### 해결

`spring-retry`와 `spring-aspects` 의존성을 **완전히 제거**하고, Spring Framework 7 네이티브 retry를 사용한다.

```groovy
// build.gradle — 제거한 의존성
// implementation 'org.springframework.retry:spring-retry'      ← 삭제
// implementation 'org.springframework:spring-aspects'           ← 삭제

// Spring Boot 4.x / Spring Framework 7.x — 네이티브 retry 내장 (별도 의존성 불필요)
```

---

### 2. @Retryable 속성명 변경 — IDE 컴파일 에러

#### 증상

```
Attribute 'retryFor' is undefined for the annotation type Retryable
Attribute 'maxAttempts' is undefined for the annotation type Retryable
Attribute 'backoff' is undefined for the annotation type Retryable
```

Spring Boot 3.x 시절의 `@Retryable` 속성명을 그대로 사용하니 IDE에서 에러가 발생했다.

#### 원인

Spring Framework 7의 네이티브 `@Retryable`은 패키지와 속성명이 모두 변경되었다.

| 항목 | Spring Boot 3.x (spring-retry) | Spring Boot 4.x (네이티브) |
|------|-------------------------------|---------------------------|
| 패키지 | `org.springframework.retry.annotation` | `org.springframework.resilience.annotation` |
| 활성화 | `@EnableRetry` | `@EnableResilientMethods` |
| 예외 지정 | `retryFor = {Exception.class}` | `includes = {Exception.class}` |
| 재시도 횟수 | `maxAttempts = 5` (총 시도 횟수) | `maxRetries = 4` (재시도만 카운트, 총 5회) |
| 지연 | `backoff = @Backoff(delay = 100)` | `delay = 100` |

#### 해결

```java
// Before (Spring Boot 3.x)
import org.springframework.retry.annotation.Retryable;
import org.springframework.retry.annotation.Backoff;

@Retryable(
    retryFor = ObjectOptimisticLockingFailureException.class,
    maxAttempts = 5,
    backoff = @Backoff(delay = 100)
)

// After (Spring Boot 4.x)
import org.springframework.resilience.annotation.Retryable;

@Retryable(
    includes = ObjectOptimisticLockingFailureException.class,
    maxRetries = 4,    // 4회 재시도 = 총 5회 시도
    delay = 100
)
```

`@EnableRetry` → `@EnableResilientMethods`도 함께 변경:

```java
// Before
import org.springframework.retry.annotation.EnableRetry;
@EnableRetry

// After
import org.springframework.resilience.annotation.EnableResilientMethods;
@EnableResilientMethods
```

---

### 3. TestRestTemplate 패키지 변경 (Spring Boot 4.x)

#### 증상

```
Cannot resolve symbol 'TestRestTemplate'
import org.springframework.boot.test.web.client.TestRestTemplate;  // 클래스를 찾을 수 없음
```

#### 원인

Spring Boot 4.x에서 `TestRestTemplate`의 패키지가 이동했다.

- **기존 (3.x)**: `org.springframework.boot.test.web.client.TestRestTemplate`
- **신규 (4.x)**: `org.springframework.boot.resttestclient.TestRestTemplate`

JAR 파일도 분리됨: `spring-boot-resttestclient-4.0.3.jar`

#### 해결

```java
// Before (Spring Boot 3.x)
import org.springframework.boot.test.web.client.TestRestTemplate;

// After (Spring Boot 4.x)
import org.springframework.boot.resttestclient.TestRestTemplate;
```

---

### 4. TestRestTemplate Bean 등록 실패 — `RestTemplateBuilder` 누락 (Spring Boot 4.x)

#### 증상

```
UnsatisfiedDependencyException: No qualifying bean of type
'org.springframework.boot.resttestclient.TestRestTemplate' available

Caused by: java.lang.ClassNotFoundException: org.springframework.boot.restclient.RestTemplateBuilder
```

패키지를 `org.springframework.boot.resttestclient.TestRestTemplate`으로 올바르게 변경했음에도 `TestRestTemplate` bean이 생성되지 않았다.

#### 원인

Spring Boot 4.x에서는 두 가지가 동시에 변경되었다:

1. **`TestRestTemplate` 자동 구성이 분리됨** — `@SpringBootTest`만으로는 bean이 등록되지 않고 `@AutoConfigureTestRestTemplate` 어노테이션이 필요하다.
2. **`RestTemplateBuilder`가 별도 모듈로 분리됨** — `TestRestTemplateTestAutoConfiguration`이 내부적으로 `RestTemplateBuilder`를 참조하는데, 이 클래스가 `spring-boot-restclient` 모듈에 있다. `spring-boot-starter-webmvc-test`만으로는 이 모듈이 포함되지 않아 `ClassNotFoundException`이 발생한다.

#### 해결

**1) `build.gradle`에 `spring-boot-starter-restclient-test` 의존성 추가:**

```groovy
testImplementation 'org.springframework.boot:spring-boot-starter-restclient-test'
```

이 starter가 `spring-boot-restclient` (RestTemplateBuilder 포함)를 전이 의존성으로 가져온다.

**2) 테스트 클래스에 `@AutoConfigureTestRestTemplate` 어노테이션 추가:**

```java
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate  // 추가
@Testcontainers
class OptimisticLockTest {
    @Autowired
    private TestRestTemplate restTemplate;  // 이제 정상 주입됨
}
```

#### 참고: Spring Boot 3.x → 4.x 테스트 의존성 변경 요약

| 항목 | 3.x | 4.x |
|------|-----|-----|
| TestRestTemplate 패키지 | `boot.test.web.client` | `boot.resttestclient` |
| 자동 구성 | `@SpringBootTest`만으로 자동 등록 | `@AutoConfigureTestRestTemplate` 필요 |
| RestTemplateBuilder | `spring-boot-starter-web`에 포함 | `spring-boot-restclient` 별도 모듈 |
| 테스트 의존성 | `spring-boot-starter-test`로 충분 | `spring-boot-starter-restclient-test` 추가 필요 |

---

### 5. @Version과 TestController reset — version 수동 리셋 필요 여부

#### 증상 (의문)

Concert 엔티티에 `@Version`을 추가한 후, `POST /api/test/reset`에서 `concert.setStock(100)`만 하면 version이 계속 증가하는데, 테스트 시 문제가 되지 않을까?

#### 결론: 수동 리셋 **불필요**

`@Version`은 **충돌 감지용**이지 비즈니스 로직과 관련이 없다.

- version 값이 0이든 100이든 낙관적 락의 동작에는 영향 없음
- 중요한 것은 "동시에 같은 version을 읽은 두 트랜잭션 중 하나만 성공"하는 것
- `setStock(100)` + `save()` 시 JPA가 알아서 `version = version + 1` 실행
- version을 0으로 리셋할 setter를 만들면 오히려 JPA의 version 관리를 깨뜨릴 위험

---

### 6. 하나의 Entity vs 락 방식별 분리 Entity

#### 증상 (설계 의문)

비관적 락은 `@Version`이 필요 없고, 낙관적 락은 `@Version`이 필요한데 — Entity를 분리해야 할까?

#### 결론: **하나의 Entity 사용**

분리하면 오히려 복잡성이 증가한다:

- 같은 DB 테이블에 두 Entity가 매핑되면 JPA 관리가 복잡해짐
- 비관적 락에서 `@Version`이 있어도 **부작용 없음** — `SELECT ... FOR UPDATE`가 행 자체를 잠그므로 version 충돌이 발생할 수 없음
- Phase 2의 `reserve()` 메서드는 `@Version` 추가로 인해 동작이 약간 달라지지만 (version 불일치 시 예외 발생), Phase 2는 이미 overselling을 증명하는 것이 목적이므로 문제 없음

---

## 회고

### 잘된 점

1. **TDD 방식으로 진행**
   - 테스트 코드를 먼저 작성하고, 그에 맞춰 구현을 진행하는 흐름을 유지했다.
   - API 단위 테스트 → 서비스 동시성 테스트 → API 동시성 테스트 순서로 검증 범위를 점진적으로 넓혔다.

2. **Phase 2 코드를 유지하면서 Phase 3 확장**
   - 기존 `reserve()` 메서드를 삭제하지 않고, 새로운 메서드(`reserveWithPessimisticLock`, `reserveWithOptimisticLock`)를 추가하는 방식으로 구현했다.
   - 동일한 테스트 구조로 Phase 2와 Phase 3의 결과를 직접 비교할 수 있다.

3. **Testcontainers를 활용한 실제 DB 테스트**
   - Mock이 아닌 실제 PostgreSQL 컨테이너에서 테스트하므로, `SELECT ... FOR UPDATE`나 `@Version`의 실제 동작을 검증할 수 있다.
   - Mock으로는 DB 락의 정합성을 검증하는 것이 불가능하다.

4. **3단계 테스트 전략**
   - 각 락 방식마다 API 단위(정상/에러) + 서비스 동시성 + API 동시성 총 4개 테스트를 작성했다.
   - 서비스 레이어 테스트는 순수 비즈니스 로직을, API 레이어 테스트는 HTTP 레이어까지 포함한 통합을 검증한다.

### 어려웠던 점

1. **Spring Boot 4.x 마이그레이션 이슈**
   - `spring-retry` → 네이티브 retry, `TestRestTemplate` 패키지 변경 등 Spring Boot 4.x의 변경사항이 아직 문서화가 부족하여 찾는 데 시간이 걸렸다.
   - 특히 `@Retryable`의 속성명이 모두 변경된 것은 인터넷 검색으로도 쉽게 나오지 않았다.

2. **낙관적 락의 재시도 횟수 결정**
   - `maxRetries = 4` (총 5회)로 설정했지만, 100 스레드 동시 접근 시 충돌이 매우 심하여 일부가 재시도를 모두 소진할 수 있다.
   - 재시도 횟수를 늘리면 성공률은 올라가지만 응답 시간이 길어지는 트레이드오프가 있다.
   - 이 시나리오(100석에 100명 동시접근)는 낙관적 락에게 매우 불리한 조건이다 — 실제로는 충돌이 드문 상황에서 낙관적 락이 적합하다.

3. **`@Version`이 Phase 2 테스트에 미치는 영향**
   - Concert 엔티티에 `@Version`을 추가하면 Phase 2의 `reserve()` 메서드 동작도 달라진다.
   - Phase 2에서는 Lost Update가 발생해야 하는데, `@Version`이 있으면 충돌이 감지되어 예외가 발생한다.
   - 별도 브랜치(`phase/2-no-lock`, `phase/3-db-lock`)로 분리하여 관리하는 것으로 해결했다.

### 배운 점

1. **비관적 락과 낙관적 락은 상황에 따라 선택해야 한다**
   - 충돌이 빈번한 시나리오(좌석 100석에 100명 동시 예약) → 비관적 락이 유리 (모든 요청 성공 보장)
   - 충돌이 드문 시나리오(읽기 위주, 가끔 수정) → 낙관적 락이 유리 (락 대기 없이 높은 처리량)

2. **"빠르지만 틀린" vs "느리지만 정확한"**
   - Phase 2는 RPS가 높지만 데이터 정합성이 깨졌다.
   - Phase 3은 RPS가 낮아지지만 정합성이 보장된다.
   - 동시성 제어의 본질은 "성능을 약간 희생하여 데이터 정확성을 보장하는 것"이다.

3. **Spring Framework 7의 네이티브 retry**
   - 외부 라이브러리(`spring-retry`) 없이도 `@Retryable`을 사용할 수 있게 되었다.
   - 의존성이 줄어든 것은 좋지만, 기존 코드를 마이그레이션할 때 속성명 변경에 주의해야 한다.
