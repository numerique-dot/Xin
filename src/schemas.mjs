import { z } from "zod";

export const TASKS = Object.freeze({
  EXTRACTION: "EXTRACTION",
  CLASSIFICATION: "CLASSIFICATION",
  VARIABLE_TEXT: "VARIABLE_TEXT",
});

export const FRAGMENT_TYPES = Object.freeze({
  CONTEXTE_FACTUEL: "CONTEXTE_FACTUEL",
  DESCRIPTION_PIECE: "DESCRIPTION_PIECE",
  RESUME_UTILISATEUR: "RESUME_UTILISATEUR",
});

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ALERT_TYPES = ["contradiction", "illisible", "ambigue", "autre"];

export const SCHEMA_EXTRACTION = {
  type: "object",
  additionalProperties: false,
  properties: {
    nom: { anyOf: [{ type: "string" }, { type: "null" }] },
    prenom: { anyOf: [{ type: "string" }, { type: "null" }] },
    naissance: { anyOf: [{ type: "string" }, { type: "null" }], description: "AAAA-MM-JJ" },
    nationalite: { anyOf: [{ type: "string" }, { type: "null" }] },
    adresse: { anyOf: [{ type: "string" }, { type: "null" }], description: "numero et rue seulement" },
    cp: { anyOf: [{ type: "string" }, { type: "null" }] },
    ville: { anyOf: [{ type: "string" }, { type: "null" }] },
    numEtranger: { anyOf: [{ type: "string" }, { type: "null" }], description: "AGDREF, exactement 10 chiffres" },
    numTitre: { anyOf: [{ type: "string" }, { type: "null" }], description: "exactement 11 chiffres" },
    depot: { anyOf: [{ type: "string" }, { type: "null" }], description: "date de depot de la demande, AAAA-MM-JJ" },
    prefecture: { anyOf: [{ type: "string" }, { type: "null" }], description: "texte lu sur le document; ne sert jamais au routage" },
    source: { anyOf: [{ type: "string" }, { type: "null" }], description: "type de document reconnu" },
    confiance: { type: "string", enum: ["haute", "basse"] },
    alertes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ALERT_TYPES },
          champ: { anyOf: [{ type: "string" }, { type: "null" }] },
          valeurs: { type: "array", items: { type: "string" } },
          documents: { type: "array", items: { type: "string" } },
          detail: { type: "string" }
        },
        required: ["type", "champ", "valeurs", "documents", "detail"]
      }
    }
  },
  required: [
    "nom", "prenom", "naissance", "nationalite", "adresse", "cp", "ville",
    "numEtranger", "numTitre", "depot", "prefecture", "source", "confiance", "alertes"
  ],
  propertyOrdering: [
    "nom", "prenom", "naissance", "nationalite", "adresse", "cp", "ville",
    "numEtranger", "numTitre", "depot", "prefecture", "source", "confiance", "alertes"
  ]
};

export const CLASSIFICATION_CODES = [
  "INFO", "RELANCE", "URGENT", "DEMEURE", "ADRESSE", "PIECES", "REPONSE",
  "RDV", "RENOUV", "AES", "ANEF", "DS", "AUTRE"
];

export const SCHEMA_CLASSIFICATION = {
  type: "object",
  additionalProperties: false,
  properties: {
    codes: {
      type: "array",
      minItems: 1,
      items: { type: "string", enum: CLASSIFICATION_CODES }
    },
    motif: { type: "string", description: "une phrase courte en francais" },
    confiance: { type: "string", enum: ["haute", "basse"] }
  },
  required: ["codes", "motif", "confiance"]
};

export const SCHEMA_VARIABLE_TEXT = {
  type: "object",
  additionalProperties: false,
  properties: {
    texte: { type: "string" },
    registre: { type: "string", enum: ["document_fr", "interface_fr", "interface_zh"] }
  },
  required: ["texte", "registre"]
};

export const ExtractionResponse = z.object({
  nom: z.string().nullable(),
  prenom: z.string().nullable(),
  naissance: z.string().nullable(),
  nationalite: z.string().nullable(),
  adresse: z.string().nullable(),
  cp: z.string().nullable(),
  ville: z.string().nullable(),
  numEtranger: z.string().nullable(),
  numTitre: z.string().nullable(),
  depot: z.string().nullable(),
  prefecture: z.string().nullable(),
  source: z.string().nullable(),
  confiance: z.enum(["haute", "basse"]),
  alertes: z.array(z.object({
    type: z.enum(ALERT_TYPES),
    champ: z.string().nullable(),
    valeurs: z.array(z.string()),
    documents: z.array(z.string()),
    detail: z.string(),
  }).strict()),
}).strict();

export const ClassificationResponse = z.object({
  codes: z.array(z.enum(CLASSIFICATION_CODES)).min(1),
  motif: z.string(),
  confiance: z.enum(["haute", "basse"]),
}).strict();

export const VariableTextResponse = z.object({
  texte: z.string(),
  registre: z.enum(["document_fr", "interface_fr", "interface_zh"]),
}).strict();

const InlineFile = z.object({
  mimeType: z.string(),
  dataBase64: z.string().min(1),
  name: z.string().max(200).optional(),
}).strict();

const GcsFile = z.object({
  mimeType: z.string(),
  gsUri: z.string().regex(/^gs:\/\/[a-z0-9._-]+\/.+/i),
  name: z.string().max(200).optional(),
}).strict();

export const FileInput = z.union([InlineFile, GcsFile]);

export const RequestBody = z.discriminatedUnion("task", [
  z.object({
    task: z.literal(TASKS.EXTRACTION),
    text: z.string().max(12000).optional(),
    files: z.array(FileInput).max(5).optional(),
  }).strict(),
  z.object({
    task: z.literal(TASKS.CLASSIFICATION),
    text: z.string().min(1).max(30000),
  }).strict(),
  z.object({
    task: z.literal(TASKS.VARIABLE_TEXT),
    fragmentType: z.enum([
      FRAGMENT_TYPES.CONTEXTE_FACTUEL,
      FRAGMENT_TYPES.DESCRIPTION_PIECE,
      FRAGMENT_TYPES.RESUME_UTILISATEUR,
    ]),
    text: z.string().min(1).max(30000),
    uiLanguage: z.enum(["fr", "zh"]).optional(),
  }).strict(),
]);

export function schemaForTask(task) {
  switch (task) {
    case TASKS.EXTRACTION: return SCHEMA_EXTRACTION;
    case TASKS.CLASSIFICATION: return SCHEMA_CLASSIFICATION;
    case TASKS.VARIABLE_TEXT: return SCHEMA_VARIABLE_TEXT;
    default: throw new Error(`Tache inconnue: ${task}`);
  }
}

export function responseValidatorForTask(task) {
  switch (task) {
    case TASKS.EXTRACTION: return ExtractionResponse;
    case TASKS.CLASSIFICATION: return ClassificationResponse;
    case TASKS.VARIABLE_TEXT: return VariableTextResponse;
    default: throw new Error(`Tache inconnue: ${task}`);
  }
}
