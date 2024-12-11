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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
          max_tokens: 4096,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse NVIDIA API response:', responseText);
        return res.status(500).json({
          success: false,
          error: 'Invalid response from AI model',
          details: 'The AI model returned an invalid response format'
        });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: 'Error from AI model',
          details: responseData.error || 'Unknown error occurred'
        });
      }

      if (!responseData.choices || !responseData.choices[0]?.message?.content) {
        return res.status(500).json({
          success: false,
          error: 'Invalid response format',
          details: 'The AI model response was missing required fields'
        });
      }

      return res.status(200).json({
        success: true,
        response: responseData.choices[0].message.content
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return res.status(504).json({
          success: false,
          error: 'Request timeout',
          details: 'The AI model took too long to respond. Please try again with a shorter message.'
        });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error details:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      details: error.message || 'An unexpected error occurred'
    });
  }
}
