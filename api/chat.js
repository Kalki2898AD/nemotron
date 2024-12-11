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

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
          messages: [{ "role": "user", "content": message }],
          temperature: 0.7,
          top_p: 1,
          max_tokens: 4096,  // Increased from 512 to 4096 for longer responses
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('NVIDIA API Error:', errorText);
        return res.status(response.status).json({ 
          error: 'Error from AI model',
          details: errorText
        });
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0]?.message?.content) {
        throw new Error('Invalid response from AI model');
      }

      res.status(200).json({ response: data.choices[0].message.content });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return res.status(504).json({ 
          error: 'Request timeout',
          details: 'The AI model took too long to respond. Please try again with a shorter message.'
        });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error details:', error);
    
    res.status(500).json({ 
      error: 'Server error',
      details: error.message || 'An unexpected error occurred'
    });
  }
}
