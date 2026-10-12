export interface ParsedCv {
  text: string;
  keywords: string[];
  keywordCounts?: Record<string, number>;
}

export const parseCv = async (file: File): Promise<ParsedCv> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/parse-cv', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al procesar el archivo en el servidor');
  }

  return await response.json();
};
