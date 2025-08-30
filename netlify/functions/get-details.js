// Netlify Function: get-details.js
// 最终调试版：增加了详细的日志记录功能

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { foodName, nutrientsToFetch } = JSON.parse(event.body);
    if (!foodName || !nutrientsToFetch || !Array.isArray(nutrientsToFetch)) {
      return { statusCode: 400, body: 'Invalid request body' };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("CRITICAL: GEMINI_API_KEY environment variable not set.");
        throw new Error("API key is not configured.");
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const prompt = `For the food "${foodName}", find values for the following nutrients: ${nutrientsToFetch.join(', ')}.
    Your response MUST be a valid JSON object.
    The keys in the JSON MUST be the exact nutrient names from the list.
    If you cannot find a value for a specific nutrient, the value for that key MUST be the string "网络查询中暂无".
    Do not include any text or explanations outside of the JSON object.`;
            
    const schemaProperties = {};
    nutrientsToFetch.forEach(name => {
        schemaProperties[name] = { "type": "STRING" };
    });

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ "google_search": {} }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: schemaProperties,
            }
        }
    };

    // --- DEBUG LOGGING START ---
    console.log(`[INFO] Sending request for food: "${foodName}"`);
    console.log("[INFO] Payload sent to Gemini:", JSON.stringify(payload, null, 2));
    // --- DEBUG LOGGING END ---

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const responseBody = await response.text();
    
    // --- DEBUG LOGGING START ---
    console.log(`[INFO] Received raw response from Gemini (Status: ${response.status}):`, responseBody);
    // --- DEBUG LOGGING END ---

    if (!response.ok) {
      throw new Error(`Gemini API responded with status ${response.status}. See function logs for details.`);
    }

    const result = JSON.parse(responseBody);
    const detailsText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!detailsText) {
      console.error("[ERROR] Invalid response format from Gemini: No text part found in candidates.");
      throw new Error("Invalid response format from Gemini API.");
    }
    
    if (detailsText.trim() === '{}') {
        console.warn("[WARN] Gemini returned an empty JSON object, indicating no data was found.");
    }
    
    return {
      statusCode: 200,
      body: detailsText,
    };

  } catch (error) {
    console.error('[CRITICAL] Error in get-details function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

