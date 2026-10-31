// Category icons for expenses: picked automatically from the description,
// overridable per expense (stored as `icon` on the expense doc).

// First match wins, so more specific groups come before general ones.
// Keywords are matched against the lower-cased description, English and German.
const RULES = [
  ["✈️", "flight flug flieger airline airport flughafen ryanair easyjet lufthansa boarding"],
  ["🚆", "train zug bahn öbb db ticket rail railjet metro u-bahn s-bahn tram straßenbahn"],
  ["🚌", "bus coach flixbus fernbus"],
  ["🚕", "taxi uber bolt cab lyft"],
  ["⛴️", "ferry fähre boat boot schiff"],
  ["⛽", "fuel petrol gas station tanken benzin diesel sprit tankstelle"],
  ["🅿️", "parking parken parkhaus garage toll maut vignette"],
  ["🚗", "rental mietwagen leihwagen carsharing"],
  ["🏨", "hotel hostel airbnb booking unterkunft apartment zimmer room pension motel"],
  ["⛺", "camping campsite zelt"],
  ["💶", "atm cash bargeld fee gebühr trinkgeld tip"],
  ["☕", "coffee kaffee café cafe espresso cappuccino latte frühstück breakfast brunch bakery bäckerei bäcker croissant bagel brezel simit"],
  ["🍺", "beer bier pint drink getränke bar pub kneipe"],
  ["🍹", "cocktail cocktails mojito margarita negroni martini daiquiri caipirinha longdrink"],
  ["🥃", "whisky whiskey scotch bourbon gin rum vodka wodka tequila schnaps schnapps shot shots"],
  ["🍷", "wine wein rotwein weißwein weisswein vino sekt champagne champagner heuriger aperol spritz prosecco"],
  ["🍦", "ice cream eis gelato dessert cake kuchen torte strudel kaiserschmarrn baklava waffle waffel crêpe crepe pancake palatschinke"],
  ["🥙", "döner doner kebab kebap falafel lahmacun köfte kofte börek borek pide meze gyros"],
  ["🍕", "pizza pizzeria pasta spaghetti trattoria osteria ristorante risotto gnocchi lasagne lasagna panini panino focaccia antipasti"],
  ["🍣", "sushi ramen noodle noodles nudeln pho dim dumplings thai curry indian chinese vietnamese japanese korean"],
  ["🍔", "burger food essen dinner abendessen lunch mittagessen restaurant meal snack imbiss takeaway mcdonald supper brunch bistro brasserie gasthaus gasthof wirtshaus beisl schnitzel würstel wurst bratwurst gulasch goulash knödel steak grill bbq chicken hähnchen wings chips haggis roast tapas tacos taco burrito mexican salad salat soup suppe sandwich picnic streetfood dinieren"],
  ["🛒", "groceries grocery supermarket supermarkt einkauf einkaufen lidl aldi billa spar rewe edeka hofer penny merkur tesco sainsbury coop migros carrefour mercadona conad monoprix"],
  ["🏰", "castle schloss burg festung fortress palace palast palais"],
  ["🎟️", "museum entry eintritt tour tickets concert konzert show cinema kino theater theatre cathedral kathedrale church kirche abbey abtei gallery galerie zoo aquarium sightseeing excursion ausflug führung guide monument denkmal tower turm exhibition ausstellung attraction distillery destillerie"],
  ["⛷️", "ski skipass lift"],
  ["🏊", "pool spa therme sauna beach strand"],
  ["🎉", "party club disco"],
  ["🛍️", "shopping souvenir gift geschenk clothes kleidung"],
  ["💊", "pharmacy apotheke medicine"],
  ["📶", "sim data esim internet wifi"],
];

export const DEFAULT_ICON = "💰";

const TABLE = RULES.map(([icon, words]) => [icon, words.split(" ")]);

// The keyword that appears first in the description wins ("Taxi to airport" is a taxi);
// at the same spot the longer keyword wins ("tickets" over "ticket").
// Keywords match the start of a word, so "Bierchen" or "Pizzas" still match.
export function autoIcon(desc) {
  const d = " " + String(desc || "").toLowerCase() + " ";
  let best = null;
  for (const [icon, words] of TABLE) {
    for (const w of words) {
      let i = d.indexOf(w);
      while (i > 0 && /[a-zäöüß]/.test(d[i - 1])) i = d.indexOf(w, i + 1);
      if (i > 0 && (!best || i < best.i || (i === best.i && w.length > best.len))) best = { icon, i, len: w.length };
    }
  }
  // Food or drink plus a tour/tickets/tasting is something you do: "Whisky tour", "Wine tasting", "Food tour".
  if (best && FOOD_DRINK.has(best.icon) && ACTIVITY_HINTS.some(w => hasWord(d, w))) return "🎟️";
  return best ? best.icon : DEFAULT_ICON;
}
const FOOD_DRINK = new Set(["☕", "🍺", "🍷", "🍹", "🥃", "🍦", "🥙", "🍕", "🍣", "🍔"]);
const ACTIVITY_HINTS = "tour tours führung tickets ticket eintritt entry tasting verkostung class kurs workshop".split(" ");
// The word appears at the start of a word in the (padded, lower-cased) description.
function hasWord(d, w) { let i = d.indexOf(w); while (i > 0 && /[a-zäöüß]/.test(d[i - 1])) i = d.indexOf(w, i + 1); return i > 0; }

export const iconFor = e => e.icon || autoIcon(e.desc);

// What the picker offers for manual override.
export const PICKS = ["🍔", "🍕", "🥙", "🍣", "☕", "🍺", "🍷", "🍹", "🥃", "🍦", "🛒", "🏨", "⛺", "✈️", "🚆", "🚌", "🚕", "⛴️", "🚗", "⛽", "🅿️", "🏰", "🎟️", "⛷️", "🏊", "🎉", "🛍️", "💊", "📶", "💶", "💰"];

// Categories for the analytics page, derived from the icon (which itself comes from the title,
// or the icon someone picked). Anything not listed here, 💰 included, counts as "other".
const CATS = {
  food: "🍔🍕🥙🍣🍦☕", drinks: "🍺🍷🍹🥃", groceries: "🛒", stay: "🏨⛺",
  transport: "✈️🚆🚌🚕⛴️🚗⛽🅿️", fun: "🏰🎟️⛷️🏊🎉", shopping: "🛍️", health: "💊", phone: "📶", cash: "💶",
};
const SEG = new Intl.Segmenter();
const CAT_OF = {};
for (const [cat, icons] of Object.entries(CATS)) for (const { segment } of SEG.segment(icons)) CAT_OF[segment] = cat;
// The icon shown for each category in the legend.
export const CAT_ICON = { food: "🍔", drinks: "🍺", groceries: "🛒", stay: "🏨", transport: "🚆", fun: "🎟️", shopping: "🛍️", health: "💊", phone: "📶", cash: "💶", other: "💰" };
export const categoryOf = icon => CAT_OF[icon] || "other";
