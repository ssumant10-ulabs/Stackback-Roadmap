/** What we propose before a store's own data is read, by category.
 *
 *  These come from what the pilot cohort actually runs, not from theory: coffee and tea
 *  reorder fastest, supplements settle on a month because that is how a jar is dosed, pet
 *  food follows bag size, and personal care is the slowest and the one most often set too
 *  frequent. They are a starting point for the conversation, and the store's own repeat gap
 *  overrules them every time, which is why the UI says so rather than presenting them as
 *  an answer. */

export interface CategorySuggestion {
  id: string;
  label: string;
  /** Days between deliveries, most common first. */
  everyDays: number[];
  /** Run lengths that sell in this category. */
  deliveries: number[];
  /** A discount band per run length, same order as `deliveries`. */
  discounts: number[];
  why: string;
}

export const CATEGORIES: CategorySuggestion[] = [
  {
    id: "coffee-tea", label: "Coffee and tea",
    everyDays: [14, 30], deliveries: [3, 6, 12], discounts: [10, 15, 20],
    why: "A 250g bag lasts a fortnight in a two-person household, so fortnightly is the honest default and monthly is the safe one. Discounts stay modest because the category already reorders.",
  },
  {
    id: "supplements", label: "Supplements and nutrition",
    everyDays: [30], deliveries: [3, 6, 12], discounts: [15, 18, 20],
    why: "A jar is dosed to a month, so anything but monthly fights the product. Three months is the shortest run worth selling, because the customer has not felt the benefit before that.",
  },
  {
    id: "pet", label: "Pet food and care",
    everyDays: [30, 60], deliveries: [3, 6], discounts: [10, 15],
    why: "Follows bag size rather than habit. Ask what size they sell most of before fixing the frequency.",
  },
  {
    id: "personal-care", label: "Skin, hair and personal care",
    everyDays: [30, 60], deliveries: [3, 6], discounts: [15, 20],
    why: "The slowest repeat gap of the lot and the one most often set too frequent, which shows up as skipped deliveries rather than churn.",
  },
  {
    id: "food-staples", label: "Food staples and groceries",
    everyDays: [14, 30], deliveries: [4, 6, 12], discounts: [8, 12, 15],
    why: "High frequency, thin margin. The discount matters less here than the convenience, so do not give away more than the category can carry.",
  },
  {
    id: "beverages", label: "Beverages and mixes",
    everyDays: [14, 30], deliveries: [3, 6], discounts: [10, 15],
    why: "Consumption is seasonal, so expect pauses in winter and build the run length to survive them.",
  },
  {
    id: "home", label: "Home and cleaning",
    everyDays: [30, 60], deliveries: [3, 6], discounts: [10, 15],
    why: "Predictable but slow. Bundles do more work than frequency here.",
  },
  {
    id: "other", label: "Something else",
    everyDays: [30], deliveries: [3, 6], discounts: [15, 18],
    why: "No category default to lean on, so this leans on the safest one. Your own repeat gap should replace it.",
  },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export { freqWord } from "./sim";
