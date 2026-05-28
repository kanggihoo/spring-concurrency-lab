# Docusaurus Portfolio MDX 지침

이 문서는 `report.md`가 기술 보고서로 충분하다고 판단된 뒤, 공개용 `portfolio.mdx`를 만들거나 구조를 제안할 때만 읽는다.

## 역할 분리

- `report.md`: evidence-backed technical report. 상세 실험, 원자료 링크, 측정 한계, 판단 근거를 보존한다.
- `portfolio.mdx`: interviewer-readable backend case study. 문제, 접근, 핵심 지표, 해석, 의사결정, 역량 포인트를 3-5분 안에 전달한다.

`portfolio.mdx`는 `report.md`의 축약 복사본이 아니다. `report.md`가 충분하면 내용을 반복하지 말고 `Full technical report: ./report.md` 링크를 남긴다.

## 파일 위치

기본 위치:

```text
docs/phases/<phase>/portfolio.mdx
```

관련 파일:

```text
docs/phases/<phase>/report.md
docs/phases/<phase>/README.md
docs/evidence/<phase>/
docs/phases/<phase>/assets/
```

여러 프로젝트를 하나의 Docusaurus 사이트로 배포한다면, 프로젝트 repo에는 `portfolio.mdx` 원본을 두고 별도 portfolio site repo로 복사하거나 export한다.

## 필수 Frontmatter

```mdx
---
title: "Phase 04: DB Operational Limits"
sidebar_label: "04. DB Operational Limits"
description: "High-contention DB reservation workload에서 connection pool과 row lock 병목을 분석한 case study"
tags: [spring, postgresql, k6, performance, concurrency]
---
```

## 추천 구조

```mdx
# Phase 04: DB Operational Limits

## 한 줄 요약
[이 phase에서 검증한 내용을 1-2문장으로 요약]

## 문제
[왜 이 문제가 백엔드 관점에서 중요한지]

## 가설과 접근
[어떤 가설을 세웠고 어떤 실험으로 검증했는지]

## 실험 조건
- Project:
- Phase:
- Workload:
- VUs / Duration:
- Data size:
- Target endpoint:
- Metrics:

## 핵심 결과
[대표 표 1-2개 또는 그래프]

## 해석과 의사결정
[결과를 어떻게 해석했고 어떤 결정을 내렸는지]

## 백엔드 역량 포인트
- [동시성, DB, 성능 측정, 운영 관점 등 구체 역량]

## 한계와 다음 단계
[아직 증명하지 못한 것과 다음 실험]

## References
- Full technical report: [report.md](./report.md)
- Evidence: [docs/evidence/<phase>](../../evidence/<phase>/)
```

## 시각화 지침

이미지가 없어도 그래프를 만들 수 있다. Docusaurus/MDX에서는 React chart component를 사용해 표 데이터나 JSON을 그래프로 렌더링할 수 있다.

권장 순서:

1. 대표 수치가 적으면 Markdown 표를 사용한다.
2. 비교 추세가 중요하면 `portfolio-data.json`과 React chart component를 사용한다.
3. Grafana 캡처나 SQL plan처럼 원본 화면이 중요한 경우 이미지를 사용한다.
4. 기존 standalone HTML 그래프는 직접 붙이지 말고 React component로 변환하거나 `static/`에 두고 iframe으로 연결한다.

예시:

```mdx
import MetricChart from '@site/src/components/MetricChart';
import data from './portfolio-data.json';

<MetricChart
  title="RPS by Pool Size"
  data={data.atomicPool}
  xKey="pool"
  yKey="rps"
/>
```

## 작성 원칙

- 면접관이 3-5분 안에 문제, 접근, 측정, 결과, 역량을 이해해야 한다.
- 긴 표와 상세 raw evidence는 `report.md`로 보낸다.
- 모든 지표에는 단위와 측정 조건을 붙인다.
- phase만 떼어 별도 사이트로 옮겨도 맥락이 유지되도록 프로젝트명, phase명, workload, 데이터 규모를 명시한다.
- 실패나 애매한 결과는 숨기지 말고 한계와 다음 실험으로 정리한다.
- "좋아졌다"보다 "무엇이 얼마나 변했고 왜 그렇게 해석했는지"를 쓴다.
