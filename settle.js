// Settlement maths for MoneTrip. All amounts are integer cents in the trip currency.

// Equal-split balances: positive = gets money back, negative = owes.
export function balances(members, expenses) {
  const bal = {}, paid = {}, share = {};
  for (const id of Object.keys(members || {})) { bal[id] = 0; paid[id] = 0; share[id] = 0; }
  for (const e of expenses) {
    const base = Math.round(e.amount * (e.rate || 1) * 100);
    const split = (e.split || []).filter(id => id in bal);
    if (!split.length || !(e.paidBy in bal)) continue;
    bal[e.paidBy] += base; paid[e.paidBy] += base;
    const each = Math.floor(base / split.length); let rem = base - each * split.length;
    for (const id of split) { const s = each + (rem > 0 ? 1 : 0); if (rem > 0) rem--; bal[id] -= s; share[id] += s; }
  }
  return { bal, paid, share };
}

function greedy(ent) {
  const out = [];
  const d = ent.filter(e => e[1] < 0).map(e => [e[0], -e[1]]), c = ent.filter(e => e[1] > 0).map(e => [e[0], e[1]]);
  d.sort((a, b) => b[1] - a[1]); c.sort((a, b) => b[1] - a[1]);
  let i = 0, j = 0;
  while (i < d.length && j < c.length) {
    const x = Math.min(d[i][1], c[j][1]);
    out.push({ from: d[i][0], to: c[j][0], amount: x });
    d[i][1] -= x; c[j][1] -= x; if (!d[i][1]) i++; if (!c[j][1]) j++;
  }
  return out;
}

// Fewest transfers: split people into the largest number of groups whose balances
// sum to zero (bitmask DP, exact up to 18 people with a non-zero balance);
// each group of k people then needs k-1 transfers.
export function settle(bal) {
  const ent = Object.entries(bal).filter(e => e[1] !== 0), n = ent.length;
  if (!n) return [];
  if (n > 18) return greedy(ent);
  const N = 1 << n, sum = new Float64Array(N), dp = new Int8Array(N);
  for (let m = 1; m < N; m++) {
    const low = m & -m, i = 31 - Math.clz32(low);
    sum[m] = sum[m ^ low] + ent[i][1];
    let best = 0;
    for (let k = 0; k < n; k++) if (m >> k & 1) { const v = dp[m ^ (1 << k)]; if (v > best) best = v; }
    dp[m] = best + (sum[m] === 0 ? 1 : 0);
  }
  const out = []; let m = N - 1, grp = [];
  while (m) {
    const z = sum[m] === 0 ? 1 : 0; let k = 0;
    for (; k < n; k++) if (m >> k & 1 && dp[m ^ (1 << k)] === dp[m] - z) break;
    grp.push(ent[k]); m ^= 1 << k;
    if (sum[m] === 0) { out.push(...greedy(grp)); grp = []; }
  }
  return out;
}
