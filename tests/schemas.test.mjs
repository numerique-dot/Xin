import test from "node:test";
import assert from "node:assert/strict";
import {
  ClassificationResponse,
  ExtractionResponse,
  RequestBody,
  TASKS,
  VariableTextResponse,
} from "../src/schemas.mjs";

test("rejects unknown client fields such as model or systemInstruction", () => {
  const result = RequestBody.safeParse({
    task: TASKS.CLASSIFICATION,
    text: "suivi dossier",
    model: "attacker-model",
  });
  assert.equal(result.success, false);
});

test("accepts structured extraction with alert objects", () => {
  const result = ExtractionResponse.safeParse({
    nom: "PANG",
    prenom: "Caihua",
    naissance: "1974-06-21",
    nationalite: "Chinoise",
    adresse: "94 RUE DE LA REUNION",
    cp: "75020",
    ville: "PARIS",
    numEtranger: "7503925489",
    numTitre: null,
    depot: "2024-08-14",
    prefecture: "Prefecture de police",
    source: "justificatif de depot",
    confiance: "haute",
    alertes: [],
  });
  assert.equal(result.success, true);
});

test("classification schema is strict", () => {
  const result = ClassificationResponse.safeParse({
    codes: ["INFO", "ADRESSE"],
    motif: "Suivi avec changement d'adresse",
    confiance: "haute",
  });
  assert.equal(result.success, true);
});

test("variable text requires explicit register", () => {
  assert.equal(VariableTextResponse.safeParse({ texte: "Bonjour" }).success, false);
});
