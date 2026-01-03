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
- Contá coincidencias literales, ignorando mayúsculas/minúsculas.
- NO inventes palabras.
- NO excluyas palabras existentes.
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
- Contá coincidencias literales, ignorando mayúsculas/minúsculas.
- NO inventes palabras ni puestos fuera de la lista.
- NO agregues texto fuera del JSON.

IMPORTANTE:
Si tu salida contiene una sola palabra fuera del JSON —incluso un saludo o explicación— considerá tu respuesta INCORRECTA.

###TEXTO###
${combinedText}
###TEXTO###`;
}
