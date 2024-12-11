import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  timeout: 60000, // 60 second timeout
  maxRetries: 3
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Set server timeout to 2 minutes
    res.setTimeout(120000, () => {
      res.status(504).json({ error: 'Request timeout' });
    });

    const completion = await openai.chat.completions.create({
      model: "nvidia/llama-3.1-nemotron-70b-instruct",
      messages: [{ "role": "user", "content": message }],
      temperature: 0.7,
      top_p: 1,
      max_tokens: 512, // Reduced for faster response
      stream: false
    });

    if (!completion.choices || !completion.choices[0]?.message?.content) {
      throw new Error('Invalid response from AI model');
    }

    res.status(200).json({ response: completion.choices[0].message.content });
  } catch (error) {
    console.error('Error:', error);
    
    // Check if it's a timeout error
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      return res.status(504).json({ error: 'Request timed out while waiting for the AI model' });
    }
    
    // Check if it's an API key error
    if (error.status === 401) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    res.status(500).json({ 
      error: 'An error occurred while processing your request',
      message: error.message
    });
  }
}
