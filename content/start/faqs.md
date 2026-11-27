---
description: Quick answers to the most common questions about AdonisJS, including framework sustainability, technical capabilities, and production readiness.
---

# Frequently Asked Questions

## Is AdonisJS actively maintained?

Yes, AdonisJS is actively maintained with regular updates, bug fixes, and feature additions. The framework has been consistently developed since 2015 and receives continuous attention from its core team.

You can verify maintenance activity by checking [OSS Insights](https://next.ossinsight.io/analyze/adonisjs), which shows comprehensive metrics across the entire AdonisJS GitHub organization including recent commits, responsive issue discussions, and release patterns.

## How does AdonisJS compare to Express, NestJS, and Fastify?

AdonisJS is a full-stack, batteries-included framework that provides complete development solutions out of the box. This contrasts with Express and Fastify's minimalist approach and differs from NestJS's heavily opinionated enterprise architecture.

**Compared to Express**: AdonisJS offers built-in features for authentication, validation, ORM, and sessions, whereas Express requires you to choose and integrate these pieces yourself. AdonisJS provides more structure and convention, while Express offers maximum flexibility.

**Compared to NestJS**: Both frameworks support TypeScript natively and provide structured architecture. NestJS emphasizes Angular-style decorators and enterprise patterns, while AdonisJS follows Laravel-inspired conventions with a simpler learning curve. AdonisJS is also faster to embrace modern Node.js primitives like ESM, making it more aligned with current JavaScript ecosystem standards.

**Compared to Fastify**: Fastify focuses on maximum performance with minimal overhead, while AdonisJS prioritizes developer productivity with comprehensive built-in features. Both deliver excellent performance, but AdonisJS includes more functionality by default.

Choose AdonisJS when you want a complete framework with built-in solutions and Laravel-style development experience in Node.js. Choose alternatives when you need maximum flexibility (Express), enterprise patterns (NestJS), or minimal abstraction (Fastify).

## Is AdonisJS production-ready?

Yes, AdonisJS is production-ready and has powered thousands of applications since 2015, ranging from small startups to large-scale enterprise systems. The framework handles high-traffic scenarios efficiently and follows security best practices by default.

Companies using AdonisJS in production include [Marie Claire](https://www.marieclaire.com/), [Ledger](https://www.ledger.com/), [Kayako](https://kayako.com/), [Renault Group](https://www.renaultgroup.com/en/), [Zakodium](https://www.zakodium.com/), [FIVB](https://www.fivb.com/), [Petpooja](https://www.petpooja.com/), [Paytm](https://paytm.com/), [Verifiables](https://verifiables.com), [Pappers](https://www.pappers.fr/), [Edmond de Rothschild](https://www.edmond-de-rothschild.com/en/home), [France Travail](https://www.francetravail.fr/accueil/), and many more.

While production-ready, consider that the AdonisJS community is smaller than Express or Next.js communities, which means fewer Stack Overflow answers and potentially more challenging hiring. However, developers familiar with TypeScript and modern frameworks become productive quickly, and the official documentation is comprehensive.

The framework deploys successfully to all major hosting platforms including traditional VPS providers, Docker containers, and modern platforms like Railway, Render, and Fly.io. You can also turn your own servers into a deployment platform with [Tenkai](./deployment.md#deploying-to-your-own-servers).

## Does AdonisJS support TypeScript natively?

Yes, AdonisJS is built with TypeScript from the ground up and provides first-class TypeScript support. Unlike frameworks where TypeScript is an optional add-on, AdonisJS is designed specifically for TypeScript and leverages its full power.

When you create a new AdonisJS project, TypeScript is already configured with optimal settings. The build system, type checking, and development workflow work seamlessly without additional setup. Every framework API is fully typed, providing complete IntelliSense and compile-time error checking.

The framework uses advanced TypeScript features to infer types automatically, meaning you get type safety without writing excessive type annotations. For example, validation schemas automatically infer the validated data type, and models automatically provide types for all properties and methods.

TypeScript compiles away during the build process, so there's no runtime overhead. Your production code runs as optimized JavaScript with the same performance as hand-written JavaScript.

## Who maintains AdonisJS?

AdonisJS is primarily maintained by Harminder Virk , who created the framework in 2015 and continues to lead its development. The framework also has a [small core team](https://adonisjs.com/team) of contributors who help with specific areas like documentation, package maintenance, and community support.

Harminder works on AdonisJS full-time as his primary professional focus, not as a side project. This ensures consistent attention, timely issue responses, and regular feature development. The framework receives financial support through the [Insiders](https://adonisjs.com/insiders) and [Partners](https://adonisjs.com/partner) programs, enabling sustainable full-time maintenance.

While some developers worry about frameworks maintained primarily by one person, this model has proven sustainable for nearly a decade. A single maintainer ensures coherent vision, consistent code quality, and fast decision-making. Many successful open-source projects (Linux, Ruby on Rails, Laravel, Vue.js) have followed similar models successfully.

The codebase is well-documented and structured to enable community contributions. The framework is open source under the MIT license, ensuring the code remains accessible regardless of future circumstances.

## Where can I get help with AdonisJS?

The primary support channel is the official [Discord server](https://discord.gg/vDcEjq6), where community members and core team typically respond within hours. The server has dedicated channels for different topics including general help, database questions, and deployment issues.

For longer-form questions or architectural advice, use [GitHub Discussions](https://github.com/adonisjs/core/discussions). For bug reports and feature requests, use [GitHub Issues](https://github.com/adonisjs/core/issues). The official [documentation](https://docs.adonisjs.com) is comprehensive and answers most common questions.

To get better answers faster, provide clear context, share relevant code snippets, include complete error messages, specify your environment (versions), and explain what you've already tried.

## Can I use AdonisJS for building APIs?

Yes, AdonisJS is excellent for building APIs and many developers choose it primarily for API development. The framework provides extensive built-in features specifically designed for APIs, including RESTful resource routing, built-in validation with VineJS, multiple authentication schemes, transformers for serializing data, CORS handling, and rate limiting support.
