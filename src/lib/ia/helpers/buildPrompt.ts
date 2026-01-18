export function buildPromptManual(combinedText: string) {
    return `A partir de ahora tu respuesta debe contener ÚNICAMENTE un JSON válido.
No expliques nada. No agregues texto. No agregues comentarios.  
Si agregás algo fuera del JSON, tu respuesta será inválida.

RESPONDE EXACTAMENTE EN ESTE FORMATO (no agregar ni quitar nada):
{
  "palabrasClave": [
    { "nombre": "String", "cantidad": Number }
  ]
}

REGLAS:
- Procesá SOLO el texto entre ###TEXTO###.
- SOLO extrae palabras clave laborales relevantes para filtros ATS (Applicant Tracking Systems).
- Definición de palabra clave: competencias técnicas, herramientas, metodologías, normativas, certificaciones, cargos específicos o terminología técnica propia de la industria o sector del aviso.
- EXCLUIR: conectores, preposiciones y palabras genéricas sin valor técnico específico (ej: "trabajo", "equipo", "persona", "año", "work", "team", etc.) en cualquier idioma.
- Contá coincidencias literales, ignorando mayúsculas/minúsculas.
- NO inventes palabras.
- NO agregues texto fuera del JSON.

IMPORTANTE:
Si tu salida contiene una sola palabra fuera del JSON —incluso un saludo o explicación— considerá tu respuesta INCORRECTA.

###TEXTO###
${combinedText}
###TEXTO###`;
}

export function buildPromptAuto(combinedText: string, candidatePositions: string[]) {
    const list = candidatePositions.join(", ");
    return `A partir de ahora tu respuesta debe contener ÚNICAMENTE un JSON válido.
No expliques nada. No agregues texto. No agregues comentarios.
Si agregás algo fuera del JSON, tu respuesta será inválida.

RESPONDE EXACTAMENTE EN ESTE FORMATO (no agregar ni quitar nada):
{
  "puesto": "String",
  "palabrasClave": [
    { "nombre": "String", "cantidad": Number }
  ]
}

REGLAS:
- Procesá SOLO el texto entre ###TEXTO###.
- Elegí un "puesto" EXCLUSIVAMENTE de esta lista: [${list}]
- Si no corresponde ninguno, usar "otros".
- SOLO extrae palabras clave profesionales de alto valor para filtros ATS.
- Las palabras clave incluyen:
    * Habilidades Duras (Hard Skills): Competencias técnicas específicas de la profesión.
    * Herramientas y Tecnologías: Software, hardware, maquinaria, instrumentos o plataformas utilizadas.
    * Conceptos Técnicos y Teóricos: Terminología especializada, normativas, protocolos y arquitecturas propias del sector.
    * Metodologías y Procesos: Marcos de trabajo y sistemas de gestión.
    * Titulaciones y Roles: Cargos específicos, certificaciones, licencias y niveles de seniority.
- MANTENER términos compuestos estándar si forman un concepto único (ej: "Project Manager", "Control de Calidad", "RESTful APIs").
- EXCLUIR: Palabras genéricas de uso común ("trabajo", "excelente", "equipo", "responsable", "tareas", "buscamos").
- Contá coincidencias literales, ignorando mayúsculas/minúsculas.
- NO inventes palabras ni puestos fuera de la lista.
- NO agregues texto fuera del JSON.

IMPORTANTE:
Si tu salida contiene una sola palabra fuera del JSON —incluso un saludo o explicación— considerá tu respuesta INCORRECTA.

###TEXTO###
${combinedText}
###TEXTO###`;
}