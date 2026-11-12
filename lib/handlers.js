// ===== 서버 쪽 핵심 기능 (Netlify·Vercel 배포와 내 컴퓨터 실행에서 함께 써요) =====
// 모든 함수는 웹 표준 Request를 받아 Response를 돌려줘요.
//
// 왜 서버가 필요한가요?
// - 시카고 미술관(AIC)은 Cloudflare 보안 검사 때문에 브라우저에서 직접 부르면 막혀요.
//   서버에서 AIC-User-Agent 헤더를 붙여 부르면 통과해요.
// - Azure 번역 키를 브라우저에 드러내지 않으려면 서버에서 대신 불러야 해요.

const AIC_HEADERS = { "AIC-User-Agent": "daily-quote-art (personal study project)" };
const AIC_SEARCH_URL = "https://api.artic.edu/api/v1/artworks/search";
const AIC_IIIF_URL = "https://www.artic.edu/iiif/2";

const AZURE_TRANSLATE_URL =
  "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=ko";
const MAX_TRANSLATE_LENGTH = 500; // 무료 한도를 아끼려고 너무 긴 글은 거절해요

// JSON 응답을 만드는 도우미
function json(status, body) {
  return Response.json(body, { status });
}

// ----- 1) 명화 검색: GET /api/art/search?q=... -----
// 브라우저가 보낸 검색 조건(쿼리스트링)을 그대로 AIC에 넘기고 결과를 돌려줘요.
export async function artSearch(request) {
  const { search } = new URL(request.url);
  const aicResponse = await fetch(`${AIC_SEARCH_URL}${search}`, { headers: AIC_HEADERS });

  return new Response(await aicResponse.text(), {
    status: aicResponse.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // 같은 검색 결과는 배포 서비스(Netlify·Vercel)가 1시간 동안 저장해 둬서, 함수 호출 횟수를 아껴요
      "Cache-Control": "public, s-maxage=3600",
      "CDN-Cache-Control": "public, s-maxage=3600",
    },
  });
}

// ----- 2) 명화 이미지: GET /api/art/image?id={image_id} -----
export async function artImage(request) {
  const imageId = new URL(request.url).searchParams.get("id") || "";

  // image_id는 영문·숫자·하이픈으로만 이뤄져 있어요. 다른 문자는 거절해요.
  if (!/^[0-9a-f-]+$/i.test(imageId)) {
    return new Response("잘못된 이미지 ID예요", { status: 400 });
  }

  const aicResponse = await fetch(`${AIC_IIIF_URL}/${imageId}/full/843,/0/default.jpg`, {
    headers: AIC_HEADERS,
  });

  if (!aicResponse.ok) {
    return new Response("이미지를 받아오지 못했어요", { status: aicResponse.status });
  }

  return new Response(await aicResponse.arrayBuffer(), {
    headers: {
      "Content-Type": aicResponse.headers.get("content-type") || "image/jpeg",
      // 같은 그림은 브라우저와 배포 서비스에 하루 동안 저장해 둬요
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "CDN-Cache-Control": "public, s-maxage=86400",
    },
  });
}

// ----- 3) 번역: POST /api/translate  { "text": "영어" } → { "text": "한국어" } -----
export async function translate(request) {
  if (request.method !== "POST") {
    return json(405, { error: "POST로만 요청할 수 있어요" });
  }

  // 다른 사이트에서 이 번역 기능을 몰래 가져다 쓰지 못하게, 같은 주소에서 온 요청만 받아요
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json(403, { error: "허용되지 않은 요청이에요" });
  }

  // 키는 환경 변수에서 읽어요 (내 컴퓨터: .env 파일, Netlify·Vercel: 사이트 설정 화면)
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  if (!key || !region) {
    return json(503, { error: "번역 키가 설정되지 않았어요" });
  }

  let text;
  try {
    ({ text } = await request.json());
  } catch {
    return json(400, { error: "요청 형식이 잘못됐어요" });
  }

  if (typeof text !== "string" || !text.trim() || text.length > MAX_TRANSLATE_LENGTH) {
    return json(400, { error: `번역할 글은 1~${MAX_TRANSLATE_LENGTH}자여야 해요` });
  }

  // Azure Translator 요청 형식: [{ "Text": "..." }]
  const azureResponse = await fetch(AZURE_TRANSLATE_URL, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Ocp-Apim-Subscription-Region": region,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ Text: text }]),
  });

  if (!azureResponse.ok) {
    // 401: 키가 틀림, 403/429: 무료 한도 초과 또는 너무 잦은 요청
    console.error("[번역 오류]", azureResponse.status, await azureResponse.text());
    return json(502, { error: `번역 서비스 오류 (${azureResponse.status})` });
  }

  // Azure 응답 형식: [{ "translations": [{ "text": "...", "to": "ko" }] }]
  const data = await azureResponse.json();
  return json(200, { text: data[0].translations[0].text });
}
