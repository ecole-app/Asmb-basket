// Salle de formation : formations/{code} (+ liens, stagiaires, journal).
import { test, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, increment } from "firebase/firestore";
import { getEnv } from "./helpers.js";

let env;
const anon = () => env.unauthenticatedContext().firestore();
const as = (uid) => env.authenticatedContext(uid).firestore();
const sess = { title: "Formation arbitres", owner: "form1", active: true, paused: false, createdAt: 1 };
const stag = { name: "Ali BEN", status: "in", exits: 0, outTotal: 0, outSince: null, link: null, lastSeen: 1, joinedAt: 1 };

before(async () => { env = await getEnv(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "formations/ABC123"), sess);
    await setDoc(doc(db, "formations/FINI00"), { ...sess, active: false });
    await setDoc(doc(db, "formations/ABC123/stagiaires/s1"), stag);
    await setDoc(doc(db, "formations/FINI00/stagiaires/s1"), stag);
  });
});
after(async () => { await env.cleanup(); });

test("formation : un formateur connecté crée sa session, pas un anonyme", async () => {
  await assertSucceeds(setDoc(doc(as("form1"), "formations/XYZ789"), sess));
  await assertFails(setDoc(doc(anon(), "formations/XYZ788"), sess));
  await assertFails(setDoc(doc(as("form2"), "formations/XYZ787"), sess)); // owner ≠ uid
  await assertFails(setDoc(doc(as("form1"), "formations/abc"), sess));    // code invalide
});

test("formation : seul le propriétaire met en pause / termine", async () => {
  await assertSucceeds(updateDoc(doc(as("form1"), "formations/ABC123"), { paused: true }));
  await assertFails(updateDoc(doc(as("form2"), "formations/ABC123"), { paused: true }));
  await assertFails(updateDoc(doc(anon(), "formations/ABC123"), { active: false }));
  await assertFails(updateDoc(doc(as("form1"), "formations/ABC123"), { owner: "form2" }));
});

test("formation : liens écrits par le propriétaire seulement, lus par tous", async () => {
  const l = { title: "Kahoot", url: "https://kahoot.it/x", at: 1 };
  await assertSucceeds(addDoc(collection(as("form1"), "formations/ABC123/liens"), l));
  await assertFails(addDoc(collection(anon(), "formations/ABC123/liens"), l));
  await assertFails(addDoc(collection(as("form1"), "formations/ABC123/liens"), { ...l, url: "javascript:alert(1)" }));
  await assertSucceeds(getDoc(doc(anon(), "formations/ABC123")));
});

test("formation : un stagiaire sans compte rejoint une session active", async () => {
  await assertSucceeds(addDoc(collection(anon(), "formations/ABC123/stagiaires"), stag));
  await assertFails(addDoc(collection(anon(), "formations/FINI00/stagiaires"), stag));
  await assertFails(addDoc(collection(anon(), "formations/ABC123/stagiaires"), { ...stag, exits: 5 }));
  await assertFails(addDoc(collection(anon(), "formations/ABC123/stagiaires"), { ...stag, admin: true }));
});

test("formation : les compteurs ne font que monter, le nom est figé", async () => {
  const s1 = doc(anon(), "formations/ABC123/stagiaires/s1");
  await assertSucceeds(updateDoc(s1, { status: "out", outSince: 5, exits: increment(1) }));
  await assertSucceeds(updateDoc(s1, { status: "in", outSince: null, outTotal: increment(4200) }));
  await assertFails(updateDoc(s1, { exits: 0 }));
  await assertFails(updateDoc(s1, { name: "Autre NOM" }));
  await assertFails(updateDoc(doc(anon(), "formations/FINI00/stagiaires/s1"), { status: "out" }));
  await assertFails(deleteDoc(s1));
  await assertSucceeds(deleteDoc(doc(as("form1"), "formations/ABC123/stagiaires/s1")));
});

test("formation : journal en ajout seul", async () => {
  const e = { sid: "s1", name: "Ali BEN", type: "out", detail: null, ts: 1 };
  await assertSucceeds(addDoc(collection(anon(), "formations/ABC123/journal"), e));
  await assertFails(addDoc(collection(anon(), "formations/ABC123/journal"), { ...e, type: "hack" }));
  await assertFails(addDoc(collection(anon(), "formations/FINI00/journal"), e));
});
