# 스크래치 여행 지도

![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Deployed-brightgreen)

함께한 기억을 남기는 여행 스크래치 지도입니다.

[지도 보러 가기](https://zzoroak.github.io/ssun-scratch-map/)

## 데이터 수정하기

방문 기록은 [`data/visited.json`](./data/visited.json)에서 수정합니다.

```json
{
  "id": "39000",
  "label": "제주특별자치도",
  "codes": ["39000", "39020", "39010"],
  "visited": true,
  "color": "#2f80ed",
  "emoji": "🌴"
}
```

| 필드 | 설명 |
| --- | --- |
| `id` | 지역 대표 코드 |
| `label` | 목록과 툴팁에 표시할 지역 이름 |
| `codes` | 지도 데이터와 연결할 행정구역 코드 목록 |
| `visited` | 방문 여부. `true`면 지도에 색칠됩니다. |
| `color` | 지역별 색상 값. 현재 지도 렌더링은 기본 방문 색상을 사용합니다. |
| `emoji` | 지도 위에 표시할 이모지. 표시하지 않으려면 `null`로 둡니다. |
