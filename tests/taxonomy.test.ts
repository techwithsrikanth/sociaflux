import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyBusiness, countTerm, inferBusinessTaxonomy } from "../src/lib/ai/taxonomy";

describe("countTerm", () => {
  it("matches whole words only", () => {
    assert.equal(countTerm("available now", "ai"), 0);
    assert.equal(countTerm("retail and email", "ai"), 0);
    assert.equal(countTerm("our ai platform", "ai"), 1);
  });

  it("counts repeats", () => {
    assert.equal(countTerm("saas tools for saas teams", "saas"), 2);
  });

  it("matches multi-word phrases", () => {
    assert.equal(countTerm("we run a venture studio here", "venture studio"), 1);
  });

  it("does not match a word embedded in a longer one", () => {
    assert.equal(countTerm("startups", "startup"), 0);
    assert.equal(countTerm("portfolios", "portfolio"), 0);
  });
});

describe("Samsung India regression", () => {
  // The live page that used to classify as "AI venture studio" because its
  // footer mentioned Investor Relations and portfolio.
  const samsung = {
    title: "Samsung India | Mobile | TV | Home Appliances",
    description: "Discover the latest smartphones, tablets, wearables, TVs & home appliances. Explore a wide range of electronics & appliances at Samsung India.",
    headings: ["Galaxy Z Fold8", "Home Appliances", "Televisions", "Shop smartphones", "Support"],
    textSample: "Discover the latest smartphones, tablets, wearables, TVs and home appliances. Buy the Galaxy smartphone online. Washing machine and refrigerator offers.",
    links: [
      "https://www.samsung.com/in/investor-relations/",
      "https://www.samsung.com/in/about-us/our-portfolio/",
      "https://www.samsung.com/in/smartphones/",
      "https://www.samsung.com/in/tvs/"
    ]
  };

  it("classifies Samsung as consumer electronics, not a venture studio", () => {
    const result = classifyBusiness(samsung);

    assert.equal(result.key, "consumer-electronics");
    assert.equal(result.taxonomy.industry, "Consumer electronics");
    assert.notEqual(result.taxonomy.category, "AI venture studio");
  });

  it("does not let footer links outweigh the page topic", () => {
    const result = classifyBusiness(samsung);
    assert.notEqual(result.runnerUp?.key, undefined);
    assert.ok(result.score > (result.runnerUp?.score ?? 0));
  });

  it("still classifies a real venture studio correctly", () => {
    const result = classifyBusiness({
      title: "Northwind Venture Studio",
      description: "A venture studio that builds AI-native companies with founders, from pre-seed to venture scale.",
      headings: ["Venture Lab", "Venture Build", "Venture Scale", "Portfolio companies"],
      textSample: "We partner with founders on MVP engineering and fundraising.",
      links: ["https://example.com/portfolio"]
    });

    assert.equal(result.key, "venture-studio");
    assert.equal(result.taxonomy.category, "AI venture studio");
  });
});

describe("classifyBusiness", () => {
  it("weights the title above body copy", () => {
    const titled = classifyBusiness({ title: "Skincare serum and sunscreen", textSample: "courses and syllabus" });
    assert.equal(titled.key, "beauty");
  });

  it("falls back to a general brand when nothing scores high enough", () => {
    const result = classifyBusiness({
      title: "Acme",
      description: "We do things well.",
      headings: ["Welcome"],
      textSample: "Contact us to learn more about what we offer."
    });

    assert.equal(result.key, "general");
    assert.equal(result.taxonomy.category, "Brand");
  });

  it("returns the general taxonomy for empty input", () => {
    assert.equal(classifyBusiness({}).key, "general");
  });

  it("caps repeated terms so keyword stuffing cannot dominate", () => {
    const stuffed = classifyBusiness({ textSample: new Array(50).fill("gaming").join(" ") });
    const genuine = classifyBusiness({
      title: "Skincare serum",
      description: "Sunscreen, cleanser and moisturiser for sensitive skin.",
      headings: ["Skincare routine"]
    });

    assert.ok(genuine.score > stuffed.score, `genuine ${genuine.score} should beat stuffed ${stuffed.score}`);
  });

  it("applies negative signals against a mismatched category", () => {
    const withConsumerSignals = classifyBusiness({
      title: "Founders and startups",
      description: "Smartphone and appliances galaxy store",
      headings: []
    });

    assert.notEqual(withConsumerSignals.key, "venture-studio");
  });

  it("reports the matched terms behind the decision", () => {
    const result = classifyBusiness({ title: "Galaxy smartphones", description: "home appliances and wearables" });
    assert.ok(result.matchedTerms.includes("galaxy"));
  });
});

describe("Apple India regression", () => {
  // Apple's page mentions healthcare once in a link, and never says
  // "smartphone" — it says iPhone. That used to classify it as Healthcare.
  const apple = {
    title: "Apple (India)",
    description: "Discover the innovative world of Apple and shop everything iPhone, iPad, Apple Watch, Mac, and Apple TV, plus explore accessories, entertainment, and expert device support.",
    headings: ["iPhone 18 Pro", "Apple Watch Series 12", "Mac mini", "AirPods"],
    textSample: "Shop iPhone, iPad and Mac. Trade in your device and save on accessories.",
    links: ["https://www.apple.com/in/healthcare/", "https://www.apple.com/in/iphone/", "https://www.apple.com/in/mac/"]
  };

  it("classifies Apple as consumer electronics", () => {
    assert.equal(classifyBusiness(apple).key, "consumer-electronics");
  });

  it("recognises product names, not just the generic category word", () => {
    const matched = classifyBusiness(apple).matchedTerms;
    assert.ok(matched.includes("iphone"), `expected iphone in ${matched.join(", ")}`);
  });

  it("does not let one incidental strong term win on its own", () => {
    // "healthcare" alone, repeated, against a page about nothing else.
    const single = classifyBusiness({ links: ["/healthcare/", "/healthcare/x", "/healthcare/y"] });
    assert.notEqual(single.key, "healthcare");
  });

  it("still classifies a genuine healthcare site with varied signals", () => {
    const result = classifyBusiness({
      title: "Northside Clinic",
      description: "Book a consultation with a doctor, diagnostics and pharmacy for patients.",
      headings: ["Telemedicine", "Prescription refills"]
    });

    assert.equal(result.key, "healthcare");
  });
});

describe("category coverage", () => {
  const cases: Array<[string, Parameters<typeof classifyBusiness>[0]]> = [
    ["consumer-electronics", { title: "Galaxy smartphones and home appliances", description: "Smart TV, soundbar and wearables" }],
    ["beauty", { title: "Skincare", description: "Serum, cleanser, sunscreen and moisturiser for daily haircare" }],
    ["fashion", { title: "Womenswear and footwear", description: "Apparel, sneakers and activewear collection" }],
    ["food-beverage", { title: "Recipes and snacks", description: "Beverages, groceries and food delivery menu" }],
    ["fitness", { title: "Gym workout plans", description: "Strength training, supplements and a personal trainer" }],
    ["travel", { title: "Hotels and flights", description: "Book an itinerary, resort stays and destinations" }],
    ["finance", { title: "Credit card and insurance", description: "Mutual funds, banking and loans" }],
    ["education", { title: "Online learning courses", description: "Exam prep, certification and tutorials" }],
    ["home-living", { title: "Furniture and home decor", description: "Mattress, upholstery and interior design" }],
    ["gaming", { title: "Esports and gameplay", description: "Multiplayer battle royale from our game studio" }],
    ["healthcare", { title: "Clinic and diagnostics", description: "Pharmacy, telemedicine and prescription for patients" }],
    ["automotive", { title: "Car reviews and road tests", description: "Ownership reports on indian cars, test drive notes" }],
    ["art-stationery", { title: "Watercolour sketchbook", description: "Gouache, art paper and a colouring book" }],
    ["software", { title: "SaaS API platform", description: "Machine learning, artificial intelligence and integrations" }]
  ];

  for (const [expected, input] of cases) {
    it(`classifies ${expected}`, () => {
      assert.equal(classifyBusiness(input).key, expected);
    });
  }
});

describe("inferBusinessTaxonomy", () => {
  it("returns just the taxonomy", () => {
    const taxonomy = inferBusinessTaxonomy({ title: "Galaxy smartphones", description: "home appliances" });

    assert.equal(taxonomy.industry, "Consumer electronics");
    assert.ok(Array.isArray(taxonomy.audience));
    assert.ok(taxonomy.audience.length > 0);
  });
});
