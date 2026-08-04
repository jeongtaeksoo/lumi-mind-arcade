# LUMI’S MIND ARCADE

실수를 기억하는 3분 브라우저 아케이드 게임입니다.

## 플레이 구조

- 5개의 하트로 시작합니다.
- 잘못된 클릭을 할 때마다 하트가 하나 줄어듭니다.
- Round 1~4는 집중력·기억력·패턴 찾기 미니게임이 섞여 등장합니다.
- Round 5는 `FINAL 1`, `FINAL 2`처럼 단계가 계속 올라가며, 하트가 모두 사라질 때까지 이어지는 최종 도전입니다.
- 결과 화면에서 기록을 다시 도전하거나 공유할 수 있습니다.

## 실행

별도 빌드 도구 없이 `index.html`을 정적 호스팅하면 됩니다.

```bash
python3 -m http.server 4173
```

그 다음 `http://localhost:4173`을 브라우저에서 여세요.

## GitHub Pages 배포

이 저장소에는 `.github/workflows/pages.yml`이 포함되어 있어 `main`에 push할 때 GitHub Actions가 정적 사이트를 자동 배포합니다.

1. 이 폴더를 GitHub 저장소에 올립니다.
2. 저장소의 **Settings → Pages**에서 **Source: GitHub Actions**를 선택합니다.
3. `main` 브랜치에 push하면 `Deploy LUMI’S MIND ARCADE` workflow가 실행됩니다.
4. Actions 실행 결과에 표시된 `github.io` 링크를 제출합니다.

로그인이나 서버가 필요하지 않은 정적 웹게임이므로 GitHub Pages가 적합합니다.
