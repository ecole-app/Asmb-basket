// Rapporteur pour GitHub Actions : résume les résultats en annotations,
// lisibles sur la page du commit (et via l'API) sans ouvrir les journaux.
export default async function* (source) {
  const fails = []; let pass = 0;
  for await (const ev of source) {
    const d = ev.data || {};
    if (d.details && d.details.type === "suite") continue;
    if (ev.type === "test:pass") pass++;
    if (ev.type === "test:fail") {
      const err = d.details && d.details.error;
      const msg = String((err && err.cause && err.cause.message) || (err && err.message) || err || "").split("\n")[0];
      fails.push(d.name + " -> " + msg.slice(0, 200));
    }
  }
  const enc = (s) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const titre = process.env.TITRE_TESTS || "Tests des règles";
  yield "::notice title=" + titre + "::" + pass + " réussis, " + fails.length + " échoués\n";
  if (fails.length) yield "::error title=" + titre + " en échec::" + enc(fails.join("\n")) + "\n";
}
