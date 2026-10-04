/**
 * Business category classification from scraped website copy.
 *
 * Scores every category against the page instead of taking the first keyword
 * hit, and weights the parts of the page by how much they say about the
 * business: a title or description carries far more than a footer link. Terms
 * are matched on word boundaries, so "AI" no longer matches "available" and
 * "Investor Relations" in a footer no longer turns a consumer brand into a
 * venture studio.
 */

export type BusinessTaxonomy = {
  industry: string;
  category: string;
  products: string[];
  services: string[];
  audience: string[];
  tone: string[];
  personality: string[];
  positioning: string;
  visualStyle: string[];
};

export type TaxonomyInput = {
  title?: string;
  description?: string;
  headings?: string[];
  textSample?: string;
  links?: string[];
};

export type Classification = {
  taxonomy: BusinessTaxonomy;
  /** Stable key of the winning category, or "general" when nothing scored high enough. */
  key: string;
  score: number;
  runnerUp?: { key: string; score: number };
  matchedTerms: string[];
};

/** How much each part of the page counts toward the score. */
const FIELD_WEIGHTS = { title: 4, description: 3, headings: 2, textSample: 1, links: 0.5 } as const;

/** Signal strength within a category. */
const STRONG = 6;
const MEDIUM = 3;
const WEAK = 1;

/** One term can only count so many times, so keyword stuffing cannot dominate. */
const MAX_TERM_HITS = 3;

/** Below this, the page did not say enough to claim a category. */
const MIN_CONFIDENCE = 8;

/**
 * A category backed by a single repeated term is usually an incidental mention
 * — one "healthcare" link on a phone maker's site — so it is halved against
 * categories supported by a spread of different terms.
 */
const MIN_DISTINCT_TERMS = 2;
const NARROW_EVIDENCE_PENALTY = 0.5;

type CategoryRule = {
  key: string;
  /** Unambiguous for this category. */
  strong: string[];
  /** Suggestive, but appears in other categories too. */
  medium?: string[];
  /** Only meaningful in aggregate. */
  weak?: string[];
  /** Terms that argue against this category. */
  negative?: string[];
  taxonomy: BusinessTaxonomy;
};

const CATEGORIES: CategoryRule[] = [
  {
    key: "consumer-electronics",
    strong: [
      "smartphone", "smartphones", "galaxy", "home appliances", "washing machine", "refrigerator",
      "soundbar", "smart tv", "wearables", "consumer electronics", "air conditioner", "microwave",
      // Dominant product nouns: brands rarely say "smartphone", they say the product name.
      "iphone", "ipad", "macbook", "airpods", "smartwatch", "pixel phone"
    ],
    medium: ["tv", "tvs", "tablet", "tablets", "laptop", "laptops", "monitor", "monitors", "appliances", "headphones", "earbuds", "camera", "battery life", "trade in", "mac"],
    weak: ["electronics", "device", "devices", "gadget", "accessories", "warranty", "display", "processor", "chip", "storage", "charger"],
    taxonomy: {
      industry: "Consumer electronics",
      category: "Consumer electronics",
      products: ["Smartphones", "Tablets", "Wearables", "Televisions", "Home appliances"],
      services: ["Product support", "Warranty and repair", "Trade-in and upgrade", "Retail and ecommerce"],
      audience: ["Everyday consumers", "Tech enthusiasts", "Upgrade buyers", "Families", "Young professionals"],
      tone: ["Confident", "Accessible", "Innovative"],
      personality: ["Innovative", "Reliable", "Premium", "Mass-market"],
      positioning: "Premium mass-market",
      visualStyle: ["Product-led photography", "Clean technology imagery", "Lifestyle device usage"]
    }
  },
  {
    key: "automotive",
    strong: ["team-bhp", "car reviews", "ownership reports", "road tests", "indian cars", "test drive"],
    medium: ["automotive", "bikes", "motorcycle", "sedan", "suv", "hatchback", "mileage"],
    weak: ["maintenance", "buying advice", "showroom", "dealership"],
    taxonomy: {
      industry: "Automotive media and community",
      category: "Automotive community",
      products: ["Car reviews", "Ownership reports", "Road tests", "Buying guides"],
      services: ["Community forums", "Editorial reviews", "Buying advice"],
      audience: ["Car enthusiasts", "Prospective buyers", "Owners", "Automotive professionals"],
      tone: ["Knowledgeable", "Candid", "Community-led"],
      personality: ["Authoritative", "Practical", "Enthusiast", "Trustworthy"],
      positioning: "Specialist community",
      visualStyle: ["Forum-led", "Editorial", "Vehicle-focused"]
    }
  },
  {
    key: "art-stationery",
    strong: ["watercolor", "watercolour", "sketchbook", "gouache", "art paper", "coloring book", "colouring book", "mixed media paper"],
    medium: ["acrylic", "canvas", "stationery", "sketching", "calligraphy"],
    weak: ["artist", "drawing", "painting"],
    taxonomy: {
      industry: "Art supplies and stationery",
      category: "Art stationery",
      products: ["Sketchbooks", "Watercolor journals", "Mixed media papers", "Canvas panels", "Acrylic papers", "Gouache papers", "Adult colouring books"],
      services: ["Art supply ecommerce", "Artist community", "Art education content"],
      audience: ["Artists", "Students", "Hobbyists", "Professional creators", "Art educators"],
      tone: ["Creative", "Accessible", "Community-led"],
      personality: ["Creative", "Friendly", "Practical", "Inspirational"],
      positioning: "Premium accessible",
      visualStyle: ["Product-led ecommerce", "Creative materials", "Studio and art supply imagery"]
    }
  },
  {
    key: "venture-studio",
    // Tightened: bare "portfolio" and "investor" appear in the footer of most
    // large corporate sites and used to hijack the whole classification.
    strong: ["venture studio", "venture capital", "venture lab", "venture build", "venture scale", "mvp engineering", "portfolio companies", "pre-seed", "cap table"],
    medium: ["founders", "startups", "fundraising", "accelerator", "incubator", "term sheet"],
    weak: ["startup", "founder", "venture"],
    negative: ["smartphone", "appliances", "galaxy", "shop now", "free shipping"],
    taxonomy: {
      industry: "Venture studio and startup services",
      category: "AI venture studio",
      products: ["Venture Lab", "Venture Build", "Venture Scale", "Portfolio support"],
      services: ["Startup advisory", "AI-native MVP engineering", "Venture building", "Fundraising preparation", "Go-to-market support"],
      audience: ["Founders", "Startup teams", "Institutional partners", "Enterprise leaders", "Investors"],
      tone: ["Institutional", "Strategic", "Founder-focused"],
      personality: ["Professional", "Ambitious", "Analytical", "Execution-oriented"],
      positioning: "Premium institutional",
      visualStyle: ["Modern venture studio", "AI-first technology", "Institutional startup branding"]
    }
  },
  {
    key: "software",
    strong: ["saas", "api", "machine learning", "artificial intelligence", "automation platform", "developer tools", "open source", "integrations"],
    medium: ["software", "platform", "dashboard", "workflow", "ai", "deploy", "cloud"],
    weak: ["app", "data", "analytics"],
    negative: ["smartphone", "appliances", "galaxy"],
    taxonomy: {
      industry: "Technology",
      category: "AI software",
      products: ["AI platform", "Automation tools", "Software services"],
      services: ["AI implementation", "Automation", "Software delivery"],
      audience: ["Business leaders", "Operators", "Technology teams"],
      tone: ["Professional", "Innovative", "Direct"],
      personality: ["Technical", "Modern", "Efficient"],
      positioning: "Premium",
      visualStyle: ["Modern SaaS", "Technical", "Clean interface"]
    }
  },
  {
    key: "beauty",
    strong: ["skincare", "serum", "spf", "moisturiser", "moisturizer", "cleanser", "cosmetics", "sunscreen", "haircare"],
    medium: ["beauty", "skin", "cosmetic", "fragrance", "makeup", "dermatologist"],
    weak: ["wellness", "routine", "glow"],
    taxonomy: {
      industry: "Beauty and personal care",
      category: "Beauty",
      products: ["Beauty products", "Wellness products"],
      services: ["Product education", "Consumer ecommerce"],
      audience: ["Beauty shoppers", "Wellness buyers"],
      tone: ["Warm", "Educational", "Trustworthy"],
      personality: ["Friendly", "Trustworthy", "Aspirational"],
      positioning: "Premium accessible",
      visualStyle: ["Product photography", "Lifestyle imagery", "Clean layouts"]
    }
  },
  {
    key: "fashion",
    strong: ["apparel", "clothing", "womenswear", "menswear", "footwear", "sneakers", "ethnic wear", "activewear"],
    medium: ["fashion", "outfit", "wardrobe", "denim", "dresses", "shirts", "styling"],
    weak: ["collection", "size guide", "fit"],
    taxonomy: {
      industry: "Fashion and apparel",
      category: "Fashion",
      products: ["Apparel", "Footwear", "Accessories"],
      services: ["Ecommerce", "Styling guidance", "Returns and exchanges"],
      audience: ["Fashion shoppers", "Trend followers", "Value seekers"],
      tone: ["Stylish", "Confident", "Current"],
      personality: ["Trend-aware", "Expressive", "Accessible"],
      positioning: "Accessible premium",
      visualStyle: ["Editorial fashion photography", "Lookbook imagery", "Model-led"]
    }
  },
  {
    key: "food-beverage",
    strong: ["recipes", "restaurant", "menu", "snacks", "beverages", "coffee beans", "food delivery", "groceries"],
    medium: ["food", "drink", "flavour", "flavor", "organic", "nutrition facts", "ingredients"],
    weak: ["taste", "fresh", "kitchen"],
    taxonomy: {
      industry: "Food and beverage",
      category: "Food and beverage",
      products: ["Packaged food", "Beverages", "Snacks"],
      services: ["Ecommerce", "Subscriptions", "Recipe content"],
      audience: ["Home cooks", "Health-conscious buyers", "Families", "Convenience shoppers"],
      tone: ["Warm", "Appetising", "Honest"],
      personality: ["Wholesome", "Approachable", "Quality-led"],
      positioning: "Everyday premium",
      visualStyle: ["Food photography", "Lifestyle kitchen imagery", "Ingredient-led"]
    }
  },
  {
    key: "fitness",
    strong: ["workout", "gym", "fitness", "strength training", "protein powder", "supplements", "personal trainer"],
    medium: ["exercise", "training", "yoga", "pilates", "cardio", "muscle"],
    weak: ["health", "performance", "recovery"],
    taxonomy: {
      industry: "Fitness and wellness",
      category: "Fitness",
      products: ["Fitness programmes", "Supplements", "Training equipment"],
      services: ["Coaching", "Membership", "Training content"],
      audience: ["Gym-goers", "Beginners", "Athletes", "Wellness buyers"],
      tone: ["Motivating", "Direct", "Supportive"],
      personality: ["Energetic", "Disciplined", "Encouraging"],
      positioning: "Performance-led",
      visualStyle: ["Action photography", "Gym environments", "Before and after"]
    }
  },
  {
    key: "travel",
    strong: ["hotels", "flights", "itinerary", "booking", "resort", "travel packages", "destinations"],
    medium: ["travel", "trip", "tourism", "stay", "vacation", "holiday"],
    weak: ["explore", "journey", "guide"],
    taxonomy: {
      industry: "Travel and hospitality",
      category: "Travel",
      products: ["Stays", "Travel packages", "Experiences"],
      services: ["Booking", "Trip planning", "Customer support"],
      audience: ["Leisure travellers", "Business travellers", "Families", "Budget travellers"],
      tone: ["Inviting", "Helpful", "Aspirational"],
      personality: ["Adventurous", "Reliable", "Welcoming"],
      positioning: "Mid-market to premium",
      visualStyle: ["Destination photography", "Travel lifestyle", "Scenic imagery"]
    }
  },
  {
    key: "finance",
    strong: ["mutual funds", "credit card", "insurance", "banking", "loans", "brokerage", "trading account", "fintech"],
    medium: ["finance", "investment", "savings", "payments", "wallet", "interest rate"],
    weak: ["secure", "account", "returns"],
    taxonomy: {
      industry: "Financial services",
      category: "Finance",
      products: ["Accounts", "Cards", "Investment products"],
      services: ["Payments", "Lending", "Advisory", "Customer support"],
      audience: ["Retail customers", "Investors", "Small businesses", "Young earners"],
      tone: ["Trustworthy", "Clear", "Professional"],
      personality: ["Secure", "Transparent", "Dependable"],
      positioning: "Trust-led",
      visualStyle: ["Clean financial UI", "Data visualisation", "Professional imagery"]
    }
  },
  {
    key: "education",
    strong: ["courses", "syllabus", "exam prep", "online learning", "certification", "tutorials", "edtech"],
    medium: ["learning", "students", "curriculum", "lessons", "classes", "training programme"],
    weak: ["education", "teach", "study"],
    taxonomy: {
      industry: "Education and training",
      category: "Education",
      products: ["Courses", "Certifications", "Learning material"],
      services: ["Teaching", "Mentoring", "Assessment"],
      audience: ["Students", "Professionals upskilling", "Parents", "Job seekers"],
      tone: ["Encouraging", "Clear", "Credible"],
      personality: ["Knowledgeable", "Supportive", "Structured"],
      positioning: "Outcome-led",
      visualStyle: ["Classroom imagery", "Course thumbnails", "Instructor-led"]
    }
  },
  {
    key: "home-living",
    strong: ["furniture", "home decor", "interior design", "mattress", "upholstery", "kitchenware"],
    medium: ["sofa", "bedding", "lighting", "storage", "decor", "homeware"],
    weak: ["home", "living", "room"],
    taxonomy: {
      industry: "Home and living",
      category: "Home and furniture",
      products: ["Furniture", "Home decor", "Homeware"],
      services: ["Ecommerce", "Delivery and assembly", "Design consultation"],
      audience: ["Homeowners", "Renters", "New movers", "Interior enthusiasts"],
      tone: ["Warm", "Practical", "Inspiring"],
      personality: ["Comfortable", "Tasteful", "Dependable"],
      positioning: "Accessible premium",
      visualStyle: ["Room sets", "Styled interiors", "Product-led photography"]
    }
  },
  {
    key: "gaming",
    strong: ["esports", "gameplay", "multiplayer", "game studio", "console gaming", "battle royale"],
    medium: ["gaming", "gamers", "playstation", "xbox", "nintendo", "steam"],
    weak: ["play", "levels", "characters"],
    taxonomy: {
      industry: "Gaming and interactive entertainment",
      category: "Gaming",
      products: ["Games", "In-game content", "Gaming hardware"],
      services: ["Live service", "Community events", "Esports"],
      audience: ["Gamers", "Esports fans", "Streamers", "Young audiences"],
      tone: ["Energetic", "Playful", "Community-led"],
      personality: ["Competitive", "Fun", "Immersive"],
      positioning: "Entertainment-led",
      visualStyle: ["Game art", "High-energy motion", "Streamer-led"]
    }
  },
  {
    key: "healthcare",
    strong: ["clinic", "diagnostics", "pharmacy", "telemedicine", "patients", "prescription", "healthcare"],
    medium: ["doctor", "medical", "treatment", "therapy", "consultation"],
    weak: ["health", "care", "symptoms"],
    taxonomy: {
      industry: "Healthcare",
      category: "Healthcare",
      products: ["Health services", "Diagnostics", "Medicines"],
      services: ["Consultations", "Diagnostics", "Care delivery"],
      audience: ["Patients", "Caregivers", "Health-conscious consumers"],
      tone: ["Reassuring", "Clear", "Clinical"],
      personality: ["Trustworthy", "Careful", "Expert"],
      positioning: "Trust-led",
      visualStyle: ["Clinical imagery", "Calm palettes", "Practitioner-led"]
    }
  }
];

const GENERAL_TAXONOMY: BusinessTaxonomy = {
  industry: "General business",
  category: "Brand",
  products: [],
  services: ["Business offering", "Customer support"],
  audience: ["Potential customers", "Brand partners"],
  tone: ["Professional", "Informative"],
  personality: ["Professional", "Approachable"],
  positioning: "Unknown from public data",
  visualStyle: ["Website-led public brand presence"]
};

/** Counts whole-word occurrences, so "ai" does not match "available". */
export function countTerm(haystack: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "g");
  return (haystack.match(pattern) || []).length;
}

function scoreField(text: string, terms: string[] | undefined, weight: number) {
  if (!terms?.length || !text) return { score: 0, matched: [] as string[] };
  let score = 0;
  const matched: string[] = [];
  for (const term of terms) {
    const hits = Math.min(countTerm(text, term), MAX_TERM_HITS);
    if (hits > 0) {
      score += hits * weight;
      matched.push(term);
    }
  }
  return { score, matched };
}

function scoreCategory(rule: CategoryRule, fields: Array<{ text: string; weight: number }>) {
  let score = 0;
  const matched = new Set<string>();

  for (const field of fields) {
    for (const [terms, strength] of [[rule.strong, STRONG], [rule.medium, MEDIUM], [rule.weak, WEAK]] as const) {
      const result = scoreField(field.text, terms, field.weight * strength);
      score += result.score;
      result.matched.forEach((term) => matched.add(term));
    }
    const penalty = scoreField(field.text, rule.negative, field.weight * STRONG);
    score -= penalty.score;
  }

  return { score, matched: [...matched] };
}

export function classifyBusiness(input: TaxonomyInput): Classification {
  const fields = [
    { text: (input.title || "").toLowerCase(), weight: FIELD_WEIGHTS.title },
    { text: (input.description || "").toLowerCase(), weight: FIELD_WEIGHTS.description },
    { text: (input.headings || []).join(". ").toLowerCase(), weight: FIELD_WEIGHTS.headings },
    { text: (input.textSample || "").toLowerCase(), weight: FIELD_WEIGHTS.textSample },
    { text: (input.links || []).join(" ").toLowerCase(), weight: FIELD_WEIGHTS.links }
  ];

  const ranked = CATEGORIES
    .map((rule) => {
      const { score, matched } = scoreCategory(rule, fields);
      const narrow = matched.length < MIN_DISTINCT_TERMS;
      return { rule, matched, score: narrow ? score * NARROW_EVIDENCE_PENALTY : score };
    })
    .sort((left, right) => right.score - left.score);

  const winner = ranked[0];
  if (!winner || winner.score < MIN_CONFIDENCE) {
    return { taxonomy: GENERAL_TAXONOMY, key: "general", score: winner?.score ?? 0, matchedTerms: [] };
  }

  const runnerUp = ranked[1] && ranked[1].score > 0 ? { key: ranked[1].rule.key, score: ranked[1].score } : undefined;
  return { taxonomy: winner.rule.taxonomy, key: winner.rule.key, score: winner.score, runnerUp, matchedTerms: winner.matched };
}

export function inferBusinessTaxonomy(input: TaxonomyInput): BusinessTaxonomy {
  return classifyBusiness(input).taxonomy;
}
