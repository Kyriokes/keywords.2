// Todo el texto de la landing en un solo lugar. Las preguntas también alimentan el JSON-LD.
// Cada afirmación describe algo que la app hace hoy; si cambia el producto, se cambia acá.

/** Cupo diario por defecto (`User.dailyAnalysesLimit` en prisma/schema.prisma). */
export const DAILY_ANALYSES = 20;

export const SECTION_IDS = {
  how: "como-funciona",
  benefits: "beneficios",
  faq: "preguntas",
} as const;

export const NAV_ANCHORS = [
  { href: `/#${SECTION_IDS.how}`, label: "Cómo funciona" },
  { href: `/#${SECTION_IDS.benefits}`, label: "Beneficios" },
  { href: `/#${SECTION_IDS.faq}`, label: "Preguntas" },
];

export const CTA = {
  anonymous: { href: "/login", label: "Empezar gratis con Google", short: "Empezar gratis" },
  loggedIn: { href: "/user/dashboard", label: "Ir a mis postulaciones", short: "Mis postulaciones" },
};

export const HERO = {
  title: ["Sabé qué piden las ofertas", "y cuánto de eso ya tenés"],
  subtitle:
    "Pegás cada oferta de IT a la que te postulás. KeyWords extrae las habilidades, las compara con tu CV y te muestra qué sumar primero.",
  proof: `Gratis y sin tarjeta. ${DAILY_ANALYSES} análisis de ofertas por día.`,
};

export const DEMO = {
  title: "Estadísticas",
  note: "Datos de ejemplo. Tildá una habilidad para ver cuánto subiría la cobertura.",
};

export const TAGLINE = ["Cada oferta que guardás te dice algo.", "Juntas te dicen qué aprender primero."];

export const HOW = {
  title: "Cómo funciona",
  subtitle: "Tres pasos, y el primero te lleva lo que tardás en copiar y pegar.",
  steps: [
    {
      short: "La oferta",
      title: "Pegás la oferta",
      body: "Copiás el texto de la publicación tal como está. La IA extrae el puesto y las habilidades, y el diccionario las unifica: ReactJS, React.js y react son la misma cosa. Antes de guardar revisás el resultado y quitás lo que no va.",
    },
    {
      short: "Tu CV",
      title: "Subís tu CV",
      body: "En PDF o Word. Se compara contra el mismo diccionario, sin pasar por la IA, y cada postulación muestra cuántas de sus habilidades ya tenés.",
    },
    {
      short: "Qué sumar",
      title: "Ves qué sumar primero",
      body: "Las habilidades se ordenan por cuántas ofertas las piden. Las que te faltan muestran cuántos puntos de cobertura suman, así sabés por dónde empezar.",
    },
  ],
};

export const BENEFITS = {
  title: "Qué ganás con cada oferta que cargás",
  items: {
    gaps: {
      title: "Sabés qué estudiar primero",
      body: "Cada habilidad que te falta muestra cuántos puntos de cobertura suma. La primera de la lista es la que más ofertas te acerca.",
    },
    match: {
      title: "Ves cuánto encajás en cada oferta",
      body: "Cada postulación muestra cuántas de sus habilidades ya están en tu CV y cuáles no.",
    },
    roles: {
      title: "Tus puestos dejan de multiplicarse",
      body: "Los títulos cambian de una empresa a otra y el puesto es el mismo. KeyWords los agrupa por rol y guarda el seniority aparte.",
    },
    simulation: {
      title: "Probás antes de invertir tiempo",
      body: "Tildás una habilidad y ves cuánto subiría tu cobertura, antes de dedicarle un mes de estudio.",
    },
  },
};

export const FACTS = {
  title: "Lo que hay detrás",
  subtitle: "Las habilidades se reconocen contra un diccionario propio de tecnología, no palabra por palabra.",
  labels: {
    technologies: "tecnologías, herramientas y metodologías",
    spellings: "formas de escribirlas que se reconocen",
    roles: "roles de IT para agrupar los títulos",
    analyses: "análisis de ofertas por día, gratis",
  },
};

export const FAQ = {
  title: "Preguntas",
  items: [
    {
      question: "¿Es gratis?",
      answer: `Sí. Podés analizar hasta ${DAILY_ANALYSES} ofertas por día sin pagar ni cargar una tarjeta. El cupo se renueva a la medianoche de Argentina.`,
    },
    {
      question: "¿Sirve para cualquier rubro?",
      answer:
        "Por ahora no. El diccionario cubre tecnología: desarrollo, datos, QA, infraestructura, producto y roles cercanos. Una oferta de otro rubro se guarda igual, pero sus habilidades quedan sin verificar y el puesto sin clasificar.",
    },
    {
      question: "¿Qué pasa con mi CV?",
      answer:
        "Se lee en el servidor y se guarda su texto para poder compararlo con cada oferta. No se envía a ningún proveedor de IA. Lo borrás desde tu perfil cuando quieras.",
    },
    {
      question: "¿Y con el texto de las ofertas?",
      answer:
        "Ese sí pasa por un proveedor de IA, que extrae el puesto y las habilidades. Queda guardado junto con la postulación para que puedas volver a leerlo.",
    },
    {
      question: "¿La IA se puede equivocar?",
      answer:
        "Sí, por eso nada se guarda sin que lo veas. Después de cada análisis revisás el puesto y las habilidades detectadas, y quitás las que no corresponden.",
    },
    {
      question: "¿Cómo se calcula la cobertura?",
      answer:
        "Cada habilidad pesa según cuántas de tus postulaciones la piden. Una que aparece en diez ofertas cuenta diez veces más que una que aparece en una sola. La cobertura es la parte de ese total que ya está en tu CV.",
    },
    {
      question: "¿En qué se diferencia de una planilla?",
      answer:
        "Una planilla guarda dónde te postulaste. KeyWords además lee qué pedía cada oferta, lo unifica y lo cruza con tu CV. Si igual querés tu planilla, exportás todo a Excel desde tu panel.",
    },
    {
      question: "¿Tengo que crear una cuenta?",
      answer: "Entrás con tu cuenta de Google. No hay una contraseña nueva que recordar.",
    },
    {
      question: "¿Puedo llevarme o borrar mis datos?",
      answer:
        "Sí. Desde tu panel exportás las postulaciones a un archivo de Excel, y podés borrar cada postulación y cada CV cuando quieras.",
    },
  ],
};

export const FINAL = {
  title: "Empezá con la próxima oferta que te interese",
  body: "La pegás, revisás lo que se detectó y ya tenés el primer dato. Con cada oferta nueva el panorama se afina.",
  risk: "Gratis, sin tarjeta y sin contraseña nueva. Tus datos se exportan a Excel cuando quieras.",
};

export const SEO = {
  title: "KeyWords | Qué piden las ofertas de IT y cuánto ya tenés",
  description:
    "Pegá las ofertas de IT a las que te postulás. KeyWords extrae las habilidades, las compara con tu CV y te muestra cuáles sumar primero. Gratis, con tu cuenta de Google.",
};
