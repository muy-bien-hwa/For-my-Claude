# Selected Interactive Work

인터랙티브 웹 디자인 작업을 한 사이트에 모아 보여주는 포트폴리오 모음집.

**사이트**: https://muy-bien-hwa.github.io/For-my-Claude/gallery/

목록은 앨범(그리드)과 번호가 매겨진 인덱스 두 가지로 볼 수 있고, 항목을 고르면 그 작업의 독립된 페이지로 들어간다.

## 폴더 구조

```
gallery/
├── index.html                 목록 페이지
├── assets/
│   ├── style.css              디자인 시스템 (토큰·그리드·카드·인덱스)
│   ├── works.js               작품 목록 — 새 작업을 추가하는 곳
│   ├── previews.js            카드 썸네일로 쓰는 라이브 캔버스 스케치 + 러너
│   └── gallery.js             렌더링·뷰 전환·필터·커서·등장
└── works/
    ├── _shared/               작품 페이지 공통 껍데기 (상단 바, 설명 패널, 토큰)
    ├── _template/             새 작업 시작용 빈 틀 (배포에서 제외됨)
    ├── 01-drift/              표류 — 흐름장
    ├── 02-slice/              분절 — 스크롤 타이포
    └── 03-halftone/           망점 — 오프스크린 샘플링
```

빌드 과정이 없다. 파일을 열거나 아무 정적 서버로 띄우면 그대로 돌아간다.

```bash
cd gallery && python3 -m http.server 8000   # http://localhost:8000
```

> `file://` 로 직접 열어도 동작하도록 ES 모듈 대신 클래식 스크립트를 쓴다. 새 코드를 더할 때도 이 방식을 유지하는 편이 편하다.

## 새 작업 추가하기

### 1. 폴더 만들기

```bash
cp -r works/_template works/07-이름
```

`_template/index.html` 안의 `TODO` 를 전부 채운다. 번호·제목·설명·`work-bar__no` 까지.

### 2. `assets/works.js` 에 항목 추가

```js
{
  no: '07',               // 화면에 찍히는 일련번호. 두 자리 문자열.
  slug: '07-이름',         // works/ 아래 폴더 이름과 똑같아야 한다.
  title: '한글 제목',
  latin: 'Latin',         // 그리드 캡션과 인덱스의 이탤릭 부제
  year: '2026',
  tags: ['generative'],   // 필터 항목이 여기서 자동으로 만들어진다
  note: '한 줄 설명',
  preview: 'mesh',        // previews.js 에 등록된 스케치 키
  ratio: '4/5',           // '4/5' | '1/1' | '16/10'
  span: 5,                // 12칼럼 중 차지할 폭 (4~7)
  drop: 1,                // 아래로 밀어낼 단 수 (0~2) — 그리드를 비대칭으로
  status: 'live',         // 'live' 면 이동, 'wip' 면 준비 중으로 잠금
}
```

`span` 과 `drop` 이 그리드의 리듬을 만든다. 한 줄에 12를 꽉 채우지 않는 편이 낫다 — 남는 칼럼이 여백이 된다.

### 3. 썸네일 스케치 등록

`assets/previews.js` 의 `PREVIEWS` 객체에 함수를 하나 더한다.

```js
myKey: function (ctx, w, h, t, p) {
  clear(ctx, w, h);
  // ctx  CSS 픽셀 좌표계로 이미 보정된 2D 컨텍스트
  // w,h  CSS 픽셀 크기
  // t    마운트 후 흐른 시간(초)
  // p    포인터 { x, y, inside } — x,y 는 0~1
}
```

매 프레임 전체를 다시 그린다. 상태를 들고 있지 않으므로 어느 카드에 붙여도, 몇 개를 동시에 돌려도 서로 간섭하지 않는다. 러너가 화면에 보이는 캔버스만 하나의 `requestAnimationFrame` 으로 돌리고, 탭이 가려지거나 카드가 화면 밖으로 나가면 멈춘다.

작품 페이지에서도 같은 러너를 쓸 수 있다:

```js
var entry = PreviewRunner.mount(canvasEl, 'myKey');
PreviewRunner.track(entry, hostEl);   // hostEl 위의 포인터를 스케치에 흘려보낸다
```

## 디자인 규칙

레퍼런스는 awwwards 포트폴리오 부문. "AI가 만든 티"를 내지 않기 위해 아래를 지킨다.

| 안 쓴다 | 대신 쓴다 |
|---|---|
| `border-radius` (알약 버튼, 둥근 카드) | 전역 0. 모서리는 전부 각지게 |
| `box-shadow` | 1px 괘선과 여백으로만 깊이를 만든다 |
| 그라디언트 | 단색 + 강조색 하나(벽돌색 `#c33c1e`) |
| 중앙 정렬 `max-width` 컨테이너 | 화면 가장자리까지 쓰는 12칼럼 그리드 |
| 균일한 3단 카드 그리드 | `span`·`drop` 으로 엇갈리게 배치 |
| 이모지 아이콘 | 모노스페이스 대문자 라벨, 넓은 자간 |

서체는 **Instrument Serif**(디스플레이) · **Azeret Mono**(라벨·수치) · **Gowun Batang**(한글 본문) 세 벌을 Google Fonts 한 번의 요청으로 받는다.

## 접근성과 성능

- `prefers-reduced-motion: reduce` 를 존중한다. 커스텀 커서와 커서 미리보기는 꺼지고, 캔버스는 한 장면만 그리고 멈춘다.
- 커스텀 커서는 `(hover: hover) and (pointer: fine)` 에서만 켜진다. 터치 기기에서는 기본 동작.
- 모든 캔버스는 `devicePixelRatio` 를 최대 2까지 보정한다.
- 보기 방식은 `localStorage` 에 남는다. 차단 환경에서 던지는 경우를 감싸 두었다.
- 키보드: 목록에서 `G`·`I` 로 보기 전환, 작품에서 `I` 로 설명 패널, `ESC` 로 목록 복귀.

## 아직 비어 있는 것

- `04-orbit`, `05-stack`, `06-mesh` 는 썸네일 스케치만 있고 작품 페이지가 없다. `works.js` 에서 `status: 'wip'` 로 잠겨 있다.
- 머리글의 `HWA*` 마크와 "Selected / Interactive / Work" 문구는 자리만 잡아 둔 것이다.
