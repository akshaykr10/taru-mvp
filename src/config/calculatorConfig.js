export const DEGREE_TYPES = [
  { key: "ug",      label: "Undergraduate",       sub: "B.Tech / BA / BSc / B.Com",   startAge: 18, years: 4 },
  { key: "pg",      label: "Postgrad / MBA",       sub: "MA / MSc / MBA / PGDM",       startAge: 22, years: 2 },
  { key: "med_law", label: "Medicine / Law",       sub: "MBBS / BDS / LLB (5–6 yr)",  startAge: 18, years: 5 },
  { key: "phd",     label: "PhD / Research",       sub: "Doctoral programme (4–5 yr)", startAge: 24, years: 4 },
];

export const EDU_COST_MATRIX = {
  ug:      { india_t1: 800000,  india_t2: 2000000, india_t3: 300000,  us_t1: 22000000, us_t2: 14000000, uk: 12000000, can_aus: 10000000 },
  pg:      { india_t1: 2500000, india_t2: 1200000, india_t3: 400000,  us_t1: 10000000, us_t2: 6000000,  uk: 8000000,  can_aus: 5000000  },
  med_law: { india_t1: 3000000, india_t2: 4000000, india_t3: 1500000, us_t1: 28000000, us_t2: 18000000, uk: 15000000, can_aus: 12000000 },
  phd:     { india_t1: 500000,  india_t2: 300000,  india_t3: 150000,  us_t1: 2000000,  us_t2: 1000000,  uk: 1500000,  can_aus: 800000   },
};

export const EDU_TIERS = [
  { key: "india_t1", label: "India — IIT / IIM / AIIMS" },
  { key: "india_t2", label: "India — top private (BITS, Manipal)" },
  { key: "india_t3", label: "India — state / deemed university" },
  { key: "us_t1",   label: "USA — top-20 university" },
  { key: "us_t2",   label: "USA — mid-tier / state school" },
  { key: "uk",      label: "UK — Russell Group" },
  { key: "can_aus", label: "Canada / Australia" },
];

export const BENCHMARKS = {
  mar:     [{ key: "intimate", label: "Intimate (< 100 guests)", cost: 1500000 }, { key: "mid", label: "Standard (100–250 guests)", cost: 3500000 }, { key: "large", label: "Large (250+ guests)", cost: 7500000 }],
  startup: [{ key: "small", label: "Small (services / micro-SaaS)", cost: 500000 }, { key: "medium", label: "Medium (product, small team)", cost: 2000000 }, { key: "large", label: "Deep tech / capital-intensive", cost: 5000000 }],
};

export const PROPERTY_TIERS = [
  {
    key: "metro",
    label: "Metro",
    sub: "Mumbai / Delhi / Bengaluru / Hyderabad / Chennai / Kolkata"
  },
  {
    key: "tier1",
    label: "Tier 1",
    sub: "Pune / Ahmedabad / Jaipur / Kochi / Indore / Chandigarh"
  },
  {
    key: "tier2",
    label: "Tier 2",
    sub: "Lucknow / Nagpur / Bhopal / Surat / Vizag / Coimbatore"
  },
];

export const PROPERTY_TYPES = [
  { key: "apartment", label: "Apartment / Flat" },
  { key: "row_house", label: "Row house / Townhouse" },
  { key: "villa",     label: "Villa / Independent house" },
  { key: "studio",    label: "Studio / Service apartment" },
];

export const PROPERTY_CONFIGS = [
  { key: "studio_1rk", label: "Studio / 1RK" },
  { key: "1bhk",       label: "1 BHK" },
  { key: "2bhk",       label: "2 BHK" },
  { key: "3bhk",       label: "3 BHK" },
  { key: "4bhk_plus",  label: "4 BHK+" },
];

// Full property price matrix [city_tier][property_type][config] in INR
// null = this combination does not exist in the real market
export const PROPERTY_COST_MATRIX = {
  metro: {
    apartment: { studio_1rk: 3000000, "1bhk": 6000000,  "2bhk": 12000000, "3bhk": 20000000, "4bhk_plus": 35000000 },
    row_house:  { studio_1rk: null,    "1bhk": null,      "2bhk": 15000000, "3bhk": 25000000, "4bhk_plus": 45000000 },
    villa:      { studio_1rk: null,    "1bhk": null,      "2bhk": null,     "3bhk": 35000000, "4bhk_plus": 60000000 },
    studio:     { studio_1rk: 2500000, "1bhk": 4000000,  "2bhk": null,     "3bhk": null,     "4bhk_plus": null     },
  },
  tier1: {
    apartment: { studio_1rk: 1200000, "1bhk": 2500000,  "2bhk": 5000000,  "3bhk": 8000000,  "4bhk_plus": 14000000 },
    row_house:  { studio_1rk: null,   "1bhk": null,      "2bhk": 6000000,  "3bhk": 10000000, "4bhk_plus": 18000000 },
    villa:      { studio_1rk: null,   "1bhk": null,      "2bhk": null,     "3bhk": 15000000, "4bhk_plus": 25000000 },
    studio:     { studio_1rk: 1000000,"1bhk": 1800000,  "2bhk": null,     "3bhk": null,     "4bhk_plus": null     },
  },
  tier2: {
    apartment: { studio_1rk: 400000,  "1bhk": 800000,  "2bhk": 1500000, "3bhk": 2500000, "4bhk_plus": 4000000  },
    row_house:  { studio_1rk: null,    "1bhk": null,    "2bhk": 1800000, "3bhk": 3000000, "4bhk_plus": 5500000  },
    villa:      { studio_1rk: null,    "1bhk": null,    "2bhk": null,    "3bhk": 4000000, "4bhk_plus": 8000000  },
    studio:     { studio_1rk: 350000,  "1bhk": 600000,  "2bhk": null,   "3bhk": null,    "4bhk_plus": null     },
  },
};

// The calculator saves for the 20% down payment, not the full property price.
// This must be surfaced explicitly in the UI everywhere a cost is shown.
export const DOWNPAYMENT_PCT = 0.20;

export const INFLATION     = { edu: 0.08, mar: 0.06, house: 0.07, startup: 0.06 };
export const TARGET_AGES   = { mar: 25, house: 30, startup: 28 };
export const RETURNS       = [0.08, 0.11, 0.13];
export const RETURN_LABELS = ["Conservative · 8%", "Moderate · 11%", "Aggressive · 13%"];

export const MILESTONE_META = {
  edu:     { label: "Higher education", icon: "🎓", sub: "College, university, degree" },
  mar:     { label: "Marriage",          icon: "💍", sub: "Wedding and related expenses" },
  house:   { label: "House down payment",icon: "🏠", sub: "First property purchase" },
  startup: { label: "Startup seed",      icon: "🚀", sub: "Capital for their venture" },
};
