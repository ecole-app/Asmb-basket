// Audit XSS : liste les valeurs variables insérées dans du HTML sans être échappées.
// Usage : node outils/audit-xss.js [--tout]      (demande tests/node_modules : cd tests && npm ci)
// Il lit js/*.js et les scripts des pages publiques, suit les variables locales, les tableaux (push/join/map)
// et les fonctions du projet, puis dit pour chaque valeur dans quel contexte HTML elle tombe :
//   texte, attr-dq (attribut "…"), innerHTML=  → authEsc()
//   js-chaine (dans onclick="f('…')")           → gmJs()
//   url-debut (href/src)                         → authEsc(gmUrl(…))
// Ce n'est pas un test : il reste des faux positifs (constantes du code, nombres, fragments HTML passés
// en paramètre). Il sert à relire vite un écran qu'on vient d'écrire. Le contrôle dans un vrai navigateur :
// cd tests && npm run jarvis:hostile.
const fs = require("fs"), path = require("path");
const RACINE = path.join(__dirname, "..");
const acorn = require(path.join(RACINE, "tests/node_modules/acorn"));

const ESC = new Set(["authEsc", "esc", "indEsc", "gmJs"]);
const PASSE_FN = new Set(["String", "gmT", "gmUrl"]);
const SUR_FN = new Set(["Number", "parseInt", "parseFloat", "encodeURIComponent", "encodeURI", "Boolean", "isNaN"]);
const SUR_OBJ = new Set(["Math", "Date"]);
const SUR_METH = new Set(["toFixed", "getFullYear", "getMonth", "getDate", "getDay", "getHours", "getMinutes", "getSeconds", "getTime", "indexOf", "lastIndexOf", "toLocaleDateString", "toLocaleTimeString", "toLocaleString", "toISOString", "charCodeAt", "localeCompare", "some", "every", "includes", "test", "startsWith", "endsWith", "has", "findIndex", "valueOf", "toPrecision"]);
const PASSE_METH = new Set(["toUpperCase", "toLowerCase", "trim", "replace", "replaceAll", "substring", "substr", "slice", "charAt", "padStart", "padEnd", "concat", "filter", "reverse", "sort", "normalize", "repeat", "toString", "split", "pop", "shift", "at", "trimStart", "trimEnd", "find", "flat"]);

const fichiers = []; // {f, code, ast, decal}
function charger(f, code, decal, module, base) {
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: "latest", locations: true, sourceType: module ? "module" : "script", allowReturnOutsideFunction: true }); }
  catch (e) { try { ast = acorn.parse(code, { ecmaVersion: "latest", locations: true, sourceType: "module" }); } catch (e2) { console.error("ILLISIBLE", f, e2.message); return; } }
  fichiers.push({ f, code, ast, decal, base: base || 0 });
}
const jsDir = path.join(RACINE, "js");
fs.readdirSync(jsDir).filter((f) => f.endsWith(".js")).sort().forEach((f) => charger("js/" + f, fs.readFileSync(path.join(jsDir, f), "utf8"), 0, f === "firebase-init.js"));
["index.html", "buvette/index.html", "tournoi/index.html", "benevole/index.html", "fil/index.html"].forEach((f) => {
  const html = fs.readFileSync(path.join(RACINE, f), "utf8");
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) {
    if (/\bsrc=/.test(m[1]) || !m[2].trim()) continue;
    const ligne = html.slice(0, m.index + m[0].indexOf(m[2])).split("\n").length - 1;
    charger(f, m[2], ligne, /type="module"/.test(m[1]), m.index + m[0].indexOf(m[2]));
  }
});

// ── Liens parent / portée ──
const estFn = (n) => n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression";
function enfants(n, cb) {
  for (const k in n) {
    if (k === "loc" || k === "start" || k === "end" || k === "parent" || k === "_f" || k === "_port") continue;
    const v = n[k];
    if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === "string" && cb(x));
    else if (v && typeof v.type === "string") cb(v);
  }
}
const globalFns = {}; // nom → [node]
const globalVars = {}; // nom → [expr]
const appelsDe = {}; // nom de fonction → [appels]
const purParamMemo = new Map();
function noms(pat, out) {
  if (!pat) return out;
  if (pat.type === "Identifier") out.push(pat.name);
  else if (pat.type === "ObjectPattern") pat.properties.forEach((p) => noms(p.value || p.argument, out));
  else if (pat.type === "ArrayPattern") pat.elements.forEach((p) => noms(p, out));
  else if (pat.type === "AssignmentPattern") noms(pat.left, out);
  else if (pat.type === "RestElement") noms(pat.argument, out);
  return out;
}
function preparer(F) {
  (function marche(n, parent, fn) {
    n.parent = parent; n._f = F;
    let port = fn;
    if (estFn(n)) {
      n._port = { decl: new Set(), params: {}, aff: {}, retours: [], parentFn: fn, node: n };
      n.params.forEach((p, i) => noms(p, []).forEach((nm) => { n._port.decl.add(nm); n._port.params[nm] = i; }));
      if (n.type === "FunctionDeclaration" && n.id) { (fn ? fn._port.decl.add(n.id.name) : 0); if (!fn) (globalFns[n.id.name] = globalFns[n.id.name] || []).push(n); else (fn._port.fns = fn._port.fns || {})[n.id.name] = n; }
      if (n.type === "ArrowFunctionExpression" && n.expression) n._port.retours.push(n.body);
      port = n;
    }
    const P = port ? port._port : null;
    const ajoute = (nom, expr, declare) => {
      if (declare) { if (P) P.decl.add(nom); }
      // portée où le nom est déclaré
      let p = port;
      while (p && !p._port.decl.has(nom)) p = p._port.parentFn;
      const cible = p ? p._port.aff : globalVars;
      if (expr) (cible[nom] = cible[nom] || []).push(expr);
    };
    if (n.type === "VariableDeclarator") {
      if (n.id.type === "Identifier") {
        ajoute(n.id.name, n.init, true);
        if (n.init && estFn(n.init)) { if (!port) (globalFns[n.id.name] = globalFns[n.id.name] || []).push(n.init); else (P.fns = P.fns || {})[n.id.name] = n.init; }
      } else noms(n.id, []).forEach((nm) => { if (P) P.decl.add(nm); ajoute(nm, { type: "Inconnu", loc: n.loc, start: n.start, end: n.end, _f: F, parent: n }, true); });
    }
    if (n.type === "AssignmentExpression" && n.left.type === "Identifier") ajoute(n.left.name, n.right, false);
    if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression" && n.left.object.type === "Identifier" && n.left.object.name === "window" && !n.left.computed && estFn(n.right)) (globalFns[n.left.property.name] = globalFns[n.left.property.name] || []).push(n.right);
    if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && !n.callee.computed && n.callee.object.type === "Identifier" && (n.callee.property.name === "push" || n.callee.property.name === "unshift")) n.arguments.forEach((a) => ajoute(n.callee.object.name, { type: "Element", de: a, loc: a.loc, start: a.start, end: a.end, _f: F, parent: n }, false));
    if (n.type === "CallExpression" && n.callee.type === "Identifier") (appelsDe[n.callee.name] = appelsDe[n.callee.name] || []).push(n);
    if (n.type === "ReturnStatement" && n.argument && P) P.retours.push(n.argument);
    if ((n.type === "ForInStatement" || n.type === "ForOfStatement") && n.left.type === "VariableDeclaration") noms(n.left.declarations[0].id, []).forEach((nm) => { if (P) P.decl.add(nm); ajoute(nm, { type: n.type === "ForInStatement" ? "Cle" : "ElementDe", de: n.right, loc: n.right.loc, start: n.right.start, end: n.right.end, _f: F, parent: n }, true); });
    if (n.type === "CatchClause" && n.param && P) noms(n.param, []).forEach((nm) => { P.decl.add(nm); (P.aff[nm] = P.aff[nm] || []).push({ type: "Erreur", loc: n.loc, start: n.start, end: n.end, _f: F, parent: n }); });
    enfants(n, (c) => marche(c, n, port));
  })(F.ast, null, null);
}
fichiers.forEach(preparer);

const src = (n) => n._f.code.slice(n.start, n.end).replace(/\s+/g, " ");
function fnDe(n) { let p = n.parent; while (p && !estFn(p)) p = p.parent; return p || null; }
function trouverFn(n, nom) {
  let p = fnDe(n);
  while (p) { if (p._port.fns && p._port.fns[nom]) return [p._port.fns[nom]]; if (p._port.decl.has(nom)) return null; p = p._port.parentFn; }
  return globalFns[nom] || null;
}

// Résultat : { cl: "sur"|"esc"|"html"|"brut", f: [feuilles] } ; feuille = {n, sorte, note}
const SUR = { cl: "sur", f: [], pur: true }, LIT = { cl: "html", f: [], pur: true }, LITH = { cl: "html", f: [], pur: false };
function fusion(a) {
  const f = []; let cl = "sur";
  a.forEach((x) => { x.f.forEach((y) => f.push(y)); if (x.cl === "brut") cl = "brut"; else if (cl !== "brut" && (x.cl === "html" || x.cl === "esc")) cl = cl === "sur" ? x.cl : "html"; });
  return { cl, f, pur: a.every((x) => x.pur !== false) };
}
const feuille = (n, sorte, note) => ({ cl: "brut", f: [{ n, sorte, note: note || "" }], pur: true });
const enCours = new Set(), memo = new Map(), resumeFn = new Map();
function nomFn(fn) { return (fn.id && fn.id.name) || (fn.parent && fn.parent.type === "VariableDeclarator" && fn.parent.id.name) || (fn.parent && fn.parent.type === "AssignmentExpression" && src(fn.parent.left)) || "(anonyme)"; }

function classerIdent(n, nom) {
  let p = fnDe(n);
  while (p) {
    if (p._port.decl.has(nom)) {
      if (nom in p._port.params && !(p._port.aff[nom] || []).length) {
        // paramètre : d'où vient-il ? rappel de tableau (forEach/map…) → élément de ce tableau
        const par = p.parent;
        if (par && par.type === "CallExpression" && par.arguments.includes(p) && par.callee.type === "MemberExpression" && !par.callee.computed) {
          const meth = par.callee.property.name, i = p._port.params[nom];
          if (["forEach", "map", "filter", "some", "every", "find", "findIndex", "reduce", "sort", "flatMap"].includes(meth)) {
            if (meth === "sort" || (meth !== "reduce" && i === 0) || (meth === "reduce" && i === 1)) return feuille(n, "elem", src(par.callee.object).slice(0, 60));
            if (i === 1 && meth !== "reduce") return SUR; // index
          }
        }
        // le paramètre reçoit-il du HTML déjà construit quelque part ? (alors on ne l'échappe pas ici)
        const cleP = nomFn(p) + "#" + p._port.params[nom];
        let pur = true;
        if (purParamMemo.has(cleP)) pur = purParamMemo.get(cleP);
        else {
          purParamMemo.set(cleP, true);
          const appels = appelsDe[nomFn(p)] || [];
          for (const a of appels) { const arg = a.arguments[p._port.params[nom]]; if (arg && arg.type !== "SpreadElement") { const c = classer(arg); if (c.pur === false) { pur = false; break; } } }
          purParamMemo.set(cleP, pur);
        }
        const fp = feuille(n, "param", cleP); fp.pur = pur; return fp;
      }
      const aff = p._port.aff[nom] || [];
      if (p._port.fns && p._port.fns[nom]) return feuille(n, "fn", nom);
      if (!aff.length) return SUR; // déclarée sans valeur
      return classerListe(aff, n);
    }
    p = p._port.parentFn;
  }
  if (globalVars[nom]) return classerListe(globalVars[nom], n);
  if (nom === "undefined" || nom === "NaN" || nom === "Infinity") return SUR;
  return feuille(n, "global", nom);
}
function classerListe(exprs, pour) {
  const cle = exprs;
  if (memo.has(cle)) return memo.get(cle);
  if (enCours.has(cle)) return SUR; // récursion (h+=…) : le reste de la liste décide
  enCours.add(cle);
  const r = fusion(exprs.map((e) => classer(e)));
  enCours.delete(cle); memo.set(cle, r);
  return r;
}
function resume(fn) {
  if (resumeFn.has(fn)) return resumeFn.get(fn);
  resumeFn.set(fn, SUR); // garde-fou récursion
  const r = fn._port.retours.length ? fusion(fn._port.retours.map((e) => classer(e))) : SUR;
  resumeFn.set(fn, r);
  return r;
}
function classer(n) {
  switch (n.type) {
    case "Literal": return typeof n.value === "string" ? (/[<>&"=]/.test(n.value) ? LITH : LIT) : SUR;
    case "TemplateLiteral": return fusion([n.quasis.some((q) => /[<>&"=]/.test(q.value.cooked || "")) ? LITH : LIT].concat(n.expressions.map(classer)));
    case "Inconnu": return feuille(n, "destructure");
    case "Erreur": return feuille(n, "erreur");
    case "Cle": return feuille(n, "cle", src(n.de).slice(0, 60));
    case "ElementDe": return feuille(n, "elem", src(n.de).slice(0, 60));
    case "Element": return classer(n.de);
    case "ArrayExpression": return fusion(n.elements.filter(Boolean).map((e) => classer(e.type === "SpreadElement" ? e.argument : e)));
    case "ObjectExpression": return SUR;
    case "UnaryExpression": return (n.operator === "void" || n.operator === "delete") ? SUR : (["+", "-", "!", "typeof", "~"].includes(n.operator) ? SUR : classer(n.argument));
    case "UpdateExpression": return SUR;
    case "BinaryExpression": return n.operator === "+" ? fusion([classer(n.left), classer(n.right)]) : SUR;
    case "ConditionalExpression": return fusion([classer(n.consequent), classer(n.alternate)]);
    case "LogicalExpression": return n.operator === "&&" ? classer(n.right) : fusion([classer(n.left), classer(n.right)]);
    case "AssignmentExpression": return classer(n.right);
    case "SequenceExpression": return classer(n.expressions[n.expressions.length - 1]);
    case "AwaitExpression": return classer(n.argument);
    case "NewExpression": return (n.callee.type === "Identifier" && ["Date", "Number"].includes(n.callee.name)) ? SUR : feuille(n, "new");
    case "ThisExpression": return feuille(n, "this");
    case "Identifier": return classerIdent(n, n.name);
    case "MemberExpression": {
      if (!n.computed && n.property.name === "length") return SUR;
      const o = n.object;
      if (o.type === "Identifier" && SUR_OBJ.has(o.name)) return SUR;
      // tableau/objet local de constantes : x[i] où x n'a que des littéraux
      if (n.computed && o.type === "Identifier") { const c = classer(o); if (c.cl !== "brut") return c; }
      // constante globale en MAJUSCULES : table de configuration du code
      let racine = o; while (racine.type === "MemberExpression") racine = racine.object;
      return feuille(n, "champ", racine.type === "Identifier" ? origine(racine) : "");
    }
    case "CallExpression": {
      const c = n.callee;
      if (c.type === "Identifier") {
        if (ESC.has(c.name)) return { cl: "esc", f: [], pur: false };
        if (SUR_FN.has(c.name)) return SUR;
        if (PASSE_FN.has(c.name)) return n.arguments[0] ? classer(n.arguments[0]) : SUR;
        const fns = trouverFn(n, c.name);
        if (fns && fns.length) {
          // résumé : feuilles « param fn#i » remplacées par l'argument passé ici
          const morceaux = [];
          fns.forEach((fn) => {
            const r = resume(fn), reste = [];
            r.f.forEach((y) => {
              if (y.sorte === "param" && fnDe(y.n) === fn) { const i = fn._port.params[y.n.name]; if (n.arguments[i]) morceaux.push(classer(n.arguments[i].type === "SpreadElement" ? n.arguments[i].argument : n.arguments[i])); }
              else reste.push(y);
            });
            morceaux.push({ cl: reste.length ? "brut" : (r.cl === "brut" ? "html" : r.cl), f: reste, pur: r.pur });
          });
          return fusion(morceaux);
        }
        return feuille(n, "appel", c.name);
      }
      if (c.type === "MemberExpression" && !c.computed) {
        const m = c.property.name;
        if (c.object.type === "Identifier" && SUR_OBJ.has(c.object.name)) return SUR;
        if (SUR_METH.has(m)) return SUR;
        if (m === "join") return fusion([classer(c.object), n.arguments[0] ? classer(n.arguments[0]) : SUR]);
        if (m === "map" || m === "flatMap") { const cb = n.arguments[0]; if (cb && estFn(cb)) return resume(cb); if (cb && cb.type === "Identifier") { const fns = trouverFn(n, cb.name); if (fns && fns.length) return fusion(fns.map(resume)); } const fm = feuille(n, "appel", "map(?)"); fm.pur = false; return fm; }
        if (m === "reduce") { const cb = n.arguments[0]; return fusion([cb && estFn(cb) ? resume(cb) : feuille(n, "appel", "reduce(?)"), n.arguments[1] ? classer(n.arguments[1]) : SUR]); }
        if (PASSE_METH.has(m)) return fusion([classer(c.object)].concat(m === "concat" || m === "padStart" || m === "padEnd" ? n.arguments.map(classer) : (m === "replace" || m === "replaceAll") && n.arguments[1] && !estFn(n.arguments[1]) ? [classer(n.arguments[1])] : []));
        if (c.object.type === "Identifier" && c.object.name === "window") { const fns = globalFns[m]; if (fns) return classer(Object.assign({}, n, { callee: { type: "Identifier", name: m, parent: n, _f: n._f, start: c.start, end: c.end, loc: c.loc } })); }
        if (c.object.type === "Identifier" && (c.object.name === "JSON" || c.object.name === "Object")) return feuille(n, "appel", src(c));
        return feuille(n, "appel", "." + m);
      }
      return feuille(n, "appel", "?");
    }
    default: return feuille(n, n.type);
  }
}
function origine(id) {
  // d'où vient l'objet : élément d'un tableau parcouru, paramètre, variable affectée par…
  const r = classerIdent(id, id.name);
  const y = r.f[0];
  if (!y) return "(local)";
  if (y.n === id) return y.sorte + ":" + y.note;
  return y.sorte + ":" + (y.note || src(y.n).slice(0, 50));
}

// ── Automate HTML (contexte de chaque morceau variable) ──
function avancer(etat, t) {
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (etat.m === "texte") { if (c === "<") { etat.m = "balise"; etat.attr = ""; etat.tampon = ""; } }
    else if (etat.m === "balise") {
      if (c === ">") etat.m = "texte";
      else if (c === '"' || c === "'") { etat.m = "valeur"; etat.q = c; etat.attr = (etat.tampon.match(/([a-zA-Z0-9_:-]+)\s*=\s*$/) || [, ""])[1].toLowerCase(); etat.tampon = ""; }
      else etat.tampon += c;
    } else if (etat.m === "valeur") { if (c === etat.q) { etat.m = "balise"; etat.tampon = ""; } else etat.tampon += c; }
  }
}
function contexte(etat) {
  if (etat.m === "texte") return { c: "texte" };
  if (etat.m === "balise") { const m = etat.tampon.match(/([a-zA-Z0-9_:-]+)\s*=\s*$/); return { c: m ? "attr-nu" : "balise", attr: m ? m[1].toLowerCase() : "" }; }
  const a = etat.attr; let c = etat.q === '"' ? "attr-dq" : "attr-sq";
  if (/^on/.test(a)) { const t = etat.tampon; let q = null; for (let i = 0; i < t.length; i++) { const ch = t[i]; if (q) { if (ch === "\\") i++; else if (ch === q) q = null; } else if (ch === "'" || ch === '"' || ch === "`") q = ch; } c = q ? "js-chaine" : "js-code"; }
  else if (["href", "src", "action", "formaction", "data", "srcset"].includes(a)) c = /^\s*$/.test(etat.tampon) ? "url-debut" : "url-suite";
  else if (a === "style") c = "style";
  return { c, attr: a };
}
const estLit = (n) => (n.type === "Literal" && typeof n.value === "string");
function aplatir(n, out) { if (n.type === "BinaryExpression" && n.operator === "+") { aplatir(n.left, out); aplatir(n.right, out); } else out.push(n); return out; }

const sorties = [], vus = new Set();
const parOp = []; let FORT = true;
function noter(op, ctx, r, enveloppe) {
  parOp.push({ f: op._f.f, l: op.loc.start.line + op._f.decal, a: op.start + op._f.base, b: op.end + op._f.base, ctx: ctx.c, attr: ctx.attr || "", type: op.type, pur: r.pur !== false, fort: ctx.c === "innerHTML=" || ctx.c === "insertAdjacentHTML" ? true : FORT, x: src(op).slice(0, 140),
    fe: r.f.map((y) => ({ x: src(y.n).slice(0, 80), s: y.sorte, n: y.note, f: (y.n._f || op._f).f, l: y.n.loc.start.line + (y.n._f || op._f).decal })) });
  r.f.forEach((y) => {
    const n = y.n, F = n._f || op._f;
    const cle = F.f + ":" + n.start + ":" + ctx.c + ":" + op.start;
    if (vus.has(cle)) return; vus.add(cle);
    sorties.push({ f: F.f, l: n.loc.start.line + F.decal, ctx: ctx.c, attr: ctx.attr || "", sorte: y.sorte, note: y.note, x: src(n).slice(0, 110), op: op._f.f + ":" + (op.loc.start.line + op._f.decal), opx: src(op).slice(0, 90), enveloppe: enveloppe || "" });
  });
}
function pasHtml(n) {
  const p = n.parent; if (!p) return false;
  if (p.type === "MemberExpression" && p.computed && p.property === n) return true;
  if (p.type === "CallExpression" && p.arguments.includes(n) && p.callee.type === "MemberExpression" && !p.callee.computed && /^(querySelector|querySelectorAll|closest|matches|getElementById|setAttribute|getAttribute|indexOf|includes|startsWith|endsWith|test|split|replace|open|setItem|getItem|removeItem|log|warn|error)$/.test(p.callee.property.name)) return true;
  return false;
}
function analyserOps(ops, racine) {
  if (racine && pasHtml(racine)) return;
  if (!ops.some((o) => estLit(o) && /[<>]|=\s*["']/.test(o.value))) return;
  const etat = { m: "texte", attr: "", q: "", tampon: "" };
  const tout = ops.filter(estLit).map((o) => o.value).join(" ");
  FORT = /(style|class|id|type|value|href|src|onclick|data-[a-z-]+)\s*=|<\/?(div|span|option|td|tr|th|table|input|button|label|textarea|img|a|h[1-6]|p|ul|li|select|svg|small|section|header|i|em)[\s>]/.test(tout);
  for (const o of ops) {
    if (estLit(o)) { avancer(etat, o.value); continue; }
    const ctx = contexte(etat);
    const r = classer(o);
    if (r.cl === "brut") noter(o, ctx, r);
    else if (r.cl === "esc" || r.cl === "html") { if (ctx.c === "js-chaine" || ctx.c === "attr-sq" || ctx.c === "attr-nu" || ctx.c === "url-debut" || ctx.c === "js-code") sorties.push({ f: o._f.f, l: o.loc.start.line + o._f.decal, ctx: ctx.c, attr: ctx.attr || "", sorte: "ctx-" + r.cl, note: "", x: src(o).slice(0, 110), op: "", opx: "" }); }
    if ((r.cl === "esc" || r.cl === "html") && (ctx.c === "js-chaine" || ctx.c === "js-code" || ctx.c.startsWith("url") || ctx.c === "attr-sq" || ctx.c === "attr-nu")) parOp.push({ f: o._f.f, l: o.loc.start.line + o._f.decal, a: o.start + o._f.base, b: o.end + o._f.base, ctx: ctx.c, attr: ctx.attr || "", pur: false, deja: r.cl, type: o.type, x: src(o).slice(0, 140), fe: [] });
    if (etat.m !== "texte") etat.tampon += "X";
  }
}
fichiers.forEach((F) => {
  (function marche(n) {
    if (n.type === "BinaryExpression" && n.operator === "+" && !(n.parent && n.parent.type === "BinaryExpression" && n.parent.operator === "+")) analyserOps(aplatir(n, []), n);
    if (n.type === "TemplateLiteral" && n.expressions.length) {
      const ops = []; n.quasis.forEach((q, i) => { ops.push({ type: "Literal", value: q.value.cooked || "", loc: q.loc, start: q.start, end: q.end, _f: F }); if (n.expressions[i]) ops.push(n.expressions[i]); });
      analyserOps(ops, n);
    }
    const puits = (r, quoi) => { if (!r || estLit(r) || (r.type === "BinaryExpression" && r.operator === "+") || r.type === "TemplateLiteral") return; const c = classer(r); if (c.cl === "brut") noter(r, { c: quoi }, c); };
    if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression" && !n.left.computed && /^(innerHTML|outerHTML)$/.test(n.left.property.name)) puits(n.right, "innerHTML=");
    if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && !n.callee.computed && n.callee.property.name === "insertAdjacentHTML") puits(n.arguments[1], "insertAdjacentHTML");
    if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && !n.callee.computed && (n.callee.property.name === "write" || n.callee.property.name === "writeln") && /document$/.test(src(n.callee.object))) puits(n.arguments[0], "document.write");
    enfants(n, marche);
  })(F.ast);
});
// ── Rapport ──
// On ne garde pas : les tables de constantes du code (NOMS_EN_MAJUSCULES), les compteurs et scores, les icônes.
const NUM = /\.(pts|j|g|p|diff|rang|pct|fc|min|total|eval|reb|pd|num|n|present|done|dur|t|s|sa|sb|nous|eux|asmb|adv|bp|tirs|p3|lf|nbJ|nbQ|dureeQ|max|matchCount|totalCount|personnes|pm|int|ct|efg|ratio|v|trouve|aCreer|deja|echecs|equipes|comptes|parents|seances|nb|mj|lat|lng|points|joues|victoires|defaites|pointsMarques|pointsEncaisses|qty|places|reste|mins|montant|prix|valid|pending|jours|length|w|h|x|y|size|count|score)$/;
const ICO = /\.(icon|ic|svg|emoji|html|innerHTML|outerHTML)$/;
function constante(fe) {
  const racine = (fe.x.match(/^[A-Za-z_$][\w$]*/) || [""])[0];
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(racine)) return true;
  if (/^(elem|cle|champ:elem|champ:cle):\s*([A-Z][A-Z0-9_]{2,})\b/.test(fe.n || "")) return true;
  return fe.s === "champ" && (NUM.test(fe.x) || ICO.test(fe.x));
}
const TOUT = process.argv.includes("--tout");
const garde = parOp.filter((x) => !x.deja && x.fe.length && !x.fe.every(constante) && (TOUT || x.pur));
let cur = "";
garde.sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : a.l - b.l)).forEach((x) => {
  if (x.f !== cur) { cur = x.f; console.log("\n## " + cur); }
  const fe = x.fe[0];
  console.log("  " + x.l + " [" + x.ctx + (x.pur ? "" : ", fragment HTML") + "] " + x.x.slice(0, 70) + (fe.x !== x.x.slice(0, 80) ? "  ← " + fe.x.slice(0, 40) + " (ligne " + fe.l + ")" : "") + (fe.n ? "  · " + fe.n.slice(0, 40) : ""));
});
console.log("\n" + garde.length + " valeur(s) à regarder" + (TOUT ? "" : " (--tout : aussi celles prises dans un fragment HTML déjà construit)") + ".");
console.log("Contextes : texte / attr-dq / innerHTML= → authEsc() ; js-chaine → gmJs() ; url-debut → authEsc(gmUrl()) ; js-code, balise → à lire.");

