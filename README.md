# 20대 학생회
- **홍보×서기 행사**
    - [GitHub 저장소](./typing-writing)
    - [행사 사이트](https://20th.coshsc.kr/typing-writing/)
- **빌리러 오성**
    - [GitHub 저장소](https://github.com/oshs-sc/rental)
    - [사이트](https://coshsc.kr/rental/)

## 저장소와 배포

`oshs-sc` 공용 계정의 20대 학생회 저장소입니다. 기수의 행사별 코드는 하위 폴더에 두고, 기수와 관계없이 운영하는 서비스는 별도 저장소에서 관리합니다.

```text
index.html · style.css        20대 학생회 행사·서비스 목록
CNAME · .nojekyll             GitHub Pages 배포 설정
serve.mjs                    전체 사이트 로컬 서버
typing-writing/              홍보×서기 행사 앱·DB 설정·문서·검증
  typing/                    타자 대회
  write/                     글쓰기
  welcome/                   공개 글
typing/ · write/ · welcome/   이전 주소 연결 페이지
redirect.js                  이전 주소의 쿼리·공유 링크 보존
tests/                       전체 배포 경로 데스크톱 검사
```

GitHub Pages는 `oshs-sc/20th`의 **`main` 브랜치 `/` 루트**를 배포합니다. 도메인은 `20th.coshsc.kr`을 유지합니다. `CNAME`과 `.nojekyll`은 저장소 루트에 둡니다.

- 전체 목록: <https://20th.coshsc.kr/>
- 홍보×서기 행사: <https://20th.coshsc.kr/typing-writing/>
- 타자 대회: <https://20th.coshsc.kr/typing-writing/typing/>
- 글쓰기: <https://20th.coshsc.kr/typing-writing/write/>
- 공개 글: <https://20th.coshsc.kr/typing-writing/welcome/>

기존 `/typing/`, `/write/`, `/welcome/` 및 각 `/admin/` 주소는 같은 기능의 새 주소로 연결합니다. 쿼리와 `#letter=…`, `#account` 같은 조각 주소도 유지합니다.

## 로컬 실행

저장소 루트에서 실행합니다. 별도 설치·빌드는 없습니다.

```sh
node serve.mjs 5177
```

`http://127.0.0.1:5177/`에서 전체 목록과 새 행사 경로, 이전 주소 연결을 함께 확인합니다. 행사 자체의 Firebase 설정·운영 절차는 [행사 README](./typing-writing/README.md)에 있습니다.

행사 내부의 기존 검사만 실행할 때는 `typing-writing/`을 작업 디렉터리로 쓰고 그 안의 서버를 5176 포트로 실행합니다. 배포 경로 검사는 루트 서버 5177을 대상으로 `tests/site-layout-desktop.cjs`에서 실행합니다. 검사에 필요한 Playwright 및 Firebase Emulator 의존성은 별도로 준비해야 합니다.
