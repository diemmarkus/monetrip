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
  ["☕", "coffee kaffee café cafe espresso cappuccino latte frühstück breakfast"],
  ["🍺", "beer bier pint drink getränke bar pub kneipe"],
  ["🍷", "wine wein aperol spritz cocktail prosecco"],
  ["🍦", "ice cream eis gelato dessert"],
  ["🥙", "döner doner kebab kebap falafel"],
  ["🍕", "pizza pizzeria pasta spaghetti"],
  ["🍣", "sushi ramen"],
  ["🍔", "burger food essen dinner abendessen lunch mittagessen restaurant meal snack imbiss takeaway mcdonald"],
  ["🛒", "groceries grocery supermarket supermarkt einkauf einkaufen lidl aldi billa spar rewe edeka"],
  ["🎟️", "museum entry eintritt tour tickets concert konzert show cinema kino theater theatre"],
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
  return best ? best.icon : DEFAULT_ICON;
}

export const iconFor = e => e.icon || autoIcon(e.desc);

// What the picker offers for manual override.
export const PICKS = ["🍔", "🍕", "🥙", "🍣", "☕", "🍺", "🍷", "🍦", "🛒", "🏨", "⛺", "✈️", "🚆", "🚌", "🚕", "⛴️", "🚗", "⛽", "🅿️", "🎟️", "⛷️", "🏊", "🎉", "🛍️", "💊", "📶", "💶", "💰"];
