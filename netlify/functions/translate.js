// Netlify Function: translate.js
// 这个函数是您的“翻译中间人”

exports.handler = async function(event, context) {
  // 1. 只接受POST请求
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 2. 从前端获取需要翻译的中文
    const { chineseName } = JSON.parse(event.body);
    if (!chineseName) {
      return { statusCode: 400, body: 'Missing chineseName' };
    }

    // 3. 安全地从Netlify后台获取您的API密钥
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("API key is not configured.");
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    // 4. 准备发送给Gemini API的数据
    const prompt = `Translate the food name into English, return only the English name, no other text: ${chineseName}`;
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };

    // 5. 调用真正的Gemini API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini API Error:", errorBody);
        throw new Error(`Gemini API responded with status ${response.status}`);
    }

    const result = await response.json();
    const translatedText = result.candidates?.[0]?.content?.parts?.[0]?.text.trim();

    if (!translatedText) {
      throw new Error("Invalid translation response format from Gemini API.");
    }

    // 6. 将翻译结果返回给您的前端网页
    return {
      statusCode: 200,
      body: JSON.stringify({ englishName: translatedText }),
    };

  } catch (error) {
    console.error('Error in translate function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};