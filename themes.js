// ===== 주제 사전 =====
// 명언에 keywords 중 하나가 들어 있으면 그 주제로 분류하고,
// searchTerms 중 하나를 골라 명화를 검색해요.
// 단어를 추가·수정하면 매칭 결과를 쉽게 바꿀 수 있어요.

const THEMES = [
  {
    id: "love",
    label: "사랑과 관계",
    keywords: ["love", "heart", "friend", "family", "mother", "father", "parent", "child", "kiss",
               "partner", "relationship", "marry", "marriage", "people", "together", "hug"],
    searchTerms: ["embrace", "couple", "mother and child", "friends"],
  },
  {
    id: "calm",
    label: "평온과 휴식",
    keywords: ["calm", "peace", "relax", "rest", "sleep", "quiet", "breathe", "patience", "patient",
               "slow", "stress", "worry", "silence", "gentle"],
    searchTerms: ["calm sea", "quiet landscape", "garden", "moonlight"],
  },
  {
    id: "courage",
    label: "용기와 도전",
    keywords: ["brave", "courage", "fear", "afraid", "risk", "try", "chance", "fail", "failure",
               "mistake", "challenge", "fight", "dare", "change", "strong", "strength"],
    // 전사·폭풍은 전쟁·난파 그림이 많이 나와서, 희망적인 장면으로 골랐어요
    searchTerms: ["sunrise", "sailboat", "mountain", "lighthouse"],
  },
  {
    id: "effort",
    label: "노력과 성장",
    keywords: ["work", "job", "effort", "practice", "learn", "study", "book", "reading", "skill",
               "improve", "goal", "money", "save", "habit", "success", "career"],
    searchTerms: ["worker", "harvest", "reading", "scholar"],
  },
  {
    id: "joy",
    label: "기쁨과 즐거움",
    keywords: ["happy", "happiness", "smile", "laugh", "enjoy", "dance", "music", "sing", "song",
               "play", "party", "celebrate", "joy", "fun"],
    searchTerms: ["dance", "music", "celebration", "children playing"],
  },
  {
    id: "time",
    label: "시간과 인생",
    keywords: ["time", "life", "day", "old", "young", "future", "past", "today", "tomorrow",
               "yesterday", "moment", "year", "never", "always", "remember", "death"],
    searchTerms: ["sunset", "seasons", "river", "elderly"],
  },
  {
    id: "daily",
    label: "소박한 일상",
    keywords: ["eat", "food", "drink", "cook", "coffee", "tea", "home", "house", "clean", "kitchen",
               "breakfast", "dinner", "bed", "clothes", "shoes"],
    // "still life"는 죽은 사냥감·생선 정물화가 섞여서, 과일·꽃 쪽으로 좁혔어요
    searchTerms: ["fruit", "flowers in vase", "interior", "tea"],
  },
  {
    id: "nature",
    label: "자연",
    keywords: ["nature", "tree", "sun", "rain", "flower", "walk", "outside", "outdoors", "sea",
               "sky", "animal", "dog", "cat", "bird", "garden", "weather"],
    searchTerms: ["flowers", "trees", "sky", "birds"],
  },
];

// ===== 걸러낼 어두운 단어 =====
// 작품 제목이나 AIC 주제 태그에 이 단어가 있으면 후보에서 빼요.
// (복수형·-ed·-ing 형태도 함께 걸러져요. 예: weapon → weapons)
const DARK_WORDS = [
  // 죽음
  "dead", "death", "die", "dying", "skull", "skeleton", "corpse", "funeral", "mourning",
  "grave", "tomb", "entombment", "lament", "vanitas", "sorrow", "grief", "suicide",
  // 폭력·전쟁
  "war", "warfare", "warefare", "battle", "warrior", "weapon", "sword", "kill", "murder",
  "blood", "massacre", "slaughter", "wound", "execution", "hunt", "fallen", "falling",
  // 고통·재난
  "crucifixion", "martyr", "martyrdom", "agony", "torture", "hell", "demon", "devil",
  "plague", "drowning", "shipwreck", "fire", "disaster",
];

// 어떤 주제에도 해당하지 않을 때 쓰는 기본 주제
const DEFAULT_THEME = {
  id: "default",
  label: "오늘의 영감",
  keywords: [],
  searchTerms: ["impressionism", "landscape", "water lilies", "flowers"],
};
