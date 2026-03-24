import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

// K6 커스텀 메트릭스: 에러 상황별로 프로메테우스에서 분석할 수 있게 분리합니다.
const successCounter = new Counter('reservation_success_count');
const soldOutCounter = new Counter('reservation_sold_out_count');
const optimisticLockExhaustedCounter = new Counter('reservation_optimistic_exhausted_count');
const pessimisticLockTimeoutCounter = new Counter('reservation_pessimistic_timeout_count');
const serverErrorCounter = new Counter('reservation_server_error_count');
const networkTimeoutCounter = new Counter('reservation_network_timeout_count');

// 테스트 대상 환경 변수 로드 (none, pessimistic, optimistic)
const LOCK_TYPE = __ENV.LOCK_TYPE || 'none';

// 락 방식별로 타격할 URL과 서로 다른 콘서트 ID(재고 10000개짜리)를 할당
const CONFIG = {
    'none': {
        url: 'http://host.docker.internal:8080/api/reservations',
        concertId: 2
    },
    'pessimistic': {
        url: 'http://host.docker.internal:8080/api/reservations/pessimistic',
        concertId: 3
    },
    'optimistic': {
        url: 'http://host.docker.internal:8080/api/reservations/optimistic',
        concertId: 4
    }
};

const targetConfig = CONFIG[LOCK_TYPE];

export const options = {
    scenarios: {
        spike_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 200 }, // 10초 만에 요청자 200명까지 램핑 
                { duration: '30s', target: 200 }, // 최대 부하 30초 유지
                { duration: '5s', target: 0 },    // 부하 감소
            ],
            // [매우 중요] 이 태그가 프로메테우스의 Label 로 들어가서 그라파나에서 필터링이 가능해집니다.
            tags: { test_type: LOCK_TYPE }, 
        },
    },
};

export default function () {
    const payload = JSON.stringify({
        concertId: targetConfig.concertId,
        userId: __VU + __ITER * 1000 // 요청마다 고유 유저 아이디 생성
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
    };

    // 실제 API 호출 
    const res = http.post(targetConfig.url, payload, params);

    // 응답 상태 검증 (K6 콘솔용)
    // 의도된 비즈니스 응답 및 상태(200, 408, 409 등)는 시스템 붕괴가 아니므로 pass로 간주
    // 네트워크 오류(0)나 서버 에러(500 이상)인 경우에만 fail 처리
    check(res, {
        'is not server error or timeout': (r) => r.status !== 0 && r.status < 500,
    });

    // 상태 코드와 JSON Message 를 파싱하여 구체적 메트릭 카운터 증가 (그라파나용)
    if (res.status === 200) {
        successCounter.add(1);
    } else if (res.status === 409) {
        try {
            const body = res.json();
            if (body.status === 'sold_out') {
                soldOutCounter.add(1); // 찐 재고 소진 매진
            } else if (body.status === 'optimistic_lock_exhausted') {
                optimisticLockExhaustedCounter.add(1); // 운이 없는 낙관적 락 재시도 횟수 초과 
            }
        } catch (e) {
            // JSON 파싱 실패
        }
    } else if (res.status === 408) {
        pessimisticLockTimeoutCounter.add(1); // 줄 서다가 지쳐 쓰러진 비관적 락
    } else if (res.status >= 500) {
        serverErrorCounter.add(1); // 원인 모를 서버 터짐
    } else if (res.status === 0) {
        networkTimeoutCounter.add(1); // 연결 자체가 타임아웃
    }
}
