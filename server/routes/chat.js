const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are EcoBot, an expert AI recycling assistant for the SmartWaste platform in Mumbai, India. Your role is to:

1. Help users understand how to recycle different types of waste
2. When shown an image, identify the item and provide specific recycling instructions
3. Explain the environmental impact of proper recycling
4. Suggest nearby e-waste centers or recycling facilities in Mumbai
5. Provide step-by-step guides for proper waste disposal
6. Educate users about reducing, reusing, and recycling

Guidelines:
- Be friendly, encouraging, and concise
- Use bullet points and numbered steps for clarity
- Always mention safety precautions when dealing with hazardous waste
- If unsure about an item, ask clarifying questions
- Suggest alternatives to disposal when possible (upcycling, donation, etc.)
- Keep responses focused and under 300 words unless detailed instructions are needed`;

// POST /api/chat — Send message to Gemini AI
router.post('/chat', async (req, res) => {
  try {
    const { message, imageBase64 } = req.body;

    if (!message && !imageBase64) {
      return res.status(400).json({ error: 'Message or image is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

    // Build content parts
    const parts = [];

    // Add system context as part of the user message
    parts.push({ text: SYSTEM_PROMPT + '\n\nUser: ' + (message || 'What is this item and how should I recycle it?') });

    // Add image if provided
    if (imageBase64) {
      // Extract mime type and data from base64 string
      const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text });
  } catch (error) {
    console.error('Chat API error:', error.message);
    res.status(500).json({ error: 'Failed to generate AI response', details: error.message });
  }
});

module.exports = router;
