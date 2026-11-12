// ===== 설정 =====
const ADVICE_API_URL = "https://api.adviceslip.com/advice";
// 명화 요청은 Cloudflare 보안 검사 때문에 브라우저에서 직접 보낼 수 없어서,
// 서버 함수(배포: netlify/functions/, 내 컴퓨터: local-server.js)를 거쳐요.
const ART_SEARCH_URL = "/api/art/search";
const ART_IMAGE_URL = "/api/art/image";
const ART_PAGE_URL = "https://www.artic.edu/artworks"; // "자세히 보기" 링크용 (새 창으로 열려서 괜찮아요)
const TRANSLATE_URL = "/api/translate"; // 번역도 중계 서버를 거쳐요 (Azure 키는 서버에만 있어요)

const STORAGE_KEY = "daily-quote-art"; // 브라우저에 오늘의 TIP·명화를 저장할 이름

// ===== 화면 요소 =====
const dateEl = document.getElementById("today-date");
const quoteEl = document.getElementById("quote-text");
const quoteKoEl = document.getElementById("quote-ko");
const quoteMetaEl = document.getElementById("quote-meta");
const themeTagEl = document.getElementById("theme-tag");
const artEl = document.getElementById("art");
const artImageEl = document.getElementById("art-image");
const artTitleEl = document.getElementById("art-title");
const artTitleOriginalEl = document.getElementById("art-title-original");
const artArtistEl = document.getElementById("art-artist");
const artLinkEl = document.getElementById("art-link");
const artStatusEl = document.getElementById("art-status");
const refreshButtonEl = document.getElementById("refresh-button");
const refreshNoteEl = document.getElementById("refresh-note");

// ===== 공통 도우미 =====

// 배열에서 하나를 무작위로 골라요
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 오늘 날짜를 "2026-11-12" 형태의 문자열로 만들어요 (한국 시간 기준 하루를 구분하는 열쇠)
function getTodayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// 오늘 날짜를 "2026년 11월 12일 목요일" 형식으로 보여줘요
function showToday() {
  dateEl.textContent = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

// ===== 1. TIP =====

// Advice Slip API에서 TIP 하나를 받아와요
// 응답 형태: { "slip": { "id": 117, "advice": "..." } }
async function fetchAdvice() {
  // 이 API는 같은 응답을 약 2초간 캐시해서, 브라우저 캐시를 쓰지 않도록 해요
  const response = await fetch(ADVICE_API_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`TIP API 응답 오류: ${response.status}`);
  }

  const data = await response.json();
  return data.slip; // { id, advice }
}

// 영어 TIP을 한국어로 번역해요. 실패하면 null을 돌려줘요 (번역 없이도 화면은 보여줘요).
async function translateToKorean(text) {
  try {
    const response = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data.text;
  } catch (error) {
    console.warn("[번역 실패]", error.message);
    return null;
  }
}

// ===== 2. TIP → 주제 찾기 =====

// TIP 속 단어가 키워드와 같은지 봐요 (love, loves, loved, loving 정도는 같은 단어로 쳐요)
const SUFFIXES = ["", "s", "es", "d", "ed", "ing", "ly", "ful", "r", "er"];

function wordMatches(word, keyword) {
  return SUFFIXES.some((suffix) => word === keyword + suffix) ||
         // love → loving 처럼 끝의 e가 빠지는 경우
         (keyword.endsWith("e") && word === keyword.slice(0, -1) + "ing");
}

// TIP에 가장 많이 등장한 주제를 골라요. 하나도 없으면 기본 주제를 써요.
function findTheme(adviceText) {
  // 소문자로 바꾸고 알파벳만 남겨 단어 목록으로 나눠요
  const words = adviceText.toLowerCase().match(/[a-z']+/g) || [];

  let bestThemes = [];
  let bestScore = 0;

  for (const theme of THEMES) {
    // TIP 단어 중 이 주제의 키워드와 맞는 개수가 점수예요
    const score = words.filter((word) =>
      theme.keywords.some((keyword) => wordMatches(word, keyword))
    ).length;

    if (score > bestScore) {
      bestScore = score;
      bestThemes = [theme];
    } else if (score === bestScore && score > 0) {
      bestThemes.push(theme); // 동점이면 후보로 같이 둬요
    }
  }

  return bestThemes.length > 0 ? pickRandom(bestThemes) : DEFAULT_THEME;
}

// 저장해 둔 주제 id로 주제 정보를 다시 찾아요
function getThemeById(id) {
  return THEMES.find((theme) => theme.id === id) || DEFAULT_THEME;
}

// ===== 3. 주제 → 명화 찾기 =====

// 어두운 단어를 찾는 정규식: \b는 단어 경계라서 "war"가 "warm" 안에서는 걸리지 않아요
const DARK_PATTERN = new RegExp(`\\b(${DARK_WORDS.join("|")})(s|es|ed|ing)?\\b`, "i");

// 제목이나 주제 태그에 어두운 단어가 있으면 true
function isDarkArtwork(artwork) {
  const text = [artwork.title, ...(artwork.subject_titles || [])].join(" ");
  return DARK_PATTERN.test(text);
}

// 검색어로 저작권이 풀린(퍼블릭 도메인) 작품 중 이미지가 있는 것만 골라와요
async function searchArtworks(term) {
  const params = new URLSearchParams({
    q: term,
    "query[term][is_public_domain]": "true",
    fields: "id,title,artist_title,date_display,image_id,thumbnail,subject_titles",
    limit: "30",
  });

  // AIC-User-Agent 헤더는 중계 서버가 붙여줘요
  const response = await fetch(`${ART_SEARCH_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`명화 API 응답 오류: ${response.status}`);
  }

  const data = await response.json();
  // 이미지가 있고, 어둡지 않은 작품만 남겨요
  return data.data.filter((artwork) => artwork.image_id && !isDarkArtwork(artwork));
}

// 주제에 맞는 작품 하나를 골라요. 결과가 없으면 기본 주제로 한 번 더 찾아요.
async function findArtwork(theme) {
  let artworks = await searchArtworks(pickRandom(theme.searchTerms));

  if (artworks.length === 0) {
    artworks = await searchArtworks(pickRandom(DEFAULT_THEME.searchTerms));
  }
  if (artworks.length === 0) {
    throw new Error("어울리는 명화를 찾지 못했어요");
  }

  const artwork = pickRandom(artworks);
  // 저장하기 좋게 필요한 정보만 남겨요
  return {
    id: artwork.id,
    title: artwork.title,
    artist: artwork.artist_title,
    date: artwork.date_display,
    imageId: artwork.image_id,
    altText: artwork.thumbnail?.alt_text || artwork.title,
  };
}

// ===== 4. 오늘의 세트(TIP + 주제 + 명화) 받아오기 =====

// TIP과 명화를 모두 받아온 뒤에 한꺼번에 돌려줘요. 하나라도 실패하면 오류를 던져요.
async function fetchDailySet() {
  const slip = await fetchAdvice();
  const theme = findTheme(slip.advice);

  // TIP 번역과 명화 찾기는 서로 상관없어서 동시에 진행해요.
  // 명화는 찾은 뒤에 제목도 한국어로 번역해요 (작가 이름은 원어 그대로 둬요).
  const [translation, artwork] = await Promise.all([
    translateToKorean(slip.advice),
    findArtwork(theme).then(async (found) => ({
      ...found,
      titleKo: await translateToKorean(found.title), // 실패하면 null
    })),
  ]);

  return {
    date: getTodayKey(),
    slip,
    translation, // 한국어 번역 (실패하면 null)
    themeId: theme.id,
    artwork,
    refreshUsed: false, // 오늘 새로 받기를 썼는지
  };
}

// 저장된 세트에 번역이 빠져 있으면(지난번 실패, 기능 추가 전에 받은 세트) 한 번 더 번역해 봐요
async function fillMissingTranslations(dailySet) {
  const { artwork } = dailySet;
  const [translation, titleKo] = await Promise.all([
    dailySet.translation || translateToKorean(dailySet.slip.advice),
    artwork.titleKo || translateToKorean(artwork.title),
  ]);

  // 새로 채운 게 있을 때만 저장하고 화면을 고쳐요
  if (translation !== dailySet.translation || titleKo !== artwork.titleKo) {
    dailySet.translation = translation;
    artwork.titleKo = titleKo;
    save(dailySet);
    renderTranslation(translation);
    renderArtTitle(artwork);
  }
}

// ===== 5. 브라우저 저장소(localStorage) =====
// 시크릿 창 등에서는 저장소를 못 쓸 수 있어서 try/catch로 감싸요

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // 오늘 날짜에 저장한 것만 써요. 날짜가 바뀌면 새로 받아요.
    return saved && saved.date === getTodayKey() ? saved : null;
  } catch {
    return null;
  }
}

function save(dailySet) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dailySet));
  } catch {
    // 저장에 실패해도 화면은 정상적으로 보여줘요 (새로고침하면 새 TIP이 나와요)
  }
}

// ===== 6. 화면 그리기 =====

// 오늘의 세트를 화면에 보여줘요
function renderDailySet(dailySet) {
  const { slip, artwork } = dailySet;

  // TIP
  quoteEl.classList.remove("is-status");
  quoteEl.textContent = slip.advice;
  quoteMetaEl.textContent = `ADVICE #${slip.id}`;
  renderTranslation(dailySet.translation);

  // 주제
  themeTagEl.textContent = `오늘의 주제 · ${getThemeById(dailySet.themeId).label}`;
  themeTagEl.hidden = false;

  // 명화 (중계 서버가 AIC 이미지를 대신 받아와요)
  artImageEl.classList.remove("is-loaded");
  artImageEl.onload = () => artImageEl.classList.add("is-loaded");
  artImageEl.onerror = () => renderArtStatus("명화 이미지를 불러오지 못했어요.");
  artImageEl.src = `${ART_IMAGE_URL}?id=${encodeURIComponent(artwork.imageId)}`;
  artImageEl.alt = artwork.altText;

  renderArtTitle(artwork);
  artArtistEl.textContent = [artwork.artist, artwork.date].filter(Boolean).join(", ");
  artLinkEl.href = `${ART_PAGE_URL}/${artwork.id}`;
  artStatusEl.textContent = "";
  artEl.hidden = false;

  renderRefreshButton(dailySet.refreshUsed);
}

// 한국어 번역: 있으면 보여주고, 없으면 숨겨요
function renderTranslation(translation) {
  quoteKoEl.textContent = translation || "";
  quoteKoEl.hidden = !translation;
}

// 명화 제목: 한국어 번역이 있으면 크게 보여주고 원래 제목은 아래 작게,
// 번역이 없으면 원래 제목만 보여줘요
function renderArtTitle(artwork) {
  artTitleEl.textContent = artwork.titleKo || artwork.title;
  artTitleOriginalEl.textContent = artwork.titleKo ? artwork.title : "";
  artTitleOriginalEl.hidden = !artwork.titleKo;
}

// 새로 받기 버튼: 오늘 이미 썼으면 잠가요
function renderRefreshButton(used) {
  refreshButtonEl.hidden = false;
  refreshButtonEl.disabled = used;
  refreshButtonEl.textContent = used ? "내일 다시 만나요" : "새로 받기";
  refreshNoteEl.textContent = used
    ? "오늘의 새로 받기를 이미 사용했어요."
    : "하루에 한 번, 다른 TIP과 명화를 받을 수 있어요.";
}

// TIP 자리에 상태 문구를 보여줘요 (처음 불러오는 중·오류)
function renderStatus(message) {
  quoteEl.classList.add("is-status");
  quoteEl.textContent = message;
  quoteMetaEl.textContent = "";
  quoteKoEl.hidden = true;
  themeTagEl.hidden = true;
  artEl.hidden = true;
}

function renderArtStatus(message) {
  artEl.hidden = true;
  artStatusEl.textContent = message;
}

// ===== 7. 새로 받기 (하루 1회) =====
async function handleRefresh() {
  const current = loadSaved();
  if (current?.refreshUsed) return; // 혹시 모를 중복 실행 방지

  // 불러오는 동안 버튼을 잠가 연속 클릭을 막아요
  refreshButtonEl.disabled = true;
  refreshButtonEl.textContent = "새로 받는 중…";

  try {
    const dailySet = await fetchDailySet();
    dailySet.refreshUsed = true; // 성공했을 때만 기회를 써요
    save(dailySet);
    renderDailySet(dailySet);
  } catch (error) {
    console.error(error);
    // 실패하면 기존 화면은 그대로 두고 기회도 남겨둬요
    renderRefreshButton(false);
    refreshNoteEl.textContent = "새로 받지 못했어요. 잠시 후 다시 눌러 주세요.";
  }
}

// ===== 시작 =====
async function init() {
  showToday();
  refreshButtonEl.addEventListener("click", handleRefresh);

  // 오늘 이미 받아둔 게 있으면 API를 부르지 않고 그대로 보여줘요
  const saved = loadSaved();
  if (saved) {
    renderDailySet(saved);
    fillMissingTranslations(saved); // 번역이 빠져 있으면 채워요
    return;
  }

  // 오늘 처음이면 새로 받아서 저장해요
  renderStatus("오늘의 생활 TIP과 명화를 준비하는 중이에요…");
  try {
    const dailySet = await fetchDailySet();
    save(dailySet);
    renderDailySet(dailySet);
  } catch (error) {
    console.error(error);
    renderStatus("불러오지 못했어요. 잠시 후 새로고침해 주세요.");
  }
}

init();
