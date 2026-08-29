import type { PilotStore } from "./types";

/** Seeded from the `Overview` and `Activation Pointers` tabs of
 *  `Ongoing Stackback Pilot Tracking.xlsx` (Drive 1OdtY_vIl2G9_ql4GDHCcDYTinTW6SUSe,
 *  modified 2026-08-27). Both tabs describe the same 44 stores, so they are merged into
 *  one record per store rather than kept as two lists to reconcile by eye.
 *
 *  Held as a tab-separated block rather than 44 object literals: it stays diffable against
 *  the sheet, and re-pasting a column is a line edit instead of a rewrite. */
export const PILOT_SEED_SOURCE =
  "Overview + Activation Pointers tabs, Ongoing Stackback Pilot Tracking.xlsx (2026-08-27)";

/* n | name | url | status | pilotStart | groupCreated | pilotEnd | totalSubs | activeSubs |
   oneTimeBundles | prepaidSubs | openBugs | sentiment | primaryDev | category | poc |
   activationStatus | paymentType | lastTouch | activationNotes | email | onboardingNotes |
   discountMargin | shipping | frequency | bundles | themeNotes */
const ROWS = `
1|MillD|https://milld.com/|Live|19 May||19 July|520|288||257|9|Happy|Shubham|Food & Grocery Brands||Activated|||WA integration pending + Custom checkout on PAYG|||||||
2|Everpure|https://everpurelife.com/|Live|5 May|29 April|5 July|4|4||4|||Shubham|Protein & Supplement Brands||Activated|||Went live in 7 days|||||||
3|Arusha Foods|https://arushafoods.in/|Live|23 June|5 June|13 Jul 2026|14|11|1|8|||Shubham|Food & Grocery Brands||Activated|||Plans approved, final discount rates to be shared|||||||
4|The Basics Woman|https://thebasicswoman.com/|Live|2 July||12 Jul 2026|22|19||11|||Shubham|Protein & Supplement Brands|Ishita|Activated|||Theme update, shopflo clarity to be shared|||||||
5|Mittai Kadai|https://www.satturmittaikadai.com/|Live|6 July|24 June||15|14|109|12|||Shubham|Specialty Food & Snacks|Ishita|Activated|||Plan approval internal, cart refresh on older themes|lpashunmu@satturmittaikadai.com||||||
6|Glow Glossary|https://glowglossary.com|Live|14 July|9 July|14 September|71|32||1||||Tea Brands|Ishita|Activated||||||||||
7|Tripitaka|https://tripitaka.tfft.in/|Live|4 August|28 July|4 October|0|0|1|0||||Water, Juices, Kombucha & Bottled Beverages|Ishita|Activated||||tripitaka@tfft.in||||||
8|ActivHippy|https://activhippy.com/|Live|7 August|30 July|7 October|0|0|0|0||||Water, Juices, Kombucha & Bottled Beverages|Shreya|Activated||||yadu@activehippy.com||||||
9|Yin N Yang|https://yinnyangfarms.com|Live|11 August|13 July|11 October|0|0|4|0||||Food & Grocery Brands|Ishita|Activated|||Cart refresh on older themes, brand POC gap|tehn@yinnyangfarms.com||||||
10|The Stack|https://thestack.club|Live|12 August|27 July|12 October|39|38|2|38||||Protein & Supplement Brands|Ishita|Activated|||Internal gap on comms, rekee had to be done|k@thestack.club, adithi.anchan@thestack.club||||||
11|BLND|https://blndwater.com/|Live|13 August|11 Aug||1|1|1|1||||Water, Juices, Kombucha & Bottled Beverages|Shreya|Activated||13 Aug|Plans to be configured & setup|brandmanager@fultariyabeverages.com||||||
12|The Func. Lab|thefunclab.com|Live|19 August|19 August||0|0|0|0||||Protein & Supplement Brands|Ishita|Activated|Prepaid|19 Aug|Live. Theme issues, founder availability, alignment on how-subscription-works page|||||||
13|My Pahadi Dukan|https://mypahadidukan.com/|Live|21 August|14 August||3|3|0|2||||Food & Grocery Brands|Ishita|Active|Both|21 Aug|Automation updates closed, merchant discussing internally|anas.zubair@mypahadidukan.com||||||
14|Dearist|https://www.thedearist.com/|Preview Shared||10 Aug|||||||||Bath & Body Products|Shreya|Active||27 Aug|Waiting for bundle review, preview sent|meher@thedearist.com||||||
15|NuFyt|https://nufyt.com|Client Feedback||1 Aug|||||||||Protein & Supplement Brands|Ishita|Active|Prepaid|26 Aug|Widget can go live with the new theme. Freebie quantity, tokens, cancellation policy edits shared|dhruv@nufyt.com||||||
16|Toffee Coffee Roasters|https://toffeecoffeeroasters.com|Preview Shared||4 Aug|||||||||Coffee Brands|Ishita|Inactive|Prepaid|26 Aug|Plans updated, preview to follow. Their website theme is being updated|rishabh@toffeecoffeeroasters.com|Website theme is getting updated from their side|||||
17|Jab Marji|https://jabmarji.com|Plans Generated||27 July|||||||||Food & Grocery Brands|Shreya|Active|Both|25 Aug|Team setting up their backend, will revert|gurveek.maan@jabmarji.in||||||
18|Boojee|https://boojeecafe.com|Onboarded||4 Aug|||||||||Coffee Brands|Ishita|Active||24 Aug|Client will be sending plans|designs@boojeecafe.com||||||
19|EatSlow|https://eatslow.in|Onboarded||4 Aug|||||||||Specialty Food & Snacks|Ishita|Inactive||12 Aug|Plans to be configured & setup|eatslow90@gmail.com||||||
20|Soulflower|https://www.soulflower.in|Preview Shared||27 July|||||||||Bath & Body Products|Ishita|Inactive|||Brand POC gap, inactive|juneed@soulflower.in||||||
21|Meru Activs|https://meruactivs.com|||10 Aug|||||||||Protein & Supplement Brands|Ishita|Active||26 Aug|Preview has been sent|kalpesh@merulife.com||||||
22|Monks Bouffe|https://www.monksbouffe.com/|||13 August|||||||||Food & Grocery Brands|Shreya|Active|Prepaid|27 Aug|Waiting for GoQuick payment activation. Max 15% discount, 3/6/12 month cycles|gaurangmotta@monksbouffe.com||15 max, so 15, 12, 10||3, 6 & 12 months & bi-weekly 3, 6, 12|Yes|Gems landing page, dynamic banner requested on PDP redirecting to the relevant landing page
23|Go Swasthya|goswasthya.com|Preview Shared||12 June|14 Jul 2026|||||||Shubham|Food & Grocery Brands||Inactive|Both||Prepaid only, setup complete, shipping setup clarity needed|||||||
24|Shatabdi Organics|https://shathabdhiorganics.com|Preview Shared||10 July|||||||||Food & Grocery Brands||Inactive|Both||Awaiting additional products and WhatsApp/email notifications|gsatyadev@gmail.com, kasusribhanu@shathabdhiorganics.com||||||
25|Iron Asylum (Prosupps)|https://prosuppsindia.com/|Client Feedback||13 August|||||||||Protein & Supplement Brands|Ishita|Active||26 Aug|Follow up sent for plan review|akshayr@ironasylum.co.in||||||
26|SUPR|https://supr.co.in/|Client Feedback||17 August|||||||||Protein & Supplement Brands|Shreya|Active||27 Aug|Working on plan updates & freebies over WhatsApp|aryanshubham@supr.co.in||||||
27|Drink Elixir|https://drink-elixir.co/|||17 August|||||||||Water, Juices, Kombucha & Bottled Beverages|Shreya|Inactive||27 Aug|Making website changes, then will give access. BD following up|yash_s@drinkelixir.in||||||
28|Anvika Wellness|https://anvikawellness.com/|||17 August|||||||||Protein & Supplement Brands|Shreya|Active||27 Aug|New site live approx 28 Aug. Prepaid only, max 15%, freq 2x/3x/4x|anvi@anvikawellness.com||Max 15%||2x, 3x, 4x, prepaid only||
29|LightYearsHealth|https://lightyearshealth.com/|Client Feedback||17 August|||||||||Protein & Supplement Brands|Ishita|Active|Prepaid|26 Aug|Follow up sent for discount details|eeshan@elevateconsumer.com, shivang@elevateconsumer.com||||||
30|Millegram|https://millegram.in/|||18 August|||||||||Food & Grocery Brands|Shreya|Activated|Both|25 Aug|Live. Testing between Bundler app and Bundle & Save|anupk@millegram.in||||||
31|Hesthetics|https://hesthetic.com/|||19 August|||||||||Bath & Body Products|Shreya|Active||27 Aug|BD team following up again|ashish@hesthetic.com||||||
32|Orchard Lane|https://orchardlane.in/|||19 August|||||||||Food & Grocery Brands|Ishita|Active||26 Aug|Follow up sent for collaborator code|gagan@orchardlane.in||||||
33|Skin Inspired|https://skininspired.in/|||19 August|||||||||Bath & Body Products|Shreya|Active||27 Aug|Wants refill SKU from order 2 onward. Accounted for in the roadmap|vipin@skininspired.in|Wants the main SKU on order 1 and the refill SKU from order 2 onward. Accounted for in the roadmap|||||
34|Origami Tissues|https://origamitissues.com/|||21 August|||||||||Bath & Body Products|Shreya|Active||27 Aug|Store access around 1 Sept, new site around 15 Sept|surajk@origamiindia.com|Access around 1 Sept, new website around 15 Sept|||||
35|BlueTea|https://bluetea.co.in/|Onboarded||21 August|||||||||Tea Brands|Ishita|Active||26 Aug|Will provide details by EOD. Wants to use Go Kwik only|anurag@bluetea.co.in, muskan@mailbox.bluetea.co.in|Wants to use Go Kwik only|||||
36|Protocol 35||||21 August||||||||||Ishita|Inactive||||||||||
37|Rosier Foods|https://www.rosierfoods.com/|||24 August|||||||||Food & Grocery Brands|Shreya|Active||27 Aug|NDA to be signed. Wants to start with oats and aata|kartavya@rosierfoods.com|Wants to start with oats and aata|||||
38|Ace Blend|https://aceblend.com/|||26 August||||||||||Ishita|Active||26 Aug||||||||
39|Zoy Care|https://zoycare.com/|||26 August||||||||||Shreya|Active||27 Aug|Discussing plans & design updates over WhatsApp|||||||
40|Zama|Zamaorganics.com|Client Feedback|||12 Jul 2025||0|||6|Happy|Shubham|Food & Grocery Brands|Ishita|Active||26 Aug|To be shared post CC & pincode implementation|||||||
41|Frais Farms|https://fraisfarms.com/|Preview Shared|||12 Jul 2025||0|||0|Happy|Shubham|Food & Grocery Brands||Inactive|||Not responsive. Strong pilot data, 99.4% delivery|||||||
42|WellWith|https://wellness.ayuzera.com/|Onboarded|||12 Jul 2026||0|||||Shubham|Bath & Body Products||Inactive|||Not responsive|||||||
43|Simply Nam|https://www.simplynam.com/|Preview Shared|||12 Jul 2026|||||||Shubham|Bath & Body Products||Inactive|||To be shared post CC implementation|||||||
44|Kaidoo Kids|https://kaidookids.com/|Preview Shared|||15 Jul 2026|||||||Shubham|Specialty Food & Snacks||Inactive||||||||||
`.trim();

const num = (v: string): number | null => {
  const t = (v || "").trim();
  if (!t) return null;
  const n = Number(t.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const str = (v: string): string | null => ((v || "").trim() || null);

export function pilotSeed(): PilotStore[] {
  return ROWS.split("\n").map((line) => {
    const c = line.split("|");
    return {
      id: "",
      n: Number(c[0]) || 0,
      name: (c[1] || "").trim(),
      url: str(c[2]),
      status: str(c[3]),
      pilotStart: str(c[4]),
      groupCreated: str(c[5]),
      pilotEnd: str(c[6]),
      totalSubs: num(c[7]),
      activeSubs: num(c[8]),
      oneTimeBundles: num(c[9]),
      prepaidSubs: num(c[10]),
      openBugs: num(c[11]),
      sentiment: str(c[12]),
      primaryDev: str(c[13]),
      category: str(c[14]),
      poc: str(c[15]),
      activationStatus: str(c[16]),
      paymentType: str(c[17]),
      lastTouch: str(c[18]),
      activationNotes: str(c[19]),
      email: str(c[20]),
      onboardingNotes: str(c[21]),
      discountMargin: str(c[22]),
      shipping: str(c[23]),
      frequency: str(c[24]),
      bundles: str(c[25]),
      themeNotes: str(c[26]),
    };
  });
}
