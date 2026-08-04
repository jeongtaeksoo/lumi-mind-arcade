# LUMI’S MIND ARCADE — Design QA

## Source visual truth

- Source: `/Users/taeksoojung/.codex/generated_images/019fcb5e-81c0-7aa1-8248-ff42958ebb14/exec-3a763a1b-5abb-496b-9471-22f222d9f42c.png`
- The source is the user-selected three-state design board: home, round play, and completion.
- Source pixels: 1672 × 942. It is a composite board, so each state was compared by composition and content rather than as one browser viewport.

## Rendered implementation evidence

- Home: `/tmp/lumi-home-final.png`
- Round play: `/tmp/lumi-round-final.png`
- Completion: `/tmp/lumi-result-ref9.png`
- Browser viewport: 1624 × 850 CSS px, desktop, device scale factor 1.
- Mobile spot check: 390 × 844 CSS px.

## State and interaction coverage

- Home screen with Korean copy, three mode cards, shortcut cards, daily tip, and mascot.
- Round screen with round/mode/score/heart HUD, interactive playfield, partner rail, progress bar, and heart loss behavior.
- Completion screen with final score, three cognitive metrics, saved-record banner, retry/share actions, and return-to-home action.
- Mobile home and round layouts checked at 390 × 844.
- Browser console checked after local playtest: no errors.

## Comparison history

### First comparison

- Finding: home was missing the source board’s shortcut row and daily tip; the visual hierarchy was dominated by a large LUMI lockup.
- Finding: round HUD did not have the source’s explicit round/mode/score/heart grouping, and the companion rail lacked the three small mode indicators.
- Finding: completion screen used four mixed stat cards and generic “플레이 완료!” copy instead of the source’s three cognitive metrics and “훌륭해요! 라운드 클리어” hierarchy.

### Fixes applied

- Rebuilt the home information hierarchy around “마음의 퍼즐, 집중의 즐거움”, three mode cards, three shortcut cards, and the tip bar.
- Added the source-style HUD mode block, progress caption, “나의 파트너” rail, and compact focus/memory/pattern indicators.
- Reworked completion copy, three metric cards, record banner, action labels, and main-return button.
- Replaced the mascot sprite with the original five-state crystal mascot asset and aligned its scale/position by state.
- Fixed screen-transition anchoring so home, round, and completion states open at the top of the viewport.

## Required fidelity surfaces

- Fonts and typography: Korean display hierarchy, compact labels, bold gradient headline treatment, and small utility copy were checked against the source board. The browser uses the existing Pretendard/Apple SD Gothic Neo/system fallback stack.
- Spacing and layout rhythm: left content column, large right visual field, 4-part round HUD, 2-column play layout, and completion panel spacing were checked at the desktop viewport; responsive adjustments were checked at 390 px.
- Colors and visual tokens: dark indigo space background, cyan/violet/coral accents, gold score treatment, pink hearts, translucent navy panels, and neon borders are consistently tokenized in `styles.css`.
- Image quality and asset fidelity: the mascot is an original generated asset processed to transparency; no copied character, logo, or external IP is used.
- Copy and content: Korean labels match the source intent: 집중 모드, 기억 모드, 패턴 모드, 나의 파트너, 훌륭해요! 라운드 클리어, 최종 점수, 다시 도전, 결과 공유, 메인으로 돌아가기.

## Final result

passed

## Game loop pass — 2026-08-04

- Added a visible `1 / 3` stage HUD and dynamic stage tracker for every round.
- Each round now runs all three modes exactly once; the tracker reflects the shuffled order.
- Focus mode has a visible countdown timer: 5.0s → 4.0s → 3.5s → 2.8s → 2.0s by round.
- Verified pause freezes the timer, five wrong clicks reach `남은 하트 0개`, and the result screen opens.
- Verified desktop at 1440 × 900 and mobile at 390 × 844.
- Browser console logs: empty after the tested flows.
- Memory mode cards are vertically and horizontally centered inside the playfield on desktop and mobile.
