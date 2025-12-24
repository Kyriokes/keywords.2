export interface ParsedCv {
  text: string;
  keywords: string[];
}

export const parseCv = async (file: File): Promise<ParsedCv> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/parse-cv', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({} as any));
    const base = errorData.error || 'Error al procesar el archivo en el servidor';
    const details = errorData.details ? `: ${errorData.details}` : '';
    throw new Error(`${base}${details}`);
  }

  return await response.json();
};
