/* works.js — 작품 목록. 새 인터랙티브 페이지를 추가할 때 여기에 한 줄 넣으면 된다.
 *
 *   no       화면에 찍히는 일련번호. 문자열 두 자리로 적는다.
 *   slug     works/ 아래 폴더 이름. 경로는 이 값으로 만들어진다.
 *   title    한글 제목. 인덱스 뷰의 큰 글자.
 *   latin    라틴 부제. 그리드 뷰 캡션과 디스플레이 타이포에 쓰인다.
 *   year     제작 연도.
 *   tags     분류. 첫 번째 태그가 필터의 기본 분류가 된다.
 *   note     한 줄 설명. 인덱스 뷰에서 펼쳐질 때 보인다.
 *   preview  previews.js 에 등록된 스케치 키. 없으면 빈 블록으로 그려진다.
 *   ratio    카드 비율. "4/5" | "1/1" | "16/10" 중 하나.
 *   span     12칼럼 그리드에서 차지할 칼럼 수(4~7). 엇갈린 리듬을 만든다.
 *   drop     위에서 밀어내릴 단 수(0~2). 그리드를 비대칭으로 만든다.
 *   status   "live" 면 클릭 시 이동, "wip" 면 준비 중으로 잠긴다.
 */
window.WORKS = [
  {
    no: '01',
    slug: '01-drift',
    title: '표류',
    latin: 'Drift',
    year: '2026',
    tags: ['generative', 'canvas', 'cursor'],
    note: '커서가 지나간 자리마다 벡터장이 휘어진다. 흐름은 느리게 원래 각도로 되돌아간다.',
    preview: 'drift',
    ratio: '16/10',
    span: 6,
    drop: 0,
    status: 'live',
  },
  {
    no: '02',
    slug: '02-slice',
    title: '분절',
    latin: 'Slice',
    year: '2026',
    tags: ['typography', 'scroll'],
    note: '디스플레이 타이포를 가로로 자르고 스크롤 속도만큼 어긋내는 실험.',
    preview: 'slice',
    ratio: '4/5',
    span: 5,
    drop: 1,
    status: 'live',
  },
  {
    no: '03',
    slug: '03-halftone',
    title: '망점',
    latin: 'Halftone',
    year: '2026',
    tags: ['generative', 'cursor'],
    note: '화면 전체를 망점으로 환원한다. 커서 주변에서만 점이 커지고 격자가 어긋난다.',
    preview: 'halftone',
    ratio: '1/1',
    span: 4,
    drop: 0,
    status: 'live',
  },
  {
    no: '04',
    slug: '04-orbit',
    title: '궤도',
    latin: 'Orbit',
    year: '2026',
    tags: ['generative', 'canvas'],
    note: '서로 다른 주기로 도는 헤어라인 호(弧)들. 교차점에만 색이 남는다.',
    preview: 'orbit',
    ratio: '4/5',
    span: 5,
    drop: 2,
    status: 'wip',
  },
  {
    no: '05',
    slug: '05-stack',
    title: '적층',
    latin: 'Stack',
    year: '2026',
    tags: ['layout', 'scroll'],
    note: '괘선이 쌓이고 눌린다. 스크롤을 지진계처럼 읽는 레이아웃.',
    preview: 'stack',
    ratio: '16/10',
    span: 7,
    drop: 0,
    status: 'wip',
  },
  {
    no: '06',
    slug: '06-mesh',
    title: '결절',
    latin: 'Mesh',
    year: '2026',
    tags: ['generative', 'cursor'],
    note: '점과 점 사이를 선으로만 잇는다. 빛나는 효과 없이 선 굵기로만 깊이를 만든다.',
    preview: 'mesh',
    ratio: '1/1',
    span: 4,
    drop: 1,
    status: 'wip',
  },
];
