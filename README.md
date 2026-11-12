# 오늘의 생활 TIP과 명화

날마다 기분전환이 될 생활 TIP 하나와, 그 TIP의 메시지에 어울리는 명화 한 점을 보여주는 웹페이지입니다.

- **배포 주소:** https://hw-today.netlify.app/

## 주요 기능

| 기능 | 설명 |
|---|---|
| 오늘의 생활 TIP | [Advice Slip API](https://api.adviceslip.com/)에서 무작위 생활 조언(TIP)을 받아옵니다. |
| 한국어 번역 | [Microsoft Azure Translator](https://learn.microsoft.com/azure/ai-services/translator/)로 영어 TIP과 명화 제목을 한국어로 번역합니다. (작가 이름은 원어 그대로 표시) |
| 어울리는 명화 | TIP의 핵심 단어로 주제를 정하고, [시카고 미술관(Art Institute of Chicago) API](https://api.artic.edu/docs/)에서 그 주제에 맞는 명화를 찾습니다. |
| 하루 고정 | 같은 날에는 새로고침해도 같은 TIP과 명화가 나옵니다. (브라우저 localStorage에 저장) |
| 새로 받기 | 하루에 한 번, 다른 TIP과 명화를 받을 수 있습니다. |

## 동작 방식

```
TIP 받기 (Advice Slip)
   │
   ├─▶ 한국어 번역 (Azure Translator)
   │
   └─▶ 주제 정하기 (themes.js의 주제 사전)
          │   예) "Never be afraid to try" → afraid, try → 「용기와 도전」
          ▼
       명화 검색 (시카고 미술관 API)
          │   주제의 검색어 중 하나로 저작권이 풀린 작품 검색
          │   → 죽음·전쟁 같은 어두운 작품은 제외 → 무작위로 한 점 선택
          ▼
       명화 제목 번역 (Azure Translator)
          ▼
       화면에 표시 + 브라우저에 오늘 날짜로 저장
```

### TIP과 명화를 잇는 방법: 주제 사전

[themes.js](themes.js)에 8가지 주제(사랑과 관계, 평온과 휴식, 용기와 도전, 노력과 성장, 기쁨과 즐거움, 시간과 인생, 소박한 일상, 자연)를 정의했습니다. 각 주제에는 **TIP에서 찾을 키워드**와 **명화를 찾을 검색어**가 있습니다. TIP 속 단어와 가장 많이 겹치는 주제를 고르고, 해당하는 주제가 없으면 기본 주제(오늘의 영감)를 씁니다.

기분전환을 위한 사이트이므로, 작품 제목이나 미술관의 주제 태그에 죽음·전쟁·고통 관련 단어가 있는 작품은 후보에서 제외합니다 (`DARK_WORDS`).

### 서버 함수가 필요한 이유

이 프로젝트는 HTML·CSS·JavaScript 웹페이지에 작은 서버 함수(`netlify/functions/` 폴더)를 더한 구조입니다.

1. **시카고 미술관 API의 보안 검사:** 시카고 미술관 서버는 Cloudflare 보안 검사로 자동화된 요청을 막습니다. 미술관이 권장하는 `AIC-User-Agent` 헤더를 붙이면 통과하지만, 브라우저에서 이 헤더를 붙이면 CORS 사전 요청(OPTIONS)이 먼저 나가고 이 사전 요청이 보안 검사에 막혀 `Failed to fetch` 오류가 납니다. 그래서 서버 함수가 헤더를 붙여 대신 요청합니다.
2. **번역 API 키 보호:** Azure 번역 키를 브라우저 코드에 넣으면 누구나 볼 수 있습니다. 키는 서버의 환경 변수에만 두고, 서버 함수가 대신 번역을 요청합니다.

## 프로젝트 구조

```
├── index.html          웹페이지 구조
├── style.css           디자인 (미술관 같은 미니멀 스타일)
├── script.js           TIP·명화·번역 불러오기, 하루 고정, 새로 받기
├── themes.js           주제 사전, 제외할 어두운 단어 목록
├── lib/handlers.js     서버 함수의 실제 코드 (명화 검색·이미지·번역 중계)
├── netlify/functions/  Netlify 서버 함수 (lib/handlers.js를 연결)
├── netlify.toml        Netlify 배포 설정
├── api/                Vercel 서버 함수 (Vercel로 배포할 때 사용)
├── local-server.js     내 컴퓨터에서 실행할 때 쓰는 서버
├── package.json
└── .env.example        환경 변수 양식 (실제 키가 든 .env는 저장소에 올리지 않음)
```

## 내 컴퓨터에서 실행하기

[Node.js](https://nodejs.org/) 20.12 이상이 필요합니다. 따로 설치할 패키지는 없습니다.

```bash
# 1) 번역 키 설정 (선택: 없으면 번역만 빠지고 나머지는 정상 동작)
cp .env.example .env
#    .env 파일을 열어 Azure Translator 키와 지역을 입력

# 2) 실행
npm start

# 3) 브라우저에서 http://localhost:3000 접속
```

## Netlify에 배포하기

1. 이 저장소를 [Netlify](https://www.netlify.com/)에 연결합니다. 배포 설정은 `netlify.toml`에 있어서 따로 입력할 것이 없습니다.
2. 사이트 설정의 **Environment variables**에 아래 두 값을 추가합니다.

   | 이름 | 값 |
   |---|---|
   | `AZURE_TRANSLATOR_KEY` | Azure Translator 키 |
   | `AZURE_TRANSLATOR_REGION` | Azure Translator 지역 (예: `koreacentral`) |

3. 배포합니다.

같은 서버 코드를 Vercel 형식(`api/` 폴더)으로도 연결해 두어서, [Vercel](https://vercel.com/)에 연결해도 같은 방식(환경 변수 두 개)으로 배포할 수 있습니다.

## 사용한 API

| API | 용도 | 인증 |
|---|---|---|
| [Advice Slip](https://api.adviceslip.com/) | TIP | 없음 |
| [Art Institute of Chicago](https://api.artic.edu/docs/) | 명화 검색, 이미지 | 없음 (`AIC-User-Agent` 헤더 권장) |
| [Azure Translator](https://learn.microsoft.com/azure/ai-services/translator/) | 영어 → 한국어 번역 | API 키 (무료 F0 등급) |

명화 이미지와 정보는 시카고 미술관이 퍼블릭 도메인(CC0)으로 공개한 자료입니다.
