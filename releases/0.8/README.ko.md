---
title: 루틴과 연속 기록, Todoist, 일정 상태, 한눈에 보는 마감일
---
Mitra 0.8에서는 루틴에 전용 공간이 생겨, 각 루틴이 어떻게 되어 가는지 보고 연속 기록을 이어 갈 수 있습니다. 또 Todoist에 연결되고, 작업의 마감 시점과 일정이 예정대로 진행되는지를 보여 주며, 네 가지 언어가 추가되었고, 작은 개선과 수정도 많이 있습니다.

## 루틴과 연속 기록
Mitra는 이미 헬스장이나 5주마다 하는 이발처럼 자주 하는 일을 루틴으로 모아 왔습니다. 이제 루틴에 전용 공간이 생겨, 불꽃으로 각 루틴의 연속 기록을 한눈에 보여 주고, 자세히 보기에서 지킨 날, 취소한 날, 놓친 날을 보여 줍니다. 루틴의 이름을 바꾸거나, 함께 묶여야 할 두 루틴을 합치거나, 어떤 일이 루틴이 아니라고 Mitra에 알려 줄 수 있습니다. 루틴은 월 보기와 연도 보기에서 아무리 멀리 스크롤해도 안정적으로 유지되며, AI 커넥터도 루틴이 어떻게 되어 가는지 알려 줄 수 있습니다. 탭에는 **오늘** 돌아오는 루틴이 먼저, 그다음 **현재 루틴**이 나오고, 오래전에 돌아온 루틴은 **지난 루틴** 아래에 접혀 들어갑니다. 업무 캘린더처럼 어떤 캘린더의 루틴을 빼려면 그 캘린더 메뉴에서 **루틴 숨기기**를 선택하세요.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="routines-dark.webp">
	<img src="routines-light.webp" alt="월 보기 옆의 루틴 탭. 루틴마다 연속 기록이 표시되고, 헬스장 루틴의 자세히 보기가 그 행 옆에 열려 있습니다">
</picture>

문서: [루틴](../../docs/routines.md)

## 어디서나 같은 시각
시간대와 상관없는 일도 있습니다. 7:30에 먹는 약은 집에서든 여행 중이든 7:30입니다. 항목의 시간대 목록 맨 위에서 **어디서나 같은 시각**을 고르면, 어디에 있든 그 시각에 머물며 가위표 친 지구본으로 표시됩니다. 다른 앱에서 시간대 없이 온 항목에도 이 표시가 나타납니다. 이런 항목을 Google 캘린더처럼 이런 시간을 담지 못하는 캘린더로 옮기기 전에, Mitra가 고정된 시간대가 지정된다고 알려 줍니다.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="same-time-dark.webp">
	<img src="same-time-light.webp" alt="아침 약 복용 항목의 편집기. 시간대 목록이 어디서나 같은 시각에 열려 있습니다">
</picture>

문서: [어디서나 같은 시각](../../docs/time-zones.md#same-time-everywhere)

## 일정 상태
이제 일정도 작업처럼 자체 상태를 가집니다. **확정**, **미정**, **취소됨** 중 하나입니다. 취소된 일정은 취소선이 그어진 채 자리를 지키므로 일어나지 않은 일의 기록이 남고, 루틴도 이를 셉니다. 미정인 일정은 결정할 때까지 흐리게 표시됩니다. 상태는 다른 CalDAV 앱과 동기화되며, 표 보기에서도 작업의 상태 옆에 나열됩니다. 이제 **완료된 작업 숨기기**는 완료된 작업만 숨기고, 새로운 **취소된 항목 숨기기**는 취소된 작업과 일정을 숨깁니다.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="event-status-dark.webp">
	<img src="event-status-light.webp" alt="일정 편집기. 상태 메뉴가 확정, 미정, 취소됨으로 열려 있습니다">
</picture>

문서: [일정 상태](../../docs/entries.md#event-status)

## 한눈에 보는 마감일
일정이 잡힌 작업은 이제 깃발에 마감 시점을 바로 보여 줍니다. 얼마나 가까운지에 따라 시각, 요일 또는 날짜로 표시됩니다. 주 보기나 월 보기, 또는 타임라인에서 작업에 포인터를 올리면 작업이 마감일까지 늘어나 보이므로, 여유가 얼마나 남았는지 알 수 있습니다. 마감일보다 늦게 끝나도록 일정을 잡았다면 깃발이 빨간색으로 바뀝니다. 그리고 표 보기에 마감일 열이 새로 생겼습니다.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="due-stretch-dark.webp">
	<img src="due-stretch-light.webp" alt="화요일 작업에 포인터를 올리면, 수요일 기획 회의가 시작하는 마감일까지 작업이 늘어납니다">
</picture>

문서: [계획](../../docs/planning.md#set-a-due-date)

## 개인 설정
캘린더마다 새로 추가된 두 가지 색 중 하나나 원하는 아무 색이나 지정하세요. 계정 머리글을 두 번 클릭해 이름을 바꾸고, 그 계정의 캘린더를 한 번에 모두 숨길 수 있습니다.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="personalization-dark.webp">
	<img src="personalization-light.webp" alt="사이드바에 열린 캘린더 메뉴. 색이 칠해질 캘린더 옆에 색 선택지가 나와 있습니다">
</picture>

## 사용자 지정 CSS
Mitra의 모양은 순수한 CSS로 되어 있고, 이제 그 위에 직접 CSS를 더할 수 있습니다. **설정 → 일반 → 사용자 지정 CSS**를 열고 규칙을 입력하세요. 입력하는 대로 Mitra에 적용되고 계정에 보관되므로, 모든 기기에 따라갑니다. Mitra에 좋아하는 색을 입히거나, 모든 모서리를 각지게 하거나, 쓰지 않는 것을 숨겨 보세요. 사람들이 로그인하는 서버에서는 관리자가 **관리** 아래에서 **모두를 위한 사용자 지정 CSS**도 찾을 수 있어, 서버 전체의 모양을 정할 수 있습니다.

입력란 아래의 **GitHub에 공유**를 누르면 스타일시트가 미리 들어간 글이 [사용자 지정 CSS 토론](https://github.com/a11delavar/mitra/discussions/categories/custom-css)에 작성되며, 다른 사람들이 만든 것도 거기서 찾을 수 있습니다. Mitra 1.0 전까지는 업데이트로 규칙이 대상으로 삼는 요소가 바뀔 수 있으니, 업데이트한 뒤에 한번 확인해 보세요.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="custom-css-dark.webp">
	<img src="custom-css-light.webp" alt="로고의 금색으로 꾸민 Mitra. 그렇게 만드는 사용자 지정 CSS 규칙이 설정에 열려 있습니다">
</picture>

문서: [사용자 지정 CSS](../../docs/custom-css.md)

## 다른 날짜에 복제
어떤 반복으로도 설명할 수 없는 날짜에 일어나는 일도 있습니다. 물리 치료 8회 처방은 병원에 빈자리가 있는 날마다 잡히고, 고객은 3일, 9일, 17일로 예약을 합니다. 첫 번째 항목을 추가하고 ⋯ 메뉴에서 **다른 날짜에 복제**를 선택한 다음, 표시되는 두 달에서 나머지 날짜를 체크하세요. Shift를 누르면 연속된 날짜를 한 번에 고를 수 있습니다. 날짜마다 같은 시간에 사본이 생기며, 각각 다른 항목처럼 옮기거나 바꿀 수 있는 독립된 항목입니다.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="duplicate-days-dark.webp">
	<img src="duplicate-days-light.webp" alt="물리 치료 항목의 다른 날짜에 복제 대화 상자. 10월과 11월에 일곱 번의 치료가 더 선택되어 있습니다">
</picture>

문서: [다른 날짜에 복제](../../docs/entries.md#the--menu)

## Todoist
Todoist 프로젝트를 연결하면 작업이 일정과 같은 타임라인에 놓이고 양방향으로 동기화됩니다. 프로젝트마다 Todoist 색의 캘린더가 됩니다. 작업의 날짜, 소요 시간, 기한은 각각 일정, 길이, 마감일이 됩니다. Todoist에서 반복하는 작업은 다음 날짜에 표시되며, Mitra에서 완료하면 Todoist에서처럼 다음 회차로 넘어갑니다. 우선순위, 라벨, 섹션은 그대로 유지됩니다.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="todoist-dark.webp">
	<img src="todoist-light.webp" alt="연동 추가 대화 상자. 다른 서비스들 사이에서 포인터가 Todoist 위에 있습니다">
</picture>

문서: [Todoist](../../docs/integrations/todoist.md)

## 더 많은 언어
Mitra가 아랍어, 러시아어, 폴란드어, 네덜란드어를 배웠습니다. 릴리스마다 Mitra는 다른 언어, 문자, 달력에서 더 잘 작동하게 되었습니다. 새 언어는 모두 문서와 웹사이트까지 완전히 번역된 상태로 제공됩니다.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="arabic-week-dark.webp">
	<img src="arabic-week-light.webp" alt="아랍어로 표시된 주 보기. 오른쪽에서 왼쪽으로 배치되어 있고, 일정 하나가 편집기에 열려 있습니다">
</picture>

## 기여자
- [@a11delavar](https://github.com/a11delavar)
- [@jkngale](https://github.com/jkngale)
- [@d8monx](https://github.com/d8monx)
- [@libnewton](https://github.com/libnewton)
