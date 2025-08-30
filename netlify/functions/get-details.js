// Netlify Function: get-details.js
// 这个函数是您查询补充数据的“中间人”

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
        throw new Error("API key is not configured.");
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const prompt = `For the food "${foodName}", find the following values: ${nutrientsToFetch.join(', ')}. Respond with a JSON object. The keys must be exactly: ${nutrientsToFetch.map(n => `"${n}"`).join(', ')}. If a value is not found, use the string "网络查询中暂无".`;

    const schemaProperties = {};
    nutrientsToFetch.forEach(name => {
        schemaProperties[name] = { "type": "STRING" };
    });

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ "google_search": {} }], // 启用联网搜索
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: schemaProperties,
                required: nutrientsToFetch
            }
        }
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Gemini API Error:", errorBody);
      throw new Error(`Gemini API responded with status ${response.status}`);
    }

    const result = await response.json();
    const detailsText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!detailsText) {
      throw new Error("Invalid details response format from Gemini API.");
    }

    return {
      statusCode: 200,
      body: detailsText, // Directly forward the JSON string
    };

  } catch (error) {
    console.error('Error in get-details function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: message }),
    };
  }
};