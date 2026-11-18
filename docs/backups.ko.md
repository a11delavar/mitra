---
title: 백업
description: Mitra가 저장하는 모든 것은 폴더 하나에 있습니다. 이미 쓰고 있는 도구로 백업하세요.
---

Mitra는 모든 것을 폴더 하나에 보관합니다. 컨테이너 안의 `/app/data`이며, [시작하기](README.md#install-mitra)를 따랐다면 호스트의 `~/mitra`입니다. 이 폴더를 백업하면 인스턴스 전체를 백업한 것입니다. 덤프할 데이터베이스 서버도, 골라낼 설정 파일도 없습니다.

> [!CAUTION]
> Mitra에 보관하는 것 가운데 일부는 이 폴더가 유일한 사본입니다. [Mitra 캘린더](integrations/mitra.md)의 모든 항목은 이곳에만 있습니다. 계정과 로그인 세션, 연결된 계정의 자격 증명, 설정, 캘린더의 색상과 순서와 이름, [가용 시간](availability.md), 작업 순서, 항목에 [첨부한 파일](attachments.md), 항목 사이의 일부 링크, 기기의 [알림](reminders.md)이 의존하는 키도 마찬가지입니다. 폴더를 잃으면 제공 업체에서 일정과 작업은 되찾을 수 있지만, 나머지는 되찾을 수 없습니다.

## 백업하기

이미 쓰고 있는 도구를 이 폴더에 맞추세요. [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, 파일 시스템이나 VM 스냅숏, 또는 단순한 압축 파일도 좋습니다.

가장 안전한 사본은 Mitra를 멈춘 상태에서 만든 사본입니다.

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

멈출 수 없다면 Mitra가 실행 중일 때 폴더를 복사해도 대개 괜찮습니다. SQLite는 이런 상황을 잘 견딥니다. 파일 시스템이나 VM 스냅숏을 쓰면 아무것도 멈추지 않고 일관된 사본을 얻을 수 있습니다.

## 복원하기

Mitra를 멈추고, 폴더를 되돌려 놓은 다음, 다시 시작하세요.

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

폴더는 통째로 복원하세요. 그 안의 파일들은 한 묶음이어서, 날짜가 다른 파일을 섞으면 인스턴스가 망가질 수 있습니다. 이전 버전의 백업도 새 이미지에 문제없이 복원됩니다. Mitra가 시작할 때 데이터베이스를 업데이트하기 때문입니다.

## 백업에 포함되지 않는 것

[CalDAV](integrations/caldav.md) 서버, [Google 캘린더](integrations/google.md), [Notion](integrations/notion.md) 같은 연결된 계정의 일정과 작업은 해당 제공 업체에 있습니다. 백업에는 Mitra가 가진 사본이 들어 있고, 복원한 뒤에는 Mitra가 다시 동기화합니다.

환경 변수는 데이터 폴더가 아니라 `compose.yaml`이나 `.env` 파일에 있습니다. 버전 관리나 비밀 저장소에 두고 이 파일들도 안전하게 보관하세요.
