// Netlify Function: get-details.js
// 最终修正版：解决了API冲突，并优化了错误处理

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

    // 新的、更灵活的指令
    const prompt = `For the food "${foodName}", find values for the following nutrients: ${nutrientsToFetch.join(', ')}.
    Your response MUST be ONLY a single, valid JSON object string.
    The keys in the JSON MUST be the exact nutrient names from the list.
    If you cannot find a value for a specific nutrient, the value for that key MUST be the string "网络查询中暂无".
    Do not include any text, explanations, or markdown formatting like \`\`\`json outside of the JSON object.`;
            
    // 移除了冲突的 generationConfig
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ "google_search": {} }], 
    };

    console.log(`[INFO] Sending NEW request for food: "${foodName}"`);
    console.log("[INFO] NEW Payload sent to Gemini:", JSON.stringify(payload, null, 2));

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const responseBody = await response.text();
    console.log(`[INFO] Received raw response from Gemini (Status: ${response.status}):`, responseBody);

    if (!response.ok) {
      throw new Error(`Gemini API responded with status ${response.status}. See function logs for details.`);
    }

    const result = JSON.parse(responseBody);
    let detailsText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!detailsText) {
      console.error("[ERROR] Invalid response format from Gemini: No text part found in candidates.");
      throw new Error("Invalid response format from Gemini API.");
    }
    
    // 增强的容错处理：尝试从返回的文本中提取出JSON
    try {
        const jsonMatch = detailsText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            detailsText = jsonMatch[0];
            // 验证一下是否是有效的JSON
            JSON.parse(detailsText); 
        } else {
            throw new Error("No JSON object found in the response text.");
        }
    } catch (e) {
        console.error("[ERROR] Failed to parse JSON from Gemini's response text.", e);
        // 如果解析失败，返回一个包含所有请求项的失败对象
        const failureResult = {};
        nutrientsToFetch.forEach(name => {
            failureResult[name] = "查询失败";
        });
        detailsText = JSON.stringify(failureResult);
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

