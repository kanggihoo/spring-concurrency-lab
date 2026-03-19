k6 설치

[참고](https://grafana.com/docs/k6/latest/set-up/install-k6/)

로컬 설치

```
winget install k6 --source winget
```

도커 설치

```
docker pull grafana/k6
```

1. 로컬에 있는 스크립트 파일을 실행하기 (추천)
   현재 작업 중인 폴더에 있는 .js 파일을 도커 컨테이너 안으로 **마운트(연결)**해서 실행하는 방식입니다.

bash

```
# Windows PowerShell 기준

docker run --rm -v ${PWD}:/scripts grafana/k6 run /scripts/scripts/baseline.js
```
