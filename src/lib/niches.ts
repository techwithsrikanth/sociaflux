export type NicheCategory = { category: string; niches: string[] };

export const NICHE_TAXONOMY: NicheCategory[] = [
  { category: "Beauty & Personal Care", niches: ["Skincare", "Makeup", "Haircare", "Fragrance", "Nails", "Men's grooming"] },
  { category: "Fashion & Style", niches: ["Streetwear", "Luxury fashion", "Thrift & sustainable", "Ethnic wear", "Footwear & sneakers", "Styling tips"] },
  { category: "Fitness & Wellness", niches: ["Gym & strength", "Yoga & pilates", "Running", "Weight loss", "Mental wellness", "Sports nutrition"] },
  { category: "Food & Beverage", niches: ["Recipes & cooking", "Restaurant reviews", "Baking", "Healthy eating", "Street food", "Coffee & beverages"] },
  { category: "Technology", niches: ["Smartphones & gadgets", "Laptops & PC", "AI & software", "Photography gear", "Gaming hardware", "Smart home"] },
  { category: "Gaming & Esports", niches: ["Mobile gaming", "PC & console", "Esports", "Game reviews", "Live streaming"] },
  { category: "Travel", niches: ["Budget travel", "Luxury travel", "Adventure travel", "Solo travel", "Hotels & stays", "Local city guides"] },
  { category: "Finance & Business", niches: ["Personal finance", "Investing & stocks", "Startups", "Career advice", "Crypto & web3", "Side hustles"] },
  { category: "Education", niches: ["Exam prep", "Language learning", "Study tips", "Skill courses", "Science explainers"] },
  { category: "Home & Living", niches: ["Interior design", "Home decor", "Home organisation", "Gardening", "DIY & crafts", "Appliances"] },
  { category: "Parenting & Family", niches: ["New parents", "Kids activities", "Pregnancy", "Family vlogs", "Baby products"] },
  { category: "Health", niches: ["Nutrition", "Medical explainers", "Dermatology", "Recovery & physio", "Ayurveda & holistic"] },
  { category: "Automotive", niches: ["Cars", "Bikes & motorcycles", "Electric vehicles", "Vehicle reviews", "Auto accessories"] },
  { category: "Entertainment", niches: ["Comedy & sketches", "Film & TV reviews", "Music", "Dance", "Pop culture"] },
  { category: "Pets", niches: ["Dogs", "Cats", "Pet care", "Exotic pets"] },
  { category: "Sports", niches: ["Cricket", "Football", "Basketball", "Motorsport", "Athletics"] },
  { category: "Lifestyle", niches: ["Daily vlogs", "Productivity", "Minimalism", "Relationships", "Spirituality"] },
  { category: "Art & Design", niches: ["Illustration", "Graphic design", "Photography", "Architecture", "Handmade & craft"] },
  { category: "Sustainability", niches: ["Eco living", "Zero waste", "Slow fashion", "Clean beauty"] },
  { category: "B2B & Professional", niches: ["SaaS reviews", "Marketing", "Sales", "HR & recruiting", "Real estate"] }
];

export const ALL_NICHES = NICHE_TAXONOMY.flatMap((group) => group.niches);

export const CONTENT_FORMATS = ["Reel", "Carousel", "Static post", "Story", "YouTube Short", "Long-form video", "UGC ad", "Livestream"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const AUDIENCE_LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Spanish", "Arabic", "French"];

export const FOLLOWER_TIERS = [
  { label: "Any size", min: 0 },
  { label: "Nano 1K+", min: 1000 },
  { label: "Micro 10K+", min: 10000 },
  { label: "Mid 50K+", min: 50000 },
  { label: "Macro 100K+", min: 100000 },
  { label: "Mega 500K+", min: 500000 }
];

/** Maps a free-text niche (e.g. an AI-extracted "Skincare education") onto the closest taxonomy entry. */
export function normaliseNiche(value: string) {
  if (!value) return "";
  const lower = value.toLowerCase();
  const exact = ALL_NICHES.find((niche) => niche.toLowerCase() === lower);
  if (exact) return exact;
  const partial = ALL_NICHES.find((niche) => lower.includes(niche.toLowerCase()) || niche.toLowerCase().includes(lower.split(/\s+/)[0]));
  return partial || value;
}

export function categoryOf(niche: string) {
  return NICHE_TAXONOMY.find((group) => group.niches.includes(niche))?.category || "";
}
