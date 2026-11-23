/* works.js — 작품 목록. 새 인터랙티브 페이지를 추가할 때 여기에 한 항목 넣으면 된다.
 *
 *   no       화면에 찍히는 일련번호. 문자열 두 자리로 적는다.
 *   slug     works/ 아래 폴더 이름. 경로는 이 값으로 만들어진다.
 *   title    제목. 카드 캡션과 인덱스의 큰 글자.
 *   year     제작 연도.
 *   tags     분류. 필터 항목이 여기서 자동으로 만들어진다.
 *   preview  previews.js 에 등록된 스케치 키. 없으면 빈 블록으로 그려진다.
 *   ratio    카드 비율. "4/5" | "1/1" | "16/10" 중 하나.
 *   span     12칼럼 그리드에서 차지할 칼럼 수(4~7). 엇갈린 리듬을 만든다.
 *   drop     위에서 밀어내릴 단 수(0~2). 그리드를 비대칭으로 만든다.
 *   status   "live" 면 클릭 시 이동, "wip" 면 준비 중으로 잠긴다.
 *
 * 세로로 긴 비율(4/5)은 좁은 span 에만 둔다. 넓은 span 에 물리면
 * 카드 한 장이 화면 높이를 넘는다.
 */
window.WORKS = [
  { no: '01', slug: '01-drift',    title: '표류',   year: '2026', tags: ['생성', '캔버스', '커서'], preview: 'drift',    ratio: '16/10', span: 6, drop: 0, status: 'live' },
  { no: '02', slug: '02-slice',    title: '분절',   year: '2026', tags: ['타이포', '스크롤'],       preview: 'slice',    ratio: '4/5',   span: 5, drop: 1, status: 'live' },
  { no: '03', slug: '03-halftone', title: '망점',   year: '2026', tags: ['생성', '커서'],           preview: 'halftone', ratio: '1/1',   span: 4, drop: 0, status: 'live' },
  { no: '04', slug: '04-orbit',    title: '궤도',   year: '2026', tags: ['생성', '캔버스'],         preview: 'orbit',    ratio: '4/5',   span: 5, drop: 2, status: 'wip'  },
  { no: '05', slug: '05-stack',    title: '적층',   year: '2026', tags: ['레이아웃', '스크롤'],     preview: 'stack',    ratio: '16/10', span: 7, drop: 0, status: 'wip'  },
  { no: '06', slug: '06-mesh',     title: '결절',   year: '2026', tags: ['생성', '커서'],           preview: 'mesh',     ratio: '1/1',   span: 4, drop: 1, status: 'wip'  },
];
