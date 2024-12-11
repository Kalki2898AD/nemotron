import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  defaultHeaders: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  defaultQuery: {
    'api-version': '2023-12-01-preview'
  },
  timeout: 50000 // 50 second timeout
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Create a promise that rejects after 45 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 45000);
    });

    try {
      // Race between the API call and timeout
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
          messages: [{ "role": "user", "content": message }],
          temperature: 0.7,
          max_tokens: 2048,
          stream: false
        }),
        timeoutPromise
      ]);

      res.status(200).json({ response: completion.choices[0].message.content });
    } catch (error) {
      if (error.message === 'Request timeout') {
        return res.status(504).json({ error: 'The request took too long to process. Please try again with a shorter message.' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error:', error);
    
    const statusCode = error.status || 500;
    const errorMessage = error.message || 'An unexpected error occurred';
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
