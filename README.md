# LUMI’S MIND ARCADE

루미와 함께 5라운드 동안 집중력·기억력·패턴 인식을 훈련하는 3분 브라우저 아케이드 게임입니다.

## 플레이 구조

- 5개의 하트로 시작합니다.
- 한 라운드는 집중·기억·패턴 미니게임 3개를 모두 완료해야 클리어됩니다.
- 세 게임의 순서는 라운드마다 섞이며, 현재 순서는 하단 스테이지 트래커에 표시됩니다.
- 집중 모드는 라운드별 제한시간(5초 → 4초 → 3.5초 → 2.8초 → 2초) 안에 목표를 클릭해야 합니다.
- 잘못된 클릭이나 시간 초과마다 하트가 하나 줄어듭니다.
- Round 5는 `최종 1`, `최종 2`처럼 세 게임 사이클이 계속되며, 하트가 모두 사라질 때까지 이어집니다.
- 결과 화면에서 기록을 다시 도전하거나 공유할 수 있습니다.

게임 규칙과 난이도 곡선은 [GAME_SPEC.md](./GAME_SPEC.md)에 정리되어 있습니다.

## 음악

- 메인 화면: `Velvet_Tide.mp3`
- 게임 플레이: `Origami_Pavements.mp3`
- 브라우저 자동재생 제한을 고려해 첫 화면 상호작용 후 재생되며, 메인 화면의 음악 버튼으로 켜고 끌 수 있습니다.

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
