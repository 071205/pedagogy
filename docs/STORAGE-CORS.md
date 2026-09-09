# Storage 버킷 CORS — 왜 필요하고 무엇을 하나

## 무엇 때문에

모의고사 그림은 Firestore 문서가 아니라 **Storage** 에 있고 문항에는 주소만 남는다
(문서에 담으면 시험지 한 부가 1MiB 한도를 그냥 넘는다 — `docs/MOCK-LIBRARY-DESIGN.md`).

그런데 **한글(HWPX) 내보내기는 그림의 바이트가 필요하다.** 그래서 편집기가 내보내기
직전에 그 주소를 `fetch` 해서 바이트로 바꾼다(`resolveFigureBytes()`).

⚠️ **조판기에 '주소' 개념을 넣지 않으려고 일부러 여기서 바꾼다.** `hwpx-exam.js` 와
`mock_to_hwpx.py` 는 서로 옮겨 적은 사본이고 `npm run test:hwpx-exam` 이 둘을 대조한다 —
한쪽에만 네트워크 개념이 들어가면 그 대조가 무너진다.

`<img src>` 로 그리는 것(미리보기·편집기 썸네일)은 CORS 가 필요 없다. **`fetch` 만**
필요하다. 그래서 CORS 를 안 걸어도 **화면은 멀쩡하고 내보내기만** 그림이 빠진다 —
그때 조용히 자리표시로 나가지 않고 사용자에게 말한다("그림 N장을 가져오지 못해…").

## 무엇을 하나

`storage-cors.json` 을 버킷에 건다. **읽기(GET)만** 열고, 우리 출처만 허용한다.

```bash
# 1) 구글 클라우드 SDK 가 없으면 (sudo 없이 홈 디렉터리에 설치된다)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# 2) 계정 인증 (브라우저가 열린다 — 해리가 직접 해야 하는 단계다)
gcloud auth login
gcloud config set project pedagogy-huryul

# 3) 지금 걸린 설정을 먼저 본다 (되돌릴 근거를 남긴다)
gcloud storage buckets describe gs://pedagogy-huryul.firebasestorage.app --format="default(cors_config)"

# 4) 건다
gcloud storage buckets update gs://pedagogy-huryul.firebasestorage.app \
  --cors-file=storage-cors.json

# 5) 다시 읽어 확인
gcloud storage buckets describe gs://pedagogy-huryul.firebasestorage.app --format="default(cors_config)"
```

⚠️ **버킷 이름이 `*.firebasestorage.app` 이다**(예전 `*.appspot.com` 이 아니다).
`index.html` 의 `firebaseConfig.storageBucket` 이 정답표다.

## 되돌리기

3번에서 찍어 둔 예전 설정을 파일로 만들어 다시 `--cors-file` 로 걸면 된다.
아무것도 안 걸려 있었다면 빈 배열(`[]`) 파일로 되돌린다.

## 확인

배포본에서 **그림이 든 모의고사를 만든 기기가 아닌 다른 기기**로 로그인해
`한글 내보내기` 를 누른다. "그림 N장을 가져오지 못해 자리표시로 나갑니다" 토스트가
뜨지 않으면 된 것이다.

⚠️ **같은 기기에서는 CORS 없이도 성공한다** — 그림을 올린 그 세션에는 바이트가 아직
메모리에 있기 때문이다. 반드시 **다른 기기·다른 브라우저**로 확인할 것.
