const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const upload = require('../middleware/upload');
const OpenAI = require('openai');
const { z } = require('zod');
const Receipt = require('../models/Receipt');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ── Zod Schema ───────────────────────────────────────────────── */
const lineItemSchema = z.object({
  description: z.string().min(1),
  price: z.number().nonnegative()
});

const receiptSchema = z.object({
  merchant: z.string().min(1, 'Merchant required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  total: z.number().positive('Total must be positive'),
  currency: z.string().length(3).default('USD'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item required'),
  category: z.string().optional()
});

/* ── POST /api/ai/scan-receipt ───────────────────────────────── */
router.post('/scan-receipt', upload.single('receipt'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No image uploaded' });

  const localPath = file.path;
  const imageUrl = `/uploads/${file.filename}`;

  try {
    // 1. Exactly one Vision LLM call
    const base64 = fs.readFileSync(localPath).toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract receipt data and return ONLY valid JSON with these exact fields:
{
  "merchant": "string (store/restaurant name)",
  "date": "YYYY-MM-DD",
  "total": number,
  "currency": "3-letter ISO code e.g. USD",
  "lineItems": [{"description": "string", "price": number}],
  "category": "one of: food, groceries, transport, shopping, entertainment, bills, health, travel, housing, other"
}
No markdown, no explanation. JSON only.`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: 'high'
            }
          }
        ]
      }],
      response_format: { type: 'json_object' }
    });

    // 2. Parse raw JSON
    let rawJson;
    try {
      rawJson = JSON.parse(response.choices[0].message.content);
    } catch {
      throw new Error('LLM returned invalid JSON');
    }

    // 3. Zod validation — strict (no .catch fallbacks here)
    const parseResult = receiptSchema.safeParse(rawJson);

    if (!parseResult.success) {
      // Validation failed → save failed receipt log, return image for manual entry
      await Receipt.create({
        imageUrl,
        extractedData: rawJson,
        validationPassed: false,
        isConfirmed: false
      });

      return res.status(422).json({
        error: 'Receipt validation failed. Please complete manually.',
        validationErrors: parseResult.error.flatten().fieldErrors,
        fallbackImageUrl: imageUrl,
        rawExtracted: rawJson,
        openManualEntry: true
      });
    }

    // 4. Save confirmed receipt log
    const receiptLog = await Receipt.create({
      imageUrl,
      extractedData: parseResult.data,
      validationPassed: true,
      isConfirmed: false
    });

    return res.status(200).json({
      receiptId: receiptLog._id,
      imageUrl,
      data: parseResult.data
    });

  } catch (err) {
    console.error('AI Scan Error:', err.message);
    return res.status(422).json({
      error: 'Failed to process receipt. Please enter manually.',
      fallbackImageUrl: imageUrl,
      openManualEntry: true
    });
  }
});

module.exports = router;
