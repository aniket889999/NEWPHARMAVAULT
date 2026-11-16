import apiClient from '../api/apiClient';

export const generateHealthResponse = async (query: string): Promise<string> => {
  try {
    const { data } = await apiClient.post('/v1/chat', {
      message: query,
      history: []
    });
    return data.reply;
  } catch (error) {
    // Error logged neutrally to avoid leaking full Axios error object
    console.error('[AI] Health response generation failed');
    return generateBasicHealthResponse(query);
  }
};

// Legacy function kept for backward compatibility
export const generateBasicHealthResponse = (_query: string): string => {
  void _query; // Preserve the legacy call signature without using health text.
  return "The verified health-assistance service is temporarily unavailable. Please try again. For urgent or severe symptoms, contact a qualified healthcare professional or emergency service.";
};
