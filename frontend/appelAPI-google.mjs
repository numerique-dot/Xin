import { getAuth } from "firebase/auth";
import { getAppCheck, getToken as getAppCheckToken } from "firebase/app-check";

/**
 * Drop-in Google backend caller for the existing generator.
 * The browser never sees a Gemini/Vertex API credential.
 *
 * @param {object} body - One of the server request shapes:
 *   {task:"EXTRACTION", text?, files?}
 *   {task:"CLASSIFICATION", text}
 *   {task:"VARIABLE_TEXT", fragmentType, text, uiLanguage?}
 * @param {object} options
 * @param {string} options.endpoint - Same-origin by default.
 */
export async function appelAPI(body, { endpoint = "/api/relance/ai" } = {}) {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Utilisateur non connecte");

  const [idToken, appCheckResult] = await Promise.all([
    user.getIdToken(),
    getAppCheckToken(getAppCheck(), false),
  ]);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
      "X-Firebase-AppCheck": appCheckResult.token,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error?.message || "Erreur du service AI");
    error.code = payload?.error?.code || `HTTP_${response.status}`;
    error.requestId = payload?.requestId || response.headers.get("x-request-id");
    throw error;
  }
  return payload.data;
}

export async function fileToInlineInput(file) {
  const dataBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Lecture fichier impossible"));
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",", 2)[1] : value);
    };
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType: file.type, dataBase64 };
}
