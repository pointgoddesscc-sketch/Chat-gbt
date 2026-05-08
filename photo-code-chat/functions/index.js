const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

exports.convertPhotoToCode = onCall(
  { secrets: [OPENAI_API_KEY], cors: true, maxInstances: 10 },
  async (request) => {
    const auth = request.auth;

    if (!auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    if (auth.token.email_verified !== true) {
      throw new HttpsError("permission-denied", "Verified email required.");
    }

    const { imageBase64, mimeType } = request.data || {};

    if (!imageBase64 || !mimeType || !mimeType.startsWith("image/")) {
      throw new HttpsError("invalid-argument", "Valid image required.");
    }

    const imageBytes = Buffer.byteLength(imageBase64, "base64");
    if (imageBytes > MAX_IMAGE_BYTES) {
      throw new HttpsError("invalid-argument", "Image must be smaller than 5 MB.");
    }

    const client = new OpenAI({
      apiKey: OPENAI_API_KEY.value()
    });

    const response = await client.responses.create({
      model: "gpt-5.2",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Convert this UI screenshot or photo into clean, responsive HTML, CSS, and JavaScript. Return one complete HTML file only."
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${imageBase64}`
            }
          ]
        }
      ]
    });

    return {
      code: response.output_text || "No code returned."
    };
  }
);
