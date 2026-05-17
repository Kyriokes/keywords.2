'use client';

import { motion } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { containerVariants, itemVariants } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface LandingPageClientProps {
  isLoggedIn: boolean;
}

export function LandingPageClient({ isLoggedIn }: LandingPageClientProps) {
  const primaryCta = isLoggedIn
    ? { href: '/user/dashboard', label: 'Ir a Mis Postulaciones' }
    : { href: '/login', label: 'Iniciar sesión' };

  const secondaryCta = isLoggedIn
    ? { href: '/user/profile', label: 'Ver mi perfil' }
    : { href: '/#como-funciona', label: 'Cómo funciona' };

  const steps = [
    {
      icon: FileText,
      title: 'Subís tu CV',
      description: 'Analizamos tu perfil para entender mejor tu punto de partida.',
    },
    {
      icon: BriefcaseBusiness,
      title: 'Registrás tus postulaciones',
      description: 'Guardá cada oferta y seguí tu búsqueda sin perder contexto.',
    },
    {
      icon: Sparkles,
      title: 'Recibís recomendaciones',
      description: 'Descubrí qué habilidades te faltan y qué está pidiendo el mercado.',
    },
  ];

  const benefits = [
    'Dejás de postularte a ciegas',
    'Entendés qué pide el mercado',
    'Mejorás tu CV con datos reales',
    'Tenés tu historial en un solo lugar',
  ];

  return (
    <div className="bg-gradient-to-b from-background via-background to-muted/20">
      <motion.div
        className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-16 md:gap-24 md:py-24"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.section
          variants={itemVariants}
          className="space-y-8"
        >
          <div className="space-y-8 text-center lg:text-left">
            <div className="space-y-4">
              <span className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
                KeyWords
              </span>
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                  Organizá tu búsqueda laboral y descubrí por qué no estás quedando.
                </h1>
                <p className="mx-auto max-w-2xl text-lg leading-8 text-muted-foreground lg:mx-0">
                  Guardá cada postulación, analizá qué pide el mercado y obtené recomendaciones
  concretos sobre qué mejorar en tu perfil.
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Button asChild size="lg" className="gap-2">
                <Link href={primaryCta.href}>
                  {primaryCta.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
              </Button>
            </div>

            <div className="grid gap-3 text-left text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-xl border bg-background/80 p-4 shadow-sm">
                Organizá tu búsqueda sin perder historial ni contexto.
              </div>
              <div className="rounded-xl border bg-background/80 p-4 shadow-sm">
                Entendé qué habilidades te acercan al trabajo que querés.
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} id="como-funciona" className="space-y-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Cómo funciona
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Tres pasos para ordenar tu búsqueda
            </h2>
            <p className="text-lg text-muted-foreground">
              Todo está pensado para que entiendas rápido tu situación y tomes mejores
              decisiones en cada postulación.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <div key={title} className="rounded-2xl border bg-background p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">{title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={itemVariants}>
          <div className="mx-auto w-full max-w-xl">
            <div className="overflow-hidden rounded-3xl border bg-background shadow-xl shadow-primary/5">
              <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Vista previa</p>
                  <p className="text-sm text-muted-foreground">Placeholder visual del producto</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Dato rápido
                </span>
              </div>

              <div className="space-y-5 p-5">
                <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                  <p className="text-sm font-semibold text-foreground">Tus postulaciones</p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between rounded-xl bg-background px-3 py-2">
                      <span>Frontend Developer</span>
                      <span className="text-xs font-medium text-primary">Enviada</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-background px-3 py-2">
                      <span>React Engineer</span>
                      <span className="text-xs font-medium text-amber-600">Entrevista</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-background px-3 py-2">
                      <span>UI Developer</span>
                      <span className="text-xs font-medium text-muted-foreground">Guardada</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-foreground">Te falta reforzar</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-background px-3 py-1 text-sm text-foreground shadow-sm">
                      React
                    </span>
                    <span className="rounded-full bg-background px-3 py-1 text-sm text-foreground shadow-sm">
                      TypeScript
                    </span>
                    <span className="rounded-full bg-background px-3 py-1 text-sm text-foreground shadow-sm">
                      Testing
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Beneficios claros
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Convertí tu búsqueda laboral en una estrategia
            </h2>
            <p className="text-lg leading-8 text-muted-foreground">
              KeyWords te ayuda a salir del caos, entender mejor cada postulación y ajustar tu
              perfil con información útil.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex gap-3 rounded-2xl border bg-background p-5 shadow-sm">
                <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                <p className="text-base leading-7 text-foreground">{benefit}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={itemVariants}>
          <div className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-10">
            <div className="mx-auto max-w-3xl space-y-4 text-center">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
                Diferencial
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                No es un Excel más
              </h2>
              <p className="text-lg leading-8 text-muted-foreground">
                La IA analiza tu perfil y cada búsqueda laboral para darte recomendaciones
                concretas sobre qué mejorar, qué reforzar y hacia dónde enfocar tu búsqueda.
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants}>
          <div className="rounded-3xl border bg-background px-6 py-10 text-center shadow-sm md:px-10">
            <div className="mx-auto max-w-2xl space-y-5">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Empezá a mejorar tu búsqueda hoy
              </h2>
              <p className="text-lg leading-8 text-muted-foreground">
                Organizá tus postulaciones, entendé qué te falta y avanzá con más claridad.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2">
                  <Link href={primaryCta.href}>
                    {isLoggedIn ? 'Ir a Mis Postulaciones' : 'Empezar gratis'}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
