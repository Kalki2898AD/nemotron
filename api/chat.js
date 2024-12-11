import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  timeout: 20000, // 20 second timeout
  maxRetries: 2
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false,
        error: 'Message is required' 
      });
    }

    // Set up timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 15000);
    });

    try {
      // Race between the API call and timeout
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
          messages: [{ "role": "user", "content": message }],
          max_tokens: 1000,
          temperature: 0.7,
        }),
        timeoutPromise
      ]);

      return res.status(200).json({
        success: true,
        response: completion.choices[0].message.content
      });
    } catch (error) {
      if (error.message === 'Request timeout') {
        return res.status(504).json({
          success: false,
          error: 'Request timed out. Please try again with a shorter message.'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('API Error:', error);
    
    // Handle specific error types
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: 'Connection timeout. The server is busy.'
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
